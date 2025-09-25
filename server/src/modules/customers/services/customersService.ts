import Customer, { ICustomer, ICustomerAddress, MarketplaceType } from '../models/Customer';
import StoreConnection, { IStoreConnection } from '../../stores/models/StoreConnection';
import { Types } from 'mongoose';
import axios from 'axios';

export interface CustomerSyncResult {
  success: boolean;
  message: string;
  syncedCustomers: number;
  newCustomers: number;
  updatedCustomers: number;
  errors: string[];
}

export interface CustomerQuery {
  page?: number;
  limit?: number;
  marketplace?: string;
  storeConnectionId?: string;
  search?: string;
  sortBy?: 'createdDate' | 'totalSpent' | 'totalOrders' | 'lastOrderDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CustomersListResponse {
  customers: ICustomer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class CustomersService {
  /**
   * Get customers for a workspace with filtering and pagination
   */
  static async getCustomers(
    workspaceId: string,
    query: CustomerQuery = {}
  ): Promise<CustomersListResponse> {
    const {
      page = 1,
      limit = 20,
      marketplace,
      storeConnectionId,
      search,
      sortBy = 'createdDate',
      sortOrder = 'desc'
    } = query;

    // Build filter
    const filter: any = {
      workspaceId: new Types.ObjectId(workspaceId),
      isActive: true
    };

    if (marketplace) {
      filter.marketplace = marketplace;
    }

    if (storeConnectionId) {
      filter.storeConnectionId = new Types.ObjectId(storeConnectionId);
    }

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions: Record<string, 1 | -1> = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate('storeConnectionId', 'storeName marketplaceType')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter)
    ]);

    return {
      customers: customers as ICustomer[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a single customer by ID
   */
  static async getCustomerById(workspaceId: string, customerId: string): Promise<ICustomer | null> {
    return Customer.findOne({
      _id: customerId,
      workspaceId: new Types.ObjectId(workspaceId)
    }).populate('storeConnectionId', 'storeName marketplaceType');
  }

  /**
   * Sync customers from all connected stores for a workspace
   */
  static async syncAllStoresCustomers(workspaceId: string): Promise<CustomerSyncResult> {
    const stores = await StoreConnection.find({
      workspaceId: new Types.ObjectId(workspaceId),
      isActive: true
    });

    if (stores.length === 0) {
      return {
        success: false,
        message: 'No active store connections found',
        syncedCustomers: 0,
        newCustomers: 0,
        updatedCustomers: 0,
        errors: []
      };
    }

    let totalSynced = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    const allErrors: string[] = [];

    // Process each store
    for (const store of stores) {
      try {
        const result = await this.syncStoreCustomers(workspaceId, store._id.toString());
        totalSynced += result.syncedCustomers;
        totalNew += result.newCustomers;
        totalUpdated += result.updatedCustomers;
        allErrors.push(...result.errors);
      } catch (error) {
        allErrors.push(`Store ${store.storeName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: allErrors.length === 0,
      message: `Synced ${totalSynced} customers from ${stores.length} stores`,
      syncedCustomers: totalSynced,
      newCustomers: totalNew,
      updatedCustomers: totalUpdated,
      errors: allErrors
    };
  }

  /**
   * Sync customers from a specific store
   */
  static async syncStoreCustomers(workspaceId: string, storeConnectionId: string): Promise<CustomerSyncResult> {
    const store = await StoreConnection.findOne({
      _id: storeConnectionId,
      workspaceId: new Types.ObjectId(workspaceId),
      isActive: true
    });

    if (!store) {
      throw new Error('Store connection not found or inactive');
    }

    // Get the last sync date for incremental sync
    const lastCustomer = await Customer.findOne({
      storeConnectionId: store._id,
      workspaceId: new Types.ObjectId(workspaceId)
    })
    .sort({ createdDate: -1 })
    .select('createdDate');

    const lastSyncDate = lastCustomer?.createdDate || new Date('2020-01-01'); // Default to older date if no customers

    try {
      let customers: any[] = [];

      switch (store.marketplaceType) {
        case 'shopify':
          customers = await this.fetchShopifyCustomers(store, lastSyncDate);
          break;
        case 'vtex':
          customers = await this.fetchVtexCustomers(store, lastSyncDate);
          break;
        case 'woocommerce':
          customers = await this.fetchWooCommerceCustomers(store, lastSyncDate);
          break;
        default:
          throw new Error(`Customer sync not implemented for ${store.marketplaceType}`);
      }

      // Process and save customers
      const result = await this.processAndSaveCustomers(workspaceId, store, customers);

      // Update store's last sync date
      await StoreConnection.findByIdAndUpdate(store._id, {
        lastSync: new Date(),
        syncStatus: 'completed'
      });

      return result;

    } catch (error) {
      // Update store sync status to failed
      await StoreConnection.findByIdAndUpdate(store._id, {
        syncStatus: 'failed'
      });

      throw error;
    }
  }

  /**
   * Fetch customers from Shopify
   */
  private static async fetchShopifyCustomers(store: IStoreConnection, sinceDate: Date): Promise<any[]> {
    const { shop_url, access_token } = store.credentials;

    if (!shop_url || !access_token) {
      throw new Error('Missing Shopify credentials');
    }

    const baseUrl = shop_url.replace(/\/$/, '');
    const url = `${baseUrl}/admin/api/2023-10/customers.json`;

    const params = {
      created_at_min: sinceDate.toISOString(),
      limit: 250 // Max limit for Shopify
    };

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json'
      },
      params,
      timeout: 30000
    });

    return response.data.customers || [];
  }

  /**
   * Fetch customers from VTEX
   */
  private static async fetchVtexCustomers(store: IStoreConnection, sinceDate: Date): Promise<any[]> {
    const { account_name, app_key, app_token } = store.credentials;

    if (!account_name || !app_key || !app_token) {
      throw new Error('Missing VTEX credentials');
    }

    // VTEX CRM API endpoint for customers
    const url = `https://${account_name}.vtexcommercestable.com.br/api/crm/pvt/documents`;

    const params = {
      _schema: 'CL',
      _size: 100,
      _sort: 'createdIn DESC'
    };

    const response = await axios.get(url, {
      headers: {
        'X-VTEX-API-AppKey': app_key,
        'X-VTEX-API-AppToken': app_token,
        'Content-Type': 'application/json'
      },
      params,
      timeout: 30000
    });

    return response.data || [];
  }

  /**
   * Fetch customers from WooCommerce
   */
  private static async fetchWooCommerceCustomers(store: IStoreConnection, sinceDate: Date): Promise<any[]> {
    const { url, consumer_key, consumer_secret } = store.credentials;

    if (!url || !consumer_key || !consumer_secret) {
      throw new Error('Missing WooCommerce credentials');
    }

    const baseUrl = url.replace(/\/$/, '');
    const customersUrl = `${baseUrl}/wp-json/wc/v3/customers`;

    const params = {
      after: sinceDate.toISOString(),
      per_page: 100,
      page: 1
    };

    const response = await axios.get(customersUrl, {
      auth: {
        username: consumer_key,
        password: consumer_secret
      },
      params,
      timeout: 30000
    });

    return response.data || [];
  }

  /**
   * Process and save customers to database
   */
  private static async processAndSaveCustomers(
    workspaceId: string,
    store: IStoreConnection,
    rawCustomers: any[]
  ): Promise<CustomerSyncResult> {
    let newCustomers = 0;
    let updatedCustomers = 0;
    const errors: string[] = [];

    for (const rawCustomer of rawCustomers) {
      try {
        const customerData = this.normalizeCustomerData(rawCustomer, store);

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({
          externalCustomerId: customerData.externalCustomerId,
          marketplace: store.marketplaceType
        });

        if (existingCustomer) {
          // Update existing customer
          await Customer.findByIdAndUpdate(existingCustomer._id, {
            ...customerData,
            lastSyncDate: new Date()
          });
          updatedCustomers++;
        } else {
          // Create new customer
          await Customer.create({
            workspaceId: new Types.ObjectId(workspaceId),
            storeConnectionId: store._id,
            ...customerData,
            lastSyncDate: new Date()
          });
          newCustomers++;
        }
      } catch (error) {
        errors.push(`Customer ${rawCustomer.id || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Processed ${rawCustomers.length} customers`,
      syncedCustomers: newCustomers + updatedCustomers,
      newCustomers,
      updatedCustomers,
      errors
    };
  }

  /**
   * Normalize customer data from different marketplaces to our format
   */
  private static normalizeCustomerData(rawCustomer: any, store: IStoreConnection): Partial<ICustomer> {
    switch (store.marketplaceType) {
      case 'shopify':
        return this.normalizeShopifyCustomer(rawCustomer);
      case 'vtex':
        return this.normalizeVtexCustomer(rawCustomer);
      case 'woocommerce':
        return this.normalizeWooCommerceCustomer(rawCustomer);
      default:
        throw new Error(`Customer normalization not implemented for ${store.marketplaceType}`);
    }
  }

  /**
   * Normalize Shopify customer data
   */
  private static normalizeShopifyCustomer(customer: any): Partial<ICustomer> {
    return {
      externalCustomerId: customer.id.toString(),
      marketplace: 'shopify',
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      acceptsMarketing: customer.accepts_marketing || false,
      isActive: customer.state === 'enabled',
      totalSpent: parseFloat(customer.total_spent) || 0,
      totalOrders: parseInt(customer.orders_count) || 0,
      lastOrderDate: customer.last_order_date ? new Date(customer.last_order_date) : undefined,
      addresses: customer.addresses?.map((addr: any): ICustomerAddress => ({
        firstName: addr.first_name,
        lastName: addr.last_name,
        company: addr.company,
        address1: addr.address1 || '',
        address2: addr.address2,
        city: addr.city || '',
        province: addr.province,
        country: addr.country || '',
        zip: addr.zip || '',
        phone: addr.phone,
        isDefault: addr.default || false
      })) || [],
      defaultAddress: customer.default_address ? {
        firstName: customer.default_address.first_name,
        lastName: customer.default_address.last_name,
        company: customer.default_address.company,
        address1: customer.default_address.address1 || '',
        address2: customer.default_address.address2,
        city: customer.default_address.city || '',
        province: customer.default_address.province,
        country: customer.default_address.country || '',
        zip: customer.default_address.zip || '',
        phone: customer.default_address.phone
      } : undefined,
      createdDate: new Date(customer.created_at),
      updatedDate: customer.updated_at ? new Date(customer.updated_at) : undefined,
      metadata: {
        shopify_customer_id: customer.id,
        tags: customer.tags,
        note: customer.note,
        verified_email: customer.verified_email,
        tax_exempt: customer.tax_exempt
      }
    };
  }

  /**
   * Normalize VTEX customer data
   */
  private static normalizeVtexCustomer(customer: any): Partial<ICustomer> {
    return {
      externalCustomerId: customer.id || customer.userId,
      marketplace: 'vtex',
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      acceptsMarketing: customer.acceptsMarketing || false,
      isActive: customer.isActive !== false,
      totalSpent: 0, // VTEX doesn't provide this directly
      totalOrders: 0, // Would need separate API call
      createdDate: customer.createdIn ? new Date(customer.createdIn) : new Date(),
      updatedDate: customer.updatedIn ? new Date(customer.updatedIn) : undefined,
      metadata: {
        vtex_customer_id: customer.id,
        document: customer.document,
        corporateName: customer.corporateName
      }
    };
  }

  /**
   * Normalize WooCommerce customer data
   */
  private static normalizeWooCommerceCustomer(customer: any): Partial<ICustomer> {
    return {
      externalCustomerId: customer.id.toString(),
      marketplace: 'woocommerce',
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      acceptsMarketing: customer.meta_data?.some((meta: any) => meta.key === 'accepts_marketing' && meta.value === 'yes') || false,
      isActive: true, // WooCommerce doesn't have inactive customers
      totalSpent: parseFloat(customer.total_spent) || 0,
      totalOrders: parseInt(customer.orders_count) || 0,
      addresses: [],
      defaultAddress: customer.billing ? {
        firstName: customer.billing.first_name,
        lastName: customer.billing.last_name,
        company: customer.billing.company,
        address1: customer.billing.address_1 || '',
        address2: customer.billing.address_2,
        city: customer.billing.city || '',
        province: customer.billing.state,
        country: customer.billing.country || '',
        zip: customer.billing.postcode || '',
        phone: customer.billing.phone
      } : undefined,
      createdDate: new Date(customer.date_created),
      updatedDate: customer.date_modified ? new Date(customer.date_modified) : undefined,
      metadata: {
        woocommerce_customer_id: customer.id,
        username: customer.username,
        avatar_url: customer.avatar_url
      }
    };
  }
}