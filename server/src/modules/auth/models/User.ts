import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
// Note: These imports may cause circular dependencies and should be handled carefully
// import Subscription from '../../subscriptions/models/Subscription';
// import Plan from '../../subscriptions/models/Plan';
// import StoreConnection from '../../stores/models/StoreConnection';
// import Product from '../../products/models/Product';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'SUPERADMIN';
  isActive: boolean;
  companyName?: string;
  timezone: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  matchPassword(enteredPassword: string): Promise<boolean>;
  isSuperAdmin(): boolean;
  getFullName(): string;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['USER', 'SUPERADMIN'],
    default: 'USER'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Company Information (optional)
  companyName: {
    type: String,
    trim: true
  },
  // Billing Integration moved to workspace level
  // User Preferences
  timezone: {
    type: String,
    default: 'UTC'
  },
  language: {
    type: String,
    default: 'en'
  }
}, {
  timestamps: true
});

userSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user is a SUPERADMIN
userSchema.methods.isSuperAdmin = function(): boolean {
  return this.role === 'SUPERADMIN';
};


// Get user's full name
userSchema.methods.getFullName = function(): string {
  return `${this.firstName} ${this.lastName}`;
};


// Indexes for efficient querying
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ isActive: 1 });

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;