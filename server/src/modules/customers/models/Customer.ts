import mongoose, { Document, Schema, Types } from 'mongoose';

// Type for marketplace types
export type MarketplaceType = 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Interface for Customer Address
export interface ICustomerAddress {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  country: string;
  zip: string;
  phone?: string;
  isDefault?: boolean;
}

// Interface for Customer document
export interface ICustomer extends Document {
  workspaceId: Types.ObjectId;
  storeConnectionId: Types.ObjectId;
  externalCustomerId: string; // Customer ID from marketplace
  marketplace: MarketplaceType;

  // Customer details
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;

  // Customer status
  acceptsMarketing: boolean;
  isActive: boolean;

  // Customer metrics
  totalSpent: number;
  totalOrders: number;
  lastOrderDate?: Date;

  // Addresses
  addresses: ICustomerAddress[];
  defaultAddress?: ICustomerAddress;

  // Customer dates
  createdDate: Date;
  updatedDate?: Date;

  // Metadata from marketplace
  metadata: Record<string, any>;

  // Sync info
  lastSyncDate: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Customer Address Schema
const customerAddressSchema = new Schema<ICustomerAddress>({
  firstName: String,
  lastName: String,
  company: String,
  address1: {
    type: String,
    required: true
  },
  address2: String,
  city: {
    type: String,
    required: true
  },
  province: String,
  country: {
    type: String,
    required: true
  },
  zip: {
    type: String,
    required: true
  },
  phone: String,
  isDefault: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Main Customer Schema
const customerSchema = new Schema<ICustomer>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  storeConnectionId: {
    type: Schema.Types.ObjectId,
    ref: 'StoreConnection',
    required: true,
    index: true
  },
  externalCustomerId: {
    type: String,
    required: true,
    index: true
  },
  marketplace: {
    type: String,
    required: true,
    enum: ['shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce'],
    index: true
  },

  // Customer details
  email: {
    type: String,
    index: true
  },
  firstName: String,
  lastName: String,
  phone: String,

  // Customer status
  acceptsMarketing: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Customer metrics
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  totalOrders: {
    type: Number,
    default: 0,
    min: 0
  },
  lastOrderDate: {
    type: Date,
    index: true
  },

  // Addresses
  addresses: {
    type: [customerAddressSchema],
    default: []
  },
  defaultAddress: customerAddressSchema,

  // Customer dates
  createdDate: {
    type: Date,
    required: true,
    index: true
  },
  updatedDate: Date,

  // Metadata from marketplace
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },

  // Sync info
  lastSyncDate: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
customerSchema.index({ workspaceId: 1, marketplace: 1 });
customerSchema.index({ workspaceId: 1, email: 1 });
customerSchema.index({ workspaceId: 1, createdDate: -1 });
customerSchema.index({ workspaceId: 1, totalSpent: -1 });
customerSchema.index({ workspaceId: 1, totalOrders: -1 });
customerSchema.index({ storeConnectionId: 1, lastSyncDate: -1 });
customerSchema.index({ externalCustomerId: 1, marketplace: 1 }, { unique: true });

// Compound index for customer search
customerSchema.index({
  workspaceId: 1,
  firstName: 'text',
  lastName: 'text',
  email: 'text'
});

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;