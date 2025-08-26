import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { Migration, MigrationResult } from './baseMigration';
import { MigrationTracker, MigrationRecord } from './migrationTracker';
import { MigrationValidator, ValidationResult } from './migrationValidator';

export interface MigrationRunOptions {
  direction?: 'up' | 'down';
  target?: string;  // Run specific migration
  dryRun?: boolean;
  validate?: boolean;
  force?: boolean;
  environment?: string;
}

export interface MigrationRunResult {
  success: boolean;
  migrationsRun: string[];
  errors: string[];
  warnings: string[];
  totalTime: number;
}

export class MigrationRunner {
  private client: MongoClient;
  private db: Db;
  private tracker: MigrationTracker;
  private validator: MigrationValidator;
  private migrationDir: string;

  constructor(client: MongoClient, db: Db, migrationDir: string = '') {
    this.client = client;
    this.db = db;
    this.tracker = new MigrationTracker(db);
    this.validator = new MigrationValidator();
    this.migrationDir = migrationDir || path.join(__dirname, '../../migrations');
  }

  async initialize(): Promise<void> {
    await this.tracker.initializeTracker();
    this.logInfo('Migration system initialized');
  }

  async runMigrations(options: MigrationRunOptions = {}): Promise<MigrationRunResult> {
    const startTime = Date.now();
    const result: MigrationRunResult = {
      success: true,
      migrationsRun: [],
      errors: [],
      warnings: [],
      totalTime: 0
    };

    try {
      await this.initialize();

      // Validate migration files first
      const validationResult = this.validator.validateMigrationFiles(this.migrationDir);
      if (!validationResult.valid) {
        result.success = false;
        result.errors = validationResult.errors;
        result.warnings = validationResult.warnings;
        return result;
      }

      // Get available migrations
      const availableMigrations = await this.getAvailableMigrations();
      
      if (availableMigrations.length === 0) {
        this.logInfo('No migrations found');
        return result;
      }

      // Determine which migrations to run
      let migrationsToRun: Migration[] = [];

      if (options.target) {
        // Run specific migration
        const targetMigration = availableMigrations.find(m => m.id === options.target);
        if (!targetMigration) {
          result.success = false;
          result.errors.push(`Migration ${options.target} not found`);
          return result;
        }
        migrationsToRun = [targetMigration];
      } else if (options.direction === 'down') {
        // Rollback last migration
        const appliedMigrations = await this.tracker.getAppliedMigrations();
        if (appliedMigrations.length === 0) {
          this.logInfo('No migrations to rollback');
          return result;
        }
        const lastMigration = appliedMigrations[appliedMigrations.length - 1];
        const migration = availableMigrations.find(m => m.id === lastMigration);
        if (migration) {
          migrationsToRun = [migration];
        }
      } else {
        // Run pending migrations (up)
        const pendingMigrationIds = await this.tracker.getPendingMigrations(
          availableMigrations.map(m => m.id)
        );
        migrationsToRun = availableMigrations.filter(m => 
          pendingMigrationIds.includes(m.id)
        );
      }

      if (migrationsToRun.length === 0) {
        this.logInfo('No pending migrations to run');
        return result;
      }

      // Run migrations
      for (const migration of migrationsToRun) {
        try {
          const migrationResult = await this.runSingleMigration(
            migration, 
            options.direction || 'up',
            options.dryRun || false
          );

          result.migrationsRun.push(migration.id);

          if (!migrationResult.success) {
            result.success = false;
            result.errors.push(`Migration ${migration.id} failed: ${migrationResult.error}`);
            break; // Stop on first failure
          }

          // Validate migration if requested
          if (options.validate && migration.validate) {
            try {
              const isValid = await migration.validate(this.db, this.client);
              if (!isValid) {
                result.warnings.push(`Migration ${migration.id} validation failed`);
              }
            } catch (error) {
              result.warnings.push(`Migration ${migration.id} validation error: ${error}`);
            }
          }

        } catch (error) {
          result.success = false;
          result.errors.push(`Migration ${migration.id} error: ${error}`);
          break;
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration runner error: ${error}`);
    } finally {
      result.totalTime = Date.now() - startTime;
    }

    return result;
  }

  async getStatus(): Promise<{
    status: any;
    availableMigrations: string[];
    appliedMigrations: string[];
    pendingMigrations: string[];
    failedMigrations: MigrationRecord[];
  }> {
    await this.initialize();
    
    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.tracker.getAppliedMigrations();
    const pendingMigrations = await this.tracker.getPendingMigrations(
      availableMigrations.map(m => m.id)
    );
    const failedMigrations = await this.tracker.getFailedMigrations();
    const status = await this.tracker.getMigrationStatus();

    // Update pending count
    status.pending = pendingMigrations.length;

    return {
      status,
      availableMigrations: availableMigrations.map(m => m.id),
      appliedMigrations,
      pendingMigrations,
      failedMigrations
    };
  }

  private async runSingleMigration(
    migration: Migration,
    direction: 'up' | 'down',
    dryRun: boolean = false
  ): Promise<MigrationResult> {
    this.logInfo(`${dryRun ? '[DRY RUN] ' : ''}Running migration ${migration.id} (${direction})`);

    if (dryRun) {
      // In dry run mode, we just validate the migration
      const validationResult = this.validator.validateMigration(migration);
      return {
        success: validationResult.valid,
        message: validationResult.valid ? 'Dry run successful' : 'Validation failed',
        error: validationResult.errors.join(', ')
      };
    }

    // Record migration start
    if (direction === 'up') {
      await this.tracker.recordMigrationStart(migration.id, migration.description, migration.author);
    }

    try {
      // Run the migration
      const result = direction === 'up' 
        ? await migration.up(this.db, this.client)
        : await migration.down(this.db, this.client);

      // Record completion
      if (direction === 'up') {
        await this.tracker.recordMigrationComplete(migration.id, result);
      } else {
        await this.tracker.recordMigrationRollback(migration.id);
      }

      this.logInfo(
        `Migration ${migration.id} ${direction} completed in ${result.executionTime}ms. ` +
        `Documents affected: ${result.documentsAffected || 0}`
      );

      return result;

    } catch (error) {
      const errorResult: MigrationResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      if (direction === 'up') {
        await this.tracker.recordMigrationComplete(migration.id, errorResult);
      }

      this.logError(`Migration ${migration.id} ${direction} failed: ${errorResult.error}`);
      return errorResult;
    }
  }

  private async getAvailableMigrations(): Promise<Migration[]> {
    if (!fs.existsSync(this.migrationDir)) {
      this.logInfo(`Migration directory does not exist: ${this.migrationDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationDir)
      .filter(file => (file.endsWith('.js') || file.endsWith('.ts')) && !file.includes('.template'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.migrationDir, file);
        
        // Validate file before loading
        const fileValidation = this.validator.validateMigrationFile(filePath);
        if (!fileValidation.valid) {
          this.logError(`Invalid migration file ${file}: ${fileValidation.errors.join(', ')}`);
          continue;
        }

        // Load migration
        delete require.cache[require.resolve(filePath)];
        const migrationModule = require(filePath);
        const migration = migrationModule.default || migrationModule;

        // Validate migration object
        const migrationValidation = this.validator.validateMigration(migration);
        if (!migrationValidation.valid) {
          this.logError(`Invalid migration ${file}: ${migrationValidation.errors.join(', ')}`);
          continue;
        }

        migrations.push(migration);
      } catch (error) {
        this.logError(`Error loading migration ${file}: ${error}`);
      }
    }

    return migrations;
  }

  private logInfo(message: string): void {
    console.log(`[MigrationRunner] ${message}`);
  }

  private logError(message: string): void {
    console.error(`[MigrationRunner] ERROR: ${message}`);
  }
}