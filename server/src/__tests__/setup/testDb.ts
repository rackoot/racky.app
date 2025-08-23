import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

export const setupTestDb = async (): Promise<void> => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.0',
    },
    instance: {
      dbName: 'racky-test',
    },
  });

  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
};

export const teardownTestDb = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
};

export const clearTestDb = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};

export const getTestDbUri = (): string => {
  return mongoServer?.getUri() || '';
};