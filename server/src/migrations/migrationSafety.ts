import { Db, MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export interface BackupOptions {
  outputDir?: string;
  includeCollections?: string[];
  excludeCollections?: string[];
  compress?: boolean;
}

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  size?: number;
  collections?: string[];
  error?: string;
  timestamp: Date;
}

export interface SafetyCheckResult {
  safe: boolean;
  warnings: string[];
  blockers: string[];
  environment: string;
  diskSpace?: number;
  collectionSizes?: { [key: string]: number };
}

export class MigrationSafety {
  private db: Db;
  private client: MongoClient;

  constructor(db: Db, client: MongoClient) {
    this.db = db;
    this.client = client;
  }

  /**
   * Perform comprehensive safety checks before running migrations
   */
  async performSafetyChecks(destructive: boolean = false): Promise<SafetyCheckResult> {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const environment = process.env.NODE_ENV || 'development';

    // Environment checks
    if (environment === 'production' && destructive) {
      blockers.push('Destructive operations require explicit confirmation in production');
    }

    // Database connection check
    try {
      await this.db.admin().ping();
    } catch (error) {
      blockers.push('Database connection failed');
    }

    // Check for concurrent migrations
    try {
      const runningMigrations = await this.db.collection('migrations')
        .countDocuments({ status: 'running' });
      
      if (runningMigrations > 0) {
        blockers.push(`${runningMigrations} migration(s) already running`);
      }
    } catch (error) {
      warnings.push('Could not check for concurrent migrations');
    }

    // Disk space check
    let diskSpace: number | undefined;
    try {
      diskSpace = await this.checkDiskSpace();
      if (diskSpace !== undefined && diskSpace < 1000) { // Less than 1GB
        warnings.push(`Low disk space: ${Math.round(diskSpace)}MB available`);
      }
      if (diskSpace !== undefined && diskSpace < 100) { // Less than 100MB
        blockers.push(`Insufficient disk space: ${Math.round(diskSpace)}MB available`);
      }
    } catch (error) {
      warnings.push('Could not check disk space');
    }

    // Collection size check
    let collectionSizes: { [key: string]: number } | undefined;
    try {
      collectionSizes = await this.getCollectionSizes();
      const totalSize = Object.values(collectionSizes).reduce((sum, size) => sum + size, 0);
      
      if (totalSize > 10 * 1024 * 1024 * 1024) { // 10GB
        warnings.push(`Large database detected: ${this.formatBytes(totalSize)}`);
      }
    } catch (error) {
      warnings.push('Could not analyze collection sizes');
    }

    // MongoDB version compatibility
    try {
      const serverInfo = await this.db.admin().serverStatus();
      const version = serverInfo.version;
      
      // Check for known compatibility issues
      if (version.startsWith('3.')) {
        warnings.push('MongoDB 3.x detected - some features may not be available');
      }
    } catch (error) {
      warnings.push('Could not determine MongoDB version');
    }

    return {
      safe: blockers.length === 0,
      warnings,
      blockers,
      environment,
      diskSpace,
      collectionSizes
    };
  }

  /**
   * Create a backup of the database before running migrations
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const timestamp = new Date();
    const backupName = `racky_backup_${timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const outputDir = options.outputDir || path.join(process.cwd(), 'backups');
    const backupPath = path.join(outputDir, backupName);

    // Ensure backup directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';
      const dbName = this.db.databaseName;
      
      // Build mongodump command
      const mongodumpArgs = [
        '--uri', mongoUri,
        '--out', backupPath
      ];

      // Add collection filters if specified
      if (options.includeCollections && options.includeCollections.length > 0) {
        for (const collection of options.includeCollections) {
          mongodumpArgs.push('--collection', collection);
        }
      }

      if (options.excludeCollections && options.excludeCollections.length > 0) {
        for (const collection of options.excludeCollections) {
          mongodumpArgs.push('--excludeCollection', collection);
        }
      }

      // Run mongodump
      await this.runCommand('mongodump', mongodumpArgs);

      // Get backup info
      const stats = fs.statSync(backupPath);
      const collections = await this.getBackupCollections(backupPath, dbName);
      
      return {
        success: true,
        backupPath,
        size: this.getDirectorySize(backupPath),
        collections,
        timestamp
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp
      };
    }
  }

  /**
   * Restore database from a backup
   */
  async restoreFromBackup(backupPath: string): Promise<BackupResult> {
    const timestamp = new Date();

    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup path does not exist: ${backupPath}`);
      }

      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';
      
      // Build mongorestore command
      const mongorestoreArgs = [
        '--uri', mongoUri,
        '--dir', backupPath,
        '--drop' // Drop collections before restoring
      ];

      // Run mongorestore
      await this.runCommand('mongorestore', mongorestoreArgs);

      return {
        success: true,
        backupPath,
        timestamp,
        collections: await this.getBackupCollections(backupPath, this.db.databaseName)
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp
      };
    }
  }

  /**
   * Check available disk space in MB
   */
  private async checkDiskSpace(): Promise<number | undefined> {
    try {
      const { execSync } = require('child_process');
      const platform = process.platform;
      
      let command: string;
      if (platform === 'darwin' || platform === 'linux') {
        command = "df -m . | tail -1 | awk '{print $4}'";
      } else if (platform === 'win32') {
        command = 'dir /-c | find "bytes free"';
      } else {
        return undefined;
      }
      
      const output = execSync(command, { encoding: 'utf8' });
      
      if (platform === 'win32') {
        const match = output.match(/(\d+) bytes free/);
        return match ? parseInt(match[1]) / (1024 * 1024) : undefined;
      } else {
        return parseInt(output.trim());
      }
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get sizes of all collections in the database
   */
  private async getCollectionSizes(): Promise<{ [key: string]: number }> {
    const collections = await this.db.listCollections().toArray();
    const sizes: { [key: string]: number } = {};

    for (const collection of collections) {
      try {
        const stats = await this.db.command({ collStats: collection.name });
        sizes[collection.name] = stats.size || 0;
      } catch (error) {
        sizes[collection.name] = 0;
      }
    }

    return sizes;
  }

  /**
   * Run a command as a child process
   */
  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get list of collections from a backup directory
   */
  private async getBackupCollections(backupPath: string, dbName: string): Promise<string[]> {
    try {
      const dbBackupPath = path.join(backupPath, dbName);
      if (!fs.existsSync(dbBackupPath)) {
        return [];
      }

      const files = fs.readdirSync(dbBackupPath);
      return files
        .filter(file => file.endsWith('.bson'))
        .map(file => file.replace('.bson', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get total size of a directory recursively
   */
  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return totalSize;
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath: string): Promise<{
    valid: boolean;
    collections: number;
    totalSize: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let collections = 0;
    let totalSize = 0;

    try {
      const dbBackupPath = path.join(backupPath, this.db.databaseName);
      
      if (!fs.existsSync(dbBackupPath)) {
        errors.push('Database backup directory not found');
        return { valid: false, collections: 0, totalSize: 0, errors };
      }

      const files = fs.readdirSync(dbBackupPath);
      
      for (const file of files) {
        if (file.endsWith('.bson')) {
          collections++;
          const filePath = path.join(dbBackupPath, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;

          // Basic file integrity check
          if (stats.size === 0) {
            errors.push(`Empty backup file: ${file}`);
          }
        }
      }

      if (collections === 0) {
        errors.push('No collection backups found');
      }

    } catch (error) {
      errors.push(`Backup verification failed: ${error}`);
    }

    return {
      valid: errors.length === 0,
      collections,
      totalSize,
      errors
    };
  }
}