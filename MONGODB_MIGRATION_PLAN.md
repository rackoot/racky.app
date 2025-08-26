# MongoDB Migration and Database Maintenance System - Implementation Plan

## Problem Statement
Team development with MongoDB faces critical synchronization issues:
- **Schema Drift**: Team members have inconsistent database states when someone adds new fields/collections
- **No Migration Support**: MongoDB lacks built-in migration system like SQL databases
- **Manual Fixes**: Developers manually update their local databases, leading to errors
- **Onboarding Issues**: New developers struggle to get proper database state
- **No Rollback**: No way to safely undo problematic schema changes
- **Missing Documentation**: No record of when/why database changes were made

## Current State Analysis
**Existing Database Structure:**
- Location: `/server/src/modules/*/models/*.ts`
- Models: User, Workspace, WorkspaceUser, Product, StoreConnection, Subscription, Plan, Usage, Opportunity, Suggestion, etc.
- Current Setup: Basic setup scripts in `/server/scripts/` (setup.js, create-admin.js, create-plans.js)
- Database Config: `/server/src/common/config/database.ts` - simple Mongoose connection

**Team Pain Points Identified:**
1. When developer A adds a new field to User model, developer B's local database still has old schema
2. No way to add default values to existing documents when schema changes
3. No tracking of what database changes have been applied
4. Complex manual coordination required for database changes

## Comprehensive Solution: 5-Phase Migration System

### Phase 1: Migration Infrastructure Foundation
**Core Components to Build:**
- Migration tracking collection in MongoDB to record applied migrations
- Migration file structure and naming conventions
- Base migration runner engine
- CLI command system for team usage

**Files to Create:**
```
/server/src/migrations/
├── migrationRunner.ts          # Core engine that runs migrations
├── baseMigration.ts           # Abstract class for all migrations
├── migrationTracker.ts        # Tracks which migrations have run
└── migrationValidator.ts      # Validates migration integrity

/server/scripts/
├── migrate.js                 # CLI script for running migrations
├── create-migration.js        # Generate new migration files
└── migration-status.js        # Check migration status

/server/migrations/
├── .template/
│   └── migration-template.js  # Template for new migrations
└── [future migration files will go here]
```

### Phase 2: Migration Types and Operations
**Support for MongoDB Common Operations:**

1. **Add Fields with Defaults:**
   ```javascript
   // Add preferences to all existing users
   await db.collection('users').updateMany(
     { preferences: { $exists: false } },
     { $set: { preferences: { theme: 'light', notifications: true } } }
   );
   ```

2. **Remove Deprecated Fields:**
   ```javascript
   // Remove old field from all documents
   await db.collection('products').updateMany(
     {},
     { $unset: { oldField: 1 } }
   );
   ```

3. **Rename Fields:**
   ```javascript
   // Rename field while preserving data
   await db.collection('stores').updateMany(
     {},
     { $rename: { "oldName": "newName" } }
   );
   ```

4. **Transform Data Types:**
   ```javascript
   // Convert string dates to Date objects
   const docs = await db.collection('products').find({ createdAt: { $type: "string" } });
   for (let doc of docs) {
     await db.collection('products').updateOne(
       { _id: doc._id },
       { $set: { createdAt: new Date(doc.createdAt) } }
     );
   }
   ```

5. **Create Indexes:**
   ```javascript
   // Add performance indexes
   await db.collection('products').createIndex({ workspaceId: 1, marketplace: 1 });
   ```

6. **Seed Data:**
   ```javascript
   // Add new required data
   await db.collection('plans').insertMany([...newPlans]);
   ```

### Phase 3: Migration File Structure and Workflow
**Migration File Naming Convention:**
```
001_add_user_preferences.js
002_update_product_schema.js  
003_create_ai_suggestions_collection.js
004_migrate_workspace_data.js
005_add_marketplace_indexes.js
```

**Migration File Template:**
```javascript
module.exports = {
  // Unique identifier
  id: "001_add_user_preferences",
  
  // Human readable description
  description: "Add preferences field to all existing users with default values",
  
  // Migration author for tracking
  author: "developer-name",
  
  // Date created
  createdAt: "2024-01-15",
  
  // Apply the migration
  async up(db, client) {
    console.log('Adding user preferences...');
    
    const result = await db.collection('users').updateMany(
      { preferences: { $exists: false } },
      { 
        $set: { 
          preferences: { 
            theme: 'light', 
            notifications: true,
            language: 'en' 
          } 
        } 
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users`);
    return result;
  },
  
  // Rollback the migration
  async down(db, client) {
    console.log('Removing user preferences...');
    
    const result = await db.collection('users').updateMany(
      {},
      { $unset: { preferences: 1 } }
    );
    
    console.log(`Removed preferences from ${result.modifiedCount} users`);
    return result;
  },
  
  // Validate migration was applied correctly
  async validate(db, client) {
    const usersWithoutPreferences = await db.collection('users').countDocuments({
      preferences: { $exists: false }
    });
    
    if (usersWithoutPreferences > 0) {
      throw new Error(`${usersWithoutPreferences} users still missing preferences`);
    }
    
    return true;
  }
};
```

### Phase 4: CLI and Team Integration
**Package.json Script Updates:**
```json
{
  "scripts": {
    "migrate": "node scripts/migrate.js",
    "migrate:create": "node scripts/create-migration.js",
    "migrate:up": "node scripts/migrate.js --up",
    "migrate:down": "node scripts/migrate.js --down",
    "migrate:status": "node scripts/migrate.js --status",
    "migrate:reset": "node scripts/migrate.js --reset --confirm",
    "migrate:validate": "node scripts/migrate.js --validate"
  }
}
```

**Team Workflow Commands:**
```bash
# Create a new migration
npm run migrate:create "add user preferences"

# Check what migrations need to run
npm run migrate:status

# Run all pending migrations
npm run migrate

# Run specific migration
npm run migrate -- --only 001_add_user_preferences

# Rollback last migration
npm run migrate:down

# Validate all migrations applied correctly
npm run migrate:validate

# Reset database to clean state (dev only)
npm run migrate:reset --confirm
```

### Phase 5: Advanced Features for Production

**Migration Tracking Collection:**
```javascript
// Collection: migrations
{
  _id: ObjectId(),
  migrationId: "001_add_user_preferences", 
  description: "Add preferences field to all existing users",
  appliedAt: ISODate(),
  author: "developer-name",
  environment: "development", // development, staging, production
  status: "completed", // pending, running, completed, failed, rolled_back
  executionTime: 1234, // milliseconds
  documentsAffected: 150,
  rollbackInfo: { ... } // Data needed for rollback
}
```

**Safety Features:**
1. **Backup Integration**: Automatic backup before destructive operations
2. **Dry Run Mode**: Test migrations without applying them
3. **Progress Tracking**: Show progress for large operations
4. **Atomic Operations**: Use transactions where possible
5. **Rollback Safety**: Store rollback data before applying migrations

**Environment Handling:**
- Development: Allow reset, more verbose logging
- Staging: Require confirmation for destructive operations  
- Production: Extra safety checks, mandatory backups

**Team Coordination:**
- Git hooks to check for pending migrations
- Slack/Discord notifications when migrations are run
- Migration documentation in pull requests
- Team migration dashboard (future enhancement)

## Implementation Benefits

### For Individual Developers:
- ✅ **Consistent State**: Always have the correct database schema
- ✅ **Easy Updates**: Single command to apply all changes
- ✅ **Safe Rollbacks**: Undo problematic changes easily
- ✅ **Clear History**: See what changed and when

### For Team Collaboration:
- ✅ **No More Manual Coordination**: Migrations handle synchronization
- ✅ **Easier Code Reviews**: Database changes are documented in code
- ✅ **Faster Onboarding**: New developers get correct state immediately
- ✅ **Reduced Bugs**: Eliminate database inconsistency bugs

### For Production Operations:
- ✅ **Version Control**: Database changes tracked in git with code
- ✅ **Deployment Integration**: Migrations run automatically during deploys
- ✅ **Audit Trail**: Complete history of all database changes
- ✅ **Disaster Recovery**: Ability to recreate database from scratch

## Next Steps for Implementation

### Priority Order:
1. **Start with Migration Infrastructure** (Phase 1) - Build the foundation
2. **Create First Migration** - Test with simple field addition
3. **Add CLI Commands** - Make it easy for team to use
4. **Document Team Workflow** - Train team on new process
5. **Add Advanced Features** - Safety, validation, rollbacks

### Integration Points:
- Update `/server/src/common/config/database.ts` to run pending migrations on startup
- Modify existing setup scripts to work with migration system
- Update README.md with migration workflow documentation
- Add migration creation to development guidelines

This plan provides a complete solution to the MongoDB team synchronization problem and establishes a professional database management system that scales with the project.