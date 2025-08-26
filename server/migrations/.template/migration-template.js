const { MigrationOperations } = require('../dist/migrations/migrationOperations');

module.exports = {
  // Unique identifier - format: ###_description
  id: "__MIGRATION_ID__",
  
  // Human readable description
  description: "__MIGRATION_DESCRIPTION__",
  
  // Migration author for tracking
  author: "__MIGRATION_AUTHOR__",
  
  // Date created (YYYY-MM-DD format)
  createdAt: "__MIGRATION_DATE__",
  
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
      // Example operations - replace with your actual migration logic
      
      // Add a new field with default value
      // const result = await operations.addField('users', 'preferences', {
      //   theme: 'light',
      //   notifications: true
      // });
      
      // Create an index
      // const indexResult = await operations.createIndex('products', 
      //   { workspaceId: 1, marketplace: 1 }, 
      //   { background: true }
      // );
      
      // Transform existing data
      // const transformResult = await operations.transformField('products', 'price', 
      //   (value) => typeof value === 'string' ? parseFloat(value) : value
      // );
      
      // Insert seed data
      // const seedResult = await operations.insertSeedData('plans', [
      //   { name: 'Basic', price: 29, features: ['feature1', 'feature2'] }
      // ], { upsert: true, upsertKey: 'name' });

      // REPLACE THIS WITH YOUR ACTUAL MIGRATION LOGIC
      console.log('No operations defined - replace with actual migration logic');
      
      return {
        success: true,
        documentsAffected: 0,
        executionTime: Date.now() - startTime,
        message: 'Migration completed successfully'
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
      // Example rollback operations - replace with your actual rollback logic
      
      // Remove field added in up()
      // const result = await operations.removeField('users', 'preferences');
      
      // Drop index created in up()
      // const indexResult = await operations.dropIndex('products', 'workspaceId_1_marketplace_1');
      
      // Remove seed data inserted in up()
      // const removeResult = await operations.removeDocuments('plans', { name: 'Basic' });

      // REPLACE THIS WITH YOUR ACTUAL ROLLBACK LOGIC
      console.log('No rollback operations defined - replace with actual rollback logic');
      
      return {
        success: true,
        documentsAffected: 0,
        executionTime: Date.now() - startTime,
        message: 'Migration rollback completed successfully'
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
      // Example validations - replace with your actual validation logic
      
      // Check that field was added
      // const usersWithoutPreferences = await db.collection('users').countDocuments({
      //   preferences: { $exists: false }
      // });
      // if (usersWithoutPreferences > 0) {
      //   throw new Error(`${usersWithoutPreferences} users still missing preferences field`);
      // }
      
      // Check that index was created
      // const indexes = await db.collection('products').indexes();
      // const hasIndex = indexes.some(index => 
      //   index.name === 'workspaceId_1_marketplace_1'
      // );
      // if (!hasIndex) {
      //   throw new Error('Required index was not created');
      // }
      
      // Check that seed data was inserted
      // const planCount = await db.collection('plans').countDocuments({ name: 'Basic' });
      // if (planCount === 0) {
      //   throw new Error('Required seed data was not inserted');
      // }

      console.log(`Migration ${this.id} validation passed`);
      return true;
      
    } catch (error) {
      console.error(`Migration ${this.id} validation failed:`, error);
      return false;
    }
  }
};