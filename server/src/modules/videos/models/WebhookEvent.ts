import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  endpoint: string;
  payload: any;
  createdAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>({
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

export default mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
