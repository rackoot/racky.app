import { Db, Collection, CreateIndexesOptions, IndexSpecification, MongoClient } from 'mongodb';
import { MigrationResult } from './baseMigration';

export class MigrationOperations {
  private db: Db;
  private client: MongoClient;

  constructor(db: Db, client: MongoClient) {
    this.db = db;
    this.client = client;
  }

  /**
   * Add a field with default value to all documents in a collection
   */
  async addField(
    collectionName: string,
    fieldName: string,
    defaultValue: any,
    filter: object = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      const collection = this.db.collection(collectionName);
      
      // Build the query to find documents without the field
      const queryFilter = { 
        ...filter,
        [fieldName]: { $exists: false } 
      };

      const result = await collection.updateMany(
        queryFilter,
        { $set: { [fieldName]: defaultValue } }
      );

      return {
        success: true,
        documentsAffected: result.modifiedCount,
        executionTime: Date.now() - startTime,
        message: `Added field '${fieldName}' to ${result.modifiedCount} documents in ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Remove a field from all documents in a collection
   */
  async removeField(
    collectionName: string,
    fieldName: string,
    filter: object = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      const collection = this.db.collection(collectionName);
      
      const result = await collection.updateMany(
        filter,
        { $unset: { [fieldName]: 1 } }
      );

      return {
        success: true,
        documentsAffected: result.modifiedCount,
        executionTime: Date.now() - startTime,
        message: `Removed field '${fieldName}' from ${result.modifiedCount} documents in ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Rename a field in all documents in a collection
   */
  async renameField(
    collectionName: string,
    oldFieldName: string,
    newFieldName: string,
    filter: object = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      const collection = this.db.collection(collectionName);
      
      const result = await collection.updateMany(
        filter,
        { $rename: { [oldFieldName]: newFieldName } }
      );

      return {
        success: true,
        documentsAffected: result.modifiedCount,
        executionTime: Date.now() - startTime,
        message: `Renamed field '${oldFieldName}' to '${newFieldName}' in ${result.modifiedCount} documents in ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Transform field values using a custom function
   */
  async transformField(
    collectionName: string,
    fieldName: string,
    transformFn: (value: any) => any,
    filter: object = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    let documentsAffected = 0;
    
    try {
      const collection = this.db.collection(collectionName);
      
      // Get documents that need transformation
      const queryFilter = {
        ...filter,
        [fieldName]: { $exists: true }
      };

      const cursor = collection.find(queryFilter);
      
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (doc && doc[fieldName] !== undefined) {
          try {
            const transformedValue = transformFn(doc[fieldName]);
            
            await collection.updateOne(
              { _id: doc._id },
              { $set: { [fieldName]: transformedValue } }
            );
            
            documentsAffected++;
          } catch (transformError) {
            console.warn(`Failed to transform document ${doc._id}: ${transformError}`);
          }
        }
      }

      return {
        success: true,
        documentsAffected,
        executionTime: Date.now() - startTime,
        message: `Transformed field '${fieldName}' in ${documentsAffected} documents in ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create an index on a collection
   */
  async createIndex(
    collectionName: string,
    indexSpec: IndexSpecification,
    options: CreateIndexesOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      const collection = this.db.collection(collectionName);
      
      const indexName = await collection.createIndex(indexSpec, options);

      return {
        success: true,
        executionTime: Date.now() - startTime,
        message: `Created index '${indexName}' on ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Drop an index from a collection
   */
  async dropIndex(
    collectionName: string,
    indexName: string
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      const collection = this.db.collection(collectionName);
      
      await collection.dropIndex(indexName);

      return {
        success: true,
        executionTime: Date.now() - startTime,
        message: `Dropped index '${indexName}' from ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Insert seed data into a collection
   */
  async insertSeedData(
    collectionName: string,
    documents: any[],
    options: { upsert?: boolean; upsertKey?: string } = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      const collection = this.db.collection(collectionName);
      let documentsAffected = 0;

      if (options.upsert && options.upsertKey) {
        // Use upsert with a specific key
        for (const doc of documents) {
          const result = await collection.updateOne(
            { [options.upsertKey]: doc[options.upsertKey] },
            { $set: doc },
            { upsert: true }
          );
          
          if (result.upsertedCount > 0 || result.modifiedCount > 0) {
            documentsAffected++;
          }
        }
      } else {
        // Simple insert
        const result = await collection.insertMany(documents);
        documentsAffected = result.insertedCount;
      }

      return {
        success: true,
        documentsAffected,
        executionTime: Date.now() - startTime,
        message: `Inserted/updated ${documentsAffected} documents in ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Remove documents from a collection
   */
  async removeDocuments(
    collectionName: string,
    filter: object
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      const collection = this.db.collection(collectionName);
      
      const result = await collection.deleteMany(filter);

      return {
        success: true,
        documentsAffected: result.deletedCount,
        executionTime: Date.now() - startTime,
        message: `Removed ${result.deletedCount} documents from ${collectionName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create a new collection with optional validation schema
   */
  async createCollection(
    collectionName: string,
    options: {
      validator?: object;
      validationLevel?: 'off' | 'strict' | 'moderate';
      validationAction?: 'error' | 'warn';
    } = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      await this.db.createCollection(collectionName, options);

      return {
        success: true,
        executionTime: Date.now() - startTime,
        message: `Created collection '${collectionName}'`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Drop a collection
   */
  async dropCollection(collectionName: string): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      await this.db.dropCollection(collectionName);

      return {
        success: true,
        executionTime: Date.now() - startTime,
        message: `Dropped collection '${collectionName}'`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Count documents in a collection matching a filter
   */
  async countDocuments(collectionName: string, filter: object = {}): Promise<number> {
    const collection = this.db.collection(collectionName);
    return await collection.countDocuments(filter);
  }

  /**
   * Get a sample of documents for testing transformations
   */
  async getSampleDocuments(collectionName: string, limit: number = 5): Promise<any[]> {
    const collection = this.db.collection(collectionName);
    return await collection.find({}).limit(limit).toArray();
  }

  /**
   * Execute multiple operations in a transaction (if supported)
   */
  async executeInTransaction(operations: (() => Promise<MigrationResult>)[]): Promise<MigrationResult> {
    const startTime = Date.now();
    const client = this.client;
    
    const session = client.startSession();
    
    try {
      let totalDocumentsAffected = 0;
      const results: string[] = [];

      await session.withTransaction(async () => {
        for (const operation of operations) {
          const result = await operation();
          
          if (!result.success) {
            throw new Error(result.error || 'Operation failed');
          }
          
          totalDocumentsAffected += result.documentsAffected || 0;
          if (result.message) {
            results.push(result.message);
          }
        }
      });

      return {
        success: true,
        documentsAffected: totalDocumentsAffected,
        executionTime: Date.now() - startTime,
        message: `Transaction completed: ${results.join('; ')}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    } finally {
      await session.endSession();
    }
  }
}