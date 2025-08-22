import mongoose from 'mongoose';
import getEnv from './env';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(getEnv().MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

export default connectDB;