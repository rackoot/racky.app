import { Db, Collection } from 'mongodb';
import { MigrationResult } from './baseMigration';

export interface MigrationRecord {
  _id?: string;
  migrationId: string;
  description: string;
  appliedAt: Date;
  author: string;
  environment: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  executionTime?: number;
  documentsAffected?: number;
  rollbackInfo?: any;
  error?: string;
}

export class MigrationTracker {
  private db: Db;
  private collection: Collection<MigrationRecord>;
  private readonly COLLECTION_NAME = 'migrations';

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<MigrationRecord>(this.COLLECTION_NAME);
  }

  async initializeTracker(): Promise<void> {
    // Create migrations collection if it doesn't exist
    const collections = await this.db.listCollections({ name: this.COLLECTION_NAME }).toArray();
    
    if (collections.length === 0) {
      await this.db.createCollection(this.COLLECTION_NAME);
      console.log('Created migrations tracking collection');
    }

    // Create indexes for better performance
    await this.collection.createIndexes([
      { key: { migrationId: 1 }, unique: true },
      { key: { appliedAt: -1 } },
      { key: { status: 1 } }
    ]);
  }

  async getAppliedMigrations(): Promise<string[]> {
    const migrations = await this.collection
      .find({ status: 'completed' })
      .sort({ appliedAt: 1 })
      .toArray();
    
    return migrations.map(m => m.migrationId);
  }

  async getMigrationRecord(migrationId: string): Promise<MigrationRecord | null> {
    return await this.collection.findOne({ migrationId });
  }

  async getAllMigrationRecords(): Promise<MigrationRecord[]> {
    return await this.collection
      .find({})
      .sort({ appliedAt: -1 })
      .toArray();
  }

  async recordMigrationStart(
    migrationId: string, 
    description: string, 
    author: string
  ): Promise<void> {
    const record: MigrationRecord = {
      migrationId,
      description,
      appliedAt: new Date(),
      author,
      environment: process.env.NODE_ENV || 'development',
      status: 'running'
    };

    await this.collection.updateOne(
      { migrationId },
      { $set: record },
      { upsert: true }
    );
  }

  async recordMigrationComplete(
    migrationId: string, 
    result: MigrationResult,
    rollbackInfo?: any
  ): Promise<void> {
    const updateData: Partial<MigrationRecord> = {
      status: result.success ? 'completed' : 'failed',
      executionTime: result.executionTime,
      documentsAffected: result.documentsAffected,
      rollbackInfo
    };

    if (!result.success && result.error) {
      updateData.error = result.error;
    }

    await this.collection.updateOne(
      { migrationId },
      { $set: updateData }
    );
  }

  async recordMigrationRollback(migrationId: string): Promise<void> {
    await this.collection.updateOne(
      { migrationId },
      { $set: { status: 'rolled_back', appliedAt: new Date() } }
    );
  }

  async getFailedMigrations(): Promise<MigrationRecord[]> {
    return await this.collection
      .find({ status: 'failed' })
      .sort({ appliedAt: -1 })
      .toArray();
  }

  async getPendingMigrations(allMigrationIds: string[]): Promise<string[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    return allMigrationIds.filter(id => !appliedMigrations.includes(id));
  }

  async getMigrationStatus(): Promise<{
    total: number;
    applied: number;
    pending: number;
    failed: number;
    lastMigration?: MigrationRecord;
  }> {
    const allRecords = await this.getAllMigrationRecords();
    const applied = allRecords.filter(r => r.status === 'completed');
    const failed = allRecords.filter(r => r.status === 'failed');
    
    return {
      total: allRecords.length,
      applied: applied.length,
      pending: 0, // Will be calculated by migration runner
      failed: failed.length,
      lastMigration: allRecords[0] // Most recent due to sort order
    };
  }
}