import Order, { IOrder, IOrderItem, IOrderAddress, IOrderCustomer, MarketplaceType, OrderStatus } from '../models/Order';
import StoreConnection, { IStoreConnection } from '../../stores/models/StoreConnection';
import { Types } from 'mongoose';
import axios from 'axios';

export interface OrderSyncResult {
  success: boolean;
  message: string;
  syncedOrders: number;
  newOrders: number;
  updatedOrders: number;
  errors: string[];
}

export interface OrderQuery {
  page?: number;
  limit?: number;
  status?: string;
  marketplace?: string;
  storeConnectionId?: string;
  search?: string;
  sortBy?: 'orderDate' | 'total' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface OrdersListResponse {
  orders: IOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class OrdersService {
  /**
   * Get orders for a workspace with filtering and pagination
   */
  static async getOrders(
    workspaceId: string,
    query: OrderQuery = {}
  ): Promise<OrdersListResponse> {
    const {
      page = 1,
      limit = 20,
      status,
      marketplace,
      storeConnectionId,
      search,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = query;

    // Build filter
    const filter: any = {
      workspaceId: new Types.ObjectId(workspaceId)
    };

    if (status) {
      filter.status = status;
    }

    if (marketplace) {
      filter.marketplace = marketplace;
    }

    if (storeConnectionId) {
      filter.storeConnectionId = new Types.ObjectId(storeConnectionId);
    }

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } },
        { 'customer.firstName': { $regex: search, $options: 'i' } },
        { 'customer.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions: Record<string, 1 | -1> = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('storeConnectionId', 'storeName marketplaceType')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter)
    ]);

    return {
      orders: orders as IOrder[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a single order by ID
   */
  static async getOrderById(workspaceId: string, orderId: string): Promise<IOrder | null> {
    return Order.findOne({
      _id: orderId,
      workspaceId: new Types.ObjectId(workspaceId)
    }).populate('storeConnectionId', 'storeName marketplaceType');
  }

  /**
   * Sync orders from all connected stores for a workspace
   */
  static async syncAllStoresOrders(workspaceId: string): Promise<OrderSyncResult> {
    const stores = await StoreConnection.find({
      workspaceId: new Types.ObjectId(workspaceId),
      isActive: true
    });

    if (stores.length === 0) {
      return {
        success: false,
        message: 'No active store connections found',
        syncedOrders: 0,
        newOrders: 0,
        updatedOrders: 0,
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
        const result = await this.syncStoreOrders(workspaceId, store._id.toString());
        totalSynced += result.syncedOrders;
        totalNew += result.newOrders;
        totalUpdated += result.updatedOrders;
        allErrors.push(...result.errors);
      } catch (error) {
        allErrors.push(`Store ${store.storeName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: allErrors.length === 0,
      message: `Synced ${totalSynced} orders from ${stores.length} stores`,
      syncedOrders: totalSynced,
      newOrders: totalNew,
      updatedOrders: totalUpdated,
      errors: allErrors
    };
  }

  /**
   * Sync orders from a specific store
   */
  static async syncStoreOrders(workspaceId: string, storeConnectionId: string): Promise<OrderSyncResult> {
    const store = await StoreConnection.findOne({
      _id: storeConnectionId,
      workspaceId: new Types.ObjectId(workspaceId),
      isActive: true
    });

    if (!store) {
      throw new Error('Store connection not found or inactive');
    }

    // Get the last sync date for incremental sync
    const lastOrder = await Order.findOne({
      storeConnectionId: store._id,
      workspaceId: new Types.ObjectId(workspaceId)
    })
    .sort({ orderDate: -1 })
    .select('orderDate');

    const lastSyncDate = lastOrder?.orderDate || new Date('2020-01-01'); // Default to older date if no orders

    try {
      let orders: any[] = [];

      switch (store.marketplaceType) {
        case 'shopify':
          orders = await this.fetchShopifyOrders(store, lastSyncDate);
          break;
        case 'vtex':
          orders = await this.fetchVtexOrders(store, lastSyncDate);
          break;
        case 'woocommerce':
          orders = await this.fetchWooCommerceOrders(store, lastSyncDate);
          break;
        default:
          throw new Error(`Orders sync not implemented for ${store.marketplaceType}`);
      }

      // Process and save orders
      const result = await this.processAndSaveOrders(workspaceId, store, orders);

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
   * Fetch orders from Shopify
   */
  private static async fetchShopifyOrders(store: IStoreConnection, sinceDate: Date): Promise<any[]> {
    const { shop_url, access_token } = store.credentials;

    if (!shop_url || !access_token) {
      throw new Error('Missing Shopify credentials');
    }

    const baseUrl = shop_url.replace(/\/$/, '');
    const url = `${baseUrl}/admin/api/2023-10/orders.json`;

    const params = {
      status: 'any',
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

    return response.data.orders || [];
  }

  /**
   * Fetch orders from VTEX
   */
  private static async fetchVtexOrders(store: IStoreConnection, sinceDate: Date): Promise<any[]> {
    const { account_name, app_key, app_token } = store.credentials;

    if (!account_name || !app_key || !app_token) {
      throw new Error('Missing VTEX credentials');
    }

    // VTEX Orders API endpoint
    const url = `https://${account_name}.vtexcommercestable.com.br/api/oms/pvt/orders`;

    const params = {
      f_creationDate: `creationDate:[${sinceDate.toISOString().split('T')[0]} TO NOW]`,
      per_page: 100,
      page: 1
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

    return response.data.list || [];
  }

  /**
   * Fetch orders from WooCommerce
   */
  private static async fetchWooCommerceOrders(store: IStoreConnection, sinceDate: Date): Promise<any[]> {
    const { url, consumer_key, consumer_secret } = store.credentials;

    if (!url || !consumer_key || !consumer_secret) {
      throw new Error('Missing WooCommerce credentials');
    }

    const baseUrl = url.replace(/\/$/, '');
    const ordersUrl = `${baseUrl}/wp-json/wc/v3/orders`;

    const params = {
      after: sinceDate.toISOString(),
      per_page: 100,
      page: 1
    };

    const response = await axios.get(ordersUrl, {
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
   * Process and save orders to database
   */
  private static async processAndSaveOrders(
    workspaceId: string,
    store: IStoreConnection,
    rawOrders: any[]
  ): Promise<OrderSyncResult> {
    let newOrders = 0;
    let updatedOrders = 0;
    const errors: string[] = [];

    for (const rawOrder of rawOrders) {
      try {
        const orderData = this.normalizeOrderData(rawOrder, store);

        // Check if order already exists
        const existingOrder = await Order.findOne({
          externalOrderId: orderData.externalOrderId,
          marketplace: store.marketplaceType
        });

        if (existingOrder) {
          // Update existing order
          await Order.findByIdAndUpdate(existingOrder._id, {
            ...orderData,
            lastSyncDate: new Date()
          });
          updatedOrders++;
        } else {
          // Create new order
          await Order.create({
            workspaceId: new Types.ObjectId(workspaceId),
            storeConnectionId: store._id,
            ...orderData,
            lastSyncDate: new Date()
          });
          newOrders++;
        }
      } catch (error) {
        errors.push(`Order ${rawOrder.id || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Processed ${rawOrders.length} orders`,
      syncedOrders: newOrders + updatedOrders,
      newOrders,
      updatedOrders,
      errors
    };
  }

  /**
   * Normalize order data from different marketplaces to our format
   */
  private static normalizeOrderData(rawOrder: any, store: IStoreConnection): Partial<IOrder> {
    switch (store.marketplaceType) {
      case 'shopify':
        return this.normalizeShopifyOrder(rawOrder);
      case 'vtex':
        return this.normalizeVtexOrder(rawOrder);
      case 'woocommerce':
        return this.normalizeWooCommerceOrder(rawOrder);
      default:
        throw new Error(`Normalization not implemented for ${store.marketplaceType}`);
    }
  }

  /**
   * Normalize Shopify order data
   */
  private static normalizeShopifyOrder(order: any): Partial<IOrder> {
    return {
      externalOrderId: order.id.toString(),
      orderNumber: order.name || order.order_number?.toString() || order.id.toString(),
      marketplace: 'shopify',
      status: this.mapShopifyStatus(order.fulfillment_status, order.financial_status),
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,

      // Items
      items: order.line_items?.map((item: any): IOrderItem => ({
        externalProductId: item.product_id?.toString() || '',
        sku: item.sku || '',
        title: item.name || item.title || '',
        quantity: parseInt(item.quantity) || 1,
        price: parseFloat(item.price) || 0,
        totalPrice: parseFloat(item.price) * parseInt(item.quantity) || 0,
        variant: item.variant_title || '',
        imageUrl: item.image?.src || ''
      })) || [],

      // Customer
      customer: order.customer ? {
        id: order.customer.id?.toString(),
        email: order.customer.email,
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
        phone: order.customer.phone
      } : undefined,

      // Addresses
      billingAddress: order.billing_address ? this.normalizeAddress(order.billing_address) : undefined,
      shippingAddress: order.shipping_address ? this.normalizeAddress(order.shipping_address) : undefined,

      // Financial info
      subtotal: parseFloat(order.subtotal_price) || 0,
      taxTotal: parseFloat(order.total_tax) || 0,
      shippingTotal: parseFloat(order.total_shipping_price_set?.shop_money?.amount) || 0,
      discountTotal: parseFloat(order.total_discounts) || 0,
      total: parseFloat(order.total_price) || 0,
      currency: order.currency || 'USD',

      // Dates
      orderDate: new Date(order.created_at),
      shippedDate: order.shipped_date ? new Date(order.shipped_date) : undefined,

      // Metadata
      metadata: {
        shopify_order_id: order.id,
        shopify_order_number: order.order_number,
        tags: order.tags,
        note: order.note,
        source_name: order.source_name
      }
    };
  }

  /**
   * Normalize VTEX order data
   */
  private static normalizeVtexOrder(order: any): Partial<IOrder> {
    return {
      externalOrderId: order.orderId,
      orderNumber: order.sequence?.toString() || order.orderId,
      marketplace: 'vtex',
      status: this.mapVtexStatus(order.status),

      // Items
      items: order.items?.map((item: any): IOrderItem => ({
        externalProductId: item.productId || '',
        sku: item.id || '',
        title: item.name || '',
        quantity: parseInt(item.quantity) || 1,
        price: parseFloat(item.price) / 100 || 0, // VTEX prices are in cents
        totalPrice: (parseFloat(item.price) * parseInt(item.quantity)) / 100 || 0,
        imageUrl: item.imageUrl || ''
      })) || [],

      // Financial info
      subtotal: parseFloat(order.totals?.[0]?.value) / 100 || 0,
      taxTotal: 0, // VTEX tax calculation varies
      total: parseFloat(order.value) / 100 || 0,
      currency: 'BRL', // VTEX is primarily Brazilian

      // Dates
      orderDate: new Date(order.creationDate),

      // Metadata
      metadata: {
        vtex_order_id: order.orderId,
        vtex_sequence: order.sequence,
        origin: order.origin,
        sales_channel: order.salesChannel
      }
    };
  }

  /**
   * Normalize WooCommerce order data
   */
  private static normalizeWooCommerceOrder(order: any): Partial<IOrder> {
    return {
      externalOrderId: order.id.toString(),
      orderNumber: order.number?.toString() || order.id.toString(),
      marketplace: 'woocommerce',
      status: this.mapWooCommerceStatus(order.status),

      // Items
      items: order.line_items?.map((item: any): IOrderItem => ({
        externalProductId: item.product_id?.toString() || '',
        sku: item.sku || '',
        title: item.name || '',
        quantity: parseInt(item.quantity) || 1,
        price: parseFloat(item.price) || 0,
        totalPrice: parseFloat(item.total) || 0,
        variant: item.variation_id ? `Variation ${item.variation_id}` : ''
      })) || [],

      // Customer
      customer: {
        email: order.billing?.email,
        firstName: order.billing?.first_name,
        lastName: order.billing?.last_name,
        phone: order.billing?.phone
      },

      // Addresses
      billingAddress: order.billing ? this.normalizeWooCommerceAddress(order.billing) : undefined,
      shippingAddress: order.shipping ? this.normalizeWooCommerceAddress(order.shipping) : undefined,

      // Financial info
      subtotal: parseFloat(order.total) - parseFloat(order.total_tax || 0) - parseFloat(order.shipping_total || 0),
      taxTotal: parseFloat(order.total_tax) || 0,
      shippingTotal: parseFloat(order.shipping_total) || 0,
      total: parseFloat(order.total) || 0,
      currency: order.currency || 'USD',

      // Dates
      orderDate: new Date(order.date_created),

      // Metadata
      metadata: {
        woocommerce_order_id: order.id,
        payment_method: order.payment_method,
        payment_method_title: order.payment_method_title,
        transaction_id: order.transaction_id
      }
    };
  }

  /**
   * Helper methods for status mapping
   */
  private static mapShopifyStatus(fulfillmentStatus: string, financialStatus: string): OrderStatus {
    if (fulfillmentStatus === 'fulfilled') return 'delivered';
    if (fulfillmentStatus === 'partial') return 'processing';
    if (financialStatus === 'refunded') return 'refunded';
    if (financialStatus === 'paid') return 'confirmed';
    return 'pending';
  }

  private static mapVtexStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'ready-for-handling': 'confirmed',
      'handling': 'processing',
      'invoiced': 'shipped',
      'shipped': 'shipped',
      'delivered': 'delivered',
      'canceled': 'cancelled'
    };
    return statusMap[status] || 'pending';
  }

  private static mapWooCommerceStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'processing': 'processing',
      'completed': 'delivered',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'on-hold': 'pending'
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Helper methods for address normalization
   */
  private static normalizeAddress(address: any): IOrderAddress {
    return {
      firstName: address.first_name,
      lastName: address.last_name,
      company: address.company,
      address1: address.address1 || address.line_1 || '',
      address2: address.address2 || address.line_2,
      city: address.city || '',
      province: address.province || address.state || address.province_code,
      country: address.country || address.country_code || '',
      zip: address.zip || address.postal_code || '',
      phone: address.phone
    };
  }

  private static normalizeWooCommerceAddress(address: any): IOrderAddress {
    return {
      firstName: address.first_name,
      lastName: address.last_name,
      company: address.company,
      address1: address.address_1 || '',
      address2: address.address_2,
      city: address.city || '',
      province: address.state,
      country: address.country || '',
      zip: address.postcode || '',
      phone: address.phone
    };
  }
}