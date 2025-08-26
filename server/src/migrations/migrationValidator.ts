import { Migration } from './baseMigration';
import fs from 'fs';
import path from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class MigrationValidator {
  
  /**
   * Validate a migration object for completeness and correctness
   */
  validateMigration(migration: Migration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!migration.id || migration.id.trim() === '') {
      errors.push('Migration ID is required');
    }

    if (!migration.description || migration.description.trim() === '') {
      errors.push('Migration description is required');
    }

    if (!migration.author || migration.author.trim() === '') {
      errors.push('Migration author is required');
    }

    if (!migration.createdAt || migration.createdAt.trim() === '') {
      errors.push('Migration createdAt date is required');
    }

    // ID format validation
    if (migration.id && !this.isValidMigrationId(migration.id)) {
      errors.push('Migration ID must follow format: ###_description (e.g., 001_add_user_preferences)');
    }

    // Date format validation
    if (migration.createdAt && !this.isValidDate(migration.createdAt)) {
      warnings.push('Migration createdAt should be in YYYY-MM-DD format');
    }

    // Method validation
    if (typeof migration.up !== 'function') {
      errors.push('Migration must have an up() method');
    }

    if (typeof migration.down !== 'function') {
      errors.push('Migration must have a down() method');
    }

    // Optional validation method check
    if (migration.validate && typeof migration.validate !== 'function') {
      errors.push('Migration validate() must be a function if provided');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate migration file naming and sequencing
   */
  validateMigrationFiles(migrationDir: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const files = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
        .filter(file => !file.includes('.template'))
        .sort();

      const numbers = files.map(file => {
        const match = file.match(/^(\d{3})_/);
        return match ? parseInt(match[1]) : null;
      });

      // Check for missing numbers in sequence
      for (let i = 0; i < numbers.length; i++) {
        const num = numbers[i];
        if (num === null) {
          errors.push(`File ${files[i]} doesn't follow naming convention ###_description`);
          continue;
        }

        const expectedNum = i + 1;
        if (num !== expectedNum) {
          if (num > expectedNum) {
            errors.push(`Missing migration number ${String(expectedNum).padStart(3, '0')} (found ${String(num).padStart(3, '0')})`);
          } else {
            errors.push(`Migration number ${String(num).padStart(3, '0')} is out of sequence`);
          }
        }
      }

      // Check for duplicate numbers
      const duplicates = numbers.filter((num, index) => numbers.indexOf(num) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate migration numbers found: ${duplicates.join(', ')}`);
      }

    } catch (error) {
      errors.push(`Cannot read migration directory: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate migration ID format
   */
  private isValidMigrationId(id: string): boolean {
    return /^\d{3}_[a-z0-9_]+$/.test(id);
  }

  /**
   * Validate date format
   */
  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  /**
   * Get next migration number based on existing files
   */
  getNextMigrationNumber(migrationDir: string): string {
    try {
      const files = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
        .filter(file => !file.includes('.template'));

      const numbers = files.map(file => {
        const match = file.match(/^(\d{3})_/);
        return match ? parseInt(match[1]) : 0;
      });

      const maxNumber = Math.max(0, ...numbers);
      return String(maxNumber + 1).padStart(3, '0');
    } catch (error) {
      return '001';
    }
  }

  /**
   * Validate migration file exists and can be loaded
   */
  validateMigrationFile(filePath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        errors.push(`Migration file does not exist: ${filePath}`);
        return { valid: false, errors, warnings };
      }

      // Try to require the file (basic syntax check)
      delete require.cache[require.resolve(filePath)];
      const migrationModule = require(filePath);

      if (!migrationModule || typeof migrationModule !== 'object') {
        errors.push('Migration file must export an object');
      }

      if (migrationModule.default) {
        warnings.push('Migration uses ES6 export default, consider using module.exports');
      }

    } catch (error) {
      errors.push(`Cannot load migration file: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}