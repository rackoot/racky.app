import { Db, MongoClient } from 'mongodb';

export interface MigrationResult {
  success: boolean;
  documentsAffected?: number;
  message?: string;
  executionTime?: number;
  error?: string;
}

export interface Migration {
  id: string;
  description: string;
  author: string;
  createdAt: string;
  
  up(db: Db, client: MongoClient): Promise<MigrationResult>;
  down(db: Db, client: MongoClient): Promise<MigrationResult>;
  validate?(db: Db, client: MongoClient): Promise<boolean>;
}

export abstract class BaseMigration implements Migration {
  public abstract id: string;
  public abstract description: string;
  public abstract author: string;
  public abstract createdAt: string;

  public abstract up(db: Db, client: MongoClient): Promise<MigrationResult>;
  public abstract down(db: Db, client: MongoClient): Promise<MigrationResult>;
  
  public async validate(db: Db, client: MongoClient): Promise<boolean> {
    // Default implementation - migrations can override this
    return true;
  }

  protected logInfo(message: string): void {
    console.log(`[${this.id}] ${message}`);
  }

  protected logError(message: string): void {
    console.error(`[${this.id}] ERROR: ${message}`);
  }

  protected async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;
    return { result, executionTime };
  }
}