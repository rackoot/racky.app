import mongoose, { Document, Schema, Types } from 'mongoose';

// Type for order status
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

// Type for marketplace types
export type MarketplaceType = 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Interface for Order Item
export interface IOrderItem {
  productId?: Types.ObjectId; // Link to our Product if exists
  externalProductId: string; // Product ID from marketplace
  sku?: string;
  title: string;
  quantity: number;
  price: number;
  totalPrice: number;
  variant?: string;
  imageUrl?: string;
}

// Interface for Order Address
export interface IOrderAddress {
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
}

// Interface for Order Customer
export interface IOrderCustomer {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

// Interface for Order Shipping
export interface IOrderShipping {
  method?: string;
  cost: number;
  trackingNumber?: string;
  carrier?: string;
}

// Interface for Order document
export interface IOrder extends Document {
  workspaceId: Types.ObjectId;
  storeConnectionId: Types.ObjectId;
  externalOrderId: string; // Order ID from marketplace
  orderNumber: string; // Human-readable order number
  marketplace: MarketplaceType;

  // Order details
  status: OrderStatus;
  financialStatus?: string; // paid, pending, refunded, etc.
  fulfillmentStatus?: string; // fulfilled, partial, unfulfilled

  // Order items
  items: IOrderItem[];

  // Customer info
  customer?: IOrderCustomer;

  // Addresses
  billingAddress?: IOrderAddress;
  shippingAddress?: IOrderAddress;

  // Financial info
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  currency: string;

  // Shipping info
  shipping?: IOrderShipping;

  // Dates
  orderDate: Date;
  shippedDate?: Date;
  deliveredDate?: Date;

  // Metadata from marketplace
  metadata: Record<string, any>;

  // Sync info
  lastSyncDate: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Order Item Schema
const orderItemSchema = new Schema<IOrderItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  externalProductId: {
    type: String,
    required: true
  },
  sku: String,
  title: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  variant: String,
  imageUrl: String
}, { _id: false });

// Order Address Schema
const orderAddressSchema = new Schema<IOrderAddress>({
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
  phone: String
}, { _id: false });

// Order Customer Schema
const orderCustomerSchema = new Schema<IOrderCustomer>({
  id: String,
  email: String,
  firstName: String,
  lastName: String,
  phone: String
}, { _id: false });

// Order Shipping Schema
const orderShippingSchema = new Schema<IOrderShipping>({
  method: String,
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  trackingNumber: String,
  carrier: String
}, { _id: false });

// Main Order Schema
const orderSchema = new Schema<IOrder>({
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
  externalOrderId: {
    type: String,
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  marketplace: {
    type: String,
    required: true,
    enum: ['shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce'],
    index: true
  },

  // Order details
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  financialStatus: String,
  fulfillmentStatus: String,

  // Order items
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: function(items: IOrderItem[]) {
        return items.length > 0;
      },
      message: 'Order must have at least one item'
    }
  },

  // Customer info
  customer: orderCustomerSchema,

  // Addresses
  billingAddress: orderAddressSchema,
  shippingAddress: orderAddressSchema,

  // Financial info
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  discountTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },

  // Shipping info
  shipping: orderShippingSchema,

  // Dates
  orderDate: {
    type: Date,
    required: true,
    index: true
  },
  shippedDate: Date,
  deliveredDate: Date,

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
orderSchema.index({ workspaceId: 1, marketplace: 1 });
orderSchema.index({ workspaceId: 1, orderDate: -1 });
orderSchema.index({ workspaceId: 1, status: 1 });
orderSchema.index({ storeConnectionId: 1, orderDate: -1 });
orderSchema.index({ externalOrderId: 1, marketplace: 1 }, { unique: true });

// Compound index for incremental sync
orderSchema.index({ storeConnectionId: 1, lastSyncDate: -1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;