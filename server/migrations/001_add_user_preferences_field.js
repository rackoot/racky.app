const { MigrationOperations } = require('../dist/migrations/migrationOperations');

module.exports = {
  // Unique identifier - format: ###_description
  id: "001_add_user_preferences_field",
  
  // Human readable description
  description: "add user preferences field",
  
  // Migration author for tracking
  author: "nacho",
  
  // Date created (YYYY-MM-DD format)
  createdAt: "2025-08-26",
  
  /**
   * Apply the migration
   * @param {import('mongodb').Db} db - MongoDB database instance
   * @param {import('mongodb').MongoClient} client - MongoDB client instance
   * @returns {Promise<import('../src/migrations/baseMigration').MigrationResult>}
   */
  async up(db, client) {
    console.log(`Running migration ${this.id}...`);
    const operations = new MigrationOperations(db, client);
    const startTime = Date.now();
    
    try {
      // Add preferences field to all existing users
      const result = await operations.addField('users', 'preferences', {
        theme: 'light',
        notifications: true,
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY'
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add preferences field');
      }
      
      console.log(`✅ Added preferences field to ${result.documentsAffected} users`);
      
      return {
        success: true,
        documentsAffected: result.documentsAffected,
        executionTime: Date.now() - startTime,
        message: `Added preferences field to ${result.documentsAffected} users`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  },
  
  /**
   * Rollback the migration
   * @param {import('mongodb').Db} db - MongoDB database instance
   * @param {import('mongodb').MongoClient} client - MongoDB client instance
   * @returns {Promise<import('../src/migrations/baseMigration').MigrationResult>}
   */
  async down(db, client) {
    console.log(`Rolling back migration ${this.id}...`);
    const operations = new MigrationOperations(db, client);
    const startTime = Date.now();
    
    try {
      // Remove preferences field from all users
      const result = await operations.removeField('users', 'preferences');
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove preferences field');
      }
      
      console.log(`✅ Removed preferences field from ${result.documentsAffected} users`);
      
      return {
        success: true,
        documentsAffected: result.documentsAffected,
        executionTime: Date.now() - startTime,
        message: `Removed preferences field from ${result.documentsAffected} users`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  },
  
  /**
   * Validate that the migration was applied correctly (optional)
   * @param {import('mongodb').Db} db - MongoDB database instance
   * @param {import('mongodb').MongoClient} client - MongoDB client instance
   * @returns {Promise<boolean>}
   */
  async validate(db, client) {
    try {
      // Check that preferences field was added to all users
      const usersWithoutPreferences = await db.collection('users').countDocuments({
        preferences: { $exists: false }
      });
      
      if (usersWithoutPreferences > 0) {
        throw new Error(`${usersWithoutPreferences} users still missing preferences field`);
      }
      
      // Check that preferences field has the correct structure
      const userWithBadPreferences = await db.collection('users').findOne({
        $or: [
          { 'preferences.theme': { $exists: false } },
          { 'preferences.notifications': { $exists: false } },
          { 'preferences.language': { $exists: false } },
          { 'preferences.timezone': { $exists: false } },
          { 'preferences.dateFormat': { $exists: false } }
        ]
      });
      
      if (userWithBadPreferences) {
        throw new Error('Some users have incomplete preferences field structure');
      }

      console.log(`✅ Migration ${this.id} validation passed`);
      return true;
      
    } catch (error) {
      console.error(`Migration ${this.id} validation failed:`, error);
      return false;
    }
  }
};