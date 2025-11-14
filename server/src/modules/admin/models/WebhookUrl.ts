import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookUrl extends Document {
  name: string;
  description: string;
  url: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookUrlSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Webhook name is required'],
      trim: true,
      minlength: [3, 'Webhook name must be at least 3 characters'],
      maxlength: [100, 'Webhook name must be less than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be less than 500 characters'],
      default: '',
    },
    url: {
      type: String,
      required: [true, 'Webhook URL is required'],
      trim: true,
      unique: true,
      validate: {
        validator: function (v: string) {
          // Validate URL format (must be http or https)
          try {
            const url = new URL(v);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Please provide a valid HTTP or HTTPS URL',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
WebhookUrlSchema.index({ url: 1 });
WebhookUrlSchema.index({ isActive: 1 });
WebhookUrlSchema.index({ createdAt: -1 });

export default mongoose.model<IWebhookUrl>('WebhookUrl', WebhookUrlSchema);
