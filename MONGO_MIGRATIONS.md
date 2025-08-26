# MongoDB Migrations Guide

This document provides complete instructions for using the MongoDB migration system in the Racky project.

## 🎯 Overview

The MongoDB migration system provides professional database version control, allowing teams to:
- Apply schema changes consistently across environments
- Track database modifications with complete history
- Rollback problematic changes safely
- Eliminate manual database synchronization issues
- Document database changes in version control

## 🚀 Quick Start

### Basic Migration Workflow

```bash
# 1. Create a new migration
npm run migrate:create "add user notification settings"

# 2. Edit the generated migration file (see examples below)

# 3. Test with dry run
npm run migrate --dry-run --only 001_add_user_notification_settings

# 4. Apply the migration
npm run migrate

# 5. Check status
npm run migrate:status
```

### Check Current Status

```bash
npm run migrate:status
```

This shows:
- Applied migrations
- Pending migrations  
- Failed migrations
- Last migration details
- Database connection info

## 📋 Available Commands

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `npm run migrate` | Run all pending migrations | `npm run migrate` |
| `npm run migrate:create "description"` | Create new migration file | `npm run migrate:create "add user preferences"` |
| `npm run migrate:status` | Show detailed migration status | `npm run migrate:status` |
| `npm run migrate:down` | Rollback last migration | `npm run migrate:down` |
| `npm run migrate:validate` | Validate all applied migrations | `npm run migrate:validate` |

### Advanced Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `npm run migrate --dry-run` | Test migrations without applying | Before production deployment |
| `npm run migrate --only <id>` | Run specific migration | `npm run migrate --only 001_add_preferences` |
| `npm run migrate --validate` | Run with validation checks | Ensure migration integrity |
| `npm run migrate:reset --confirm` | Reset database (dev only) | Clean development environment |

### Command Options

- `--dry-run`: Test without applying changes
- `--only <migration_id>`: Run specific migration
- `--validate`: Run validation after applying
- `--force`: Skip some safety checks
- `--help`: Show help information

## 📝 Creating Migrations

### 1. Generate Migration File

```bash
npm run migrate:create "descriptive name of change"
```

This creates a file like `001_descriptive_name_of_change.js` in `/server/migrations/`.

### 2. Migration File Structure

```javascript
module.exports = {
  id: "001_add_user_preferences",
  description: "Add user preferences field with default values",
  author: "developer-name",
  createdAt: "2024-01-15",
  
  async up(db, client) {
    // Apply changes
  },
  
  async down(db, client) {
    // Rollback changes
  },
  
  async validate(db, client) {
    // Validate changes (optional)
  }
};
```

### 3. Using Migration Operations

The `MigrationOperations` helper provides common database operations:

```javascript
const { MigrationOperations } = require('../dist/migrations/migrationOperations');

async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  // Add field with default value
  const result = await operations.addField('users', 'preferences', {
    theme: 'light',
    notifications: true
  });
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    executionTime: Date.now() - startTime,
    message: `Added preferences to ${result.documentsAffected} users`
  };
}
```

## 🛠️ Common Migration Patterns

### Add Field with Default Value

```javascript
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.addField('users', 'lastLogin', new Date());
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    message: `Added lastLogin to ${result.documentsAffected} users`
  };
}

async down(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.removeField('users', 'lastLogin');
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    message: `Removed lastLogin from ${result.documentsAffected} users`
  };
}
```

### Create Database Index

```javascript
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.createIndex(
    'products', 
    { workspaceId: 1, marketplace: 1 }, 
    { background: true }
  );
  
  return {
    success: true,
    message: `Created index on products collection`
  };
}

async down(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.dropIndex('products', 'workspaceId_1_marketplace_1');
  
  return {
    success: true,
    message: `Dropped index from products collection`
  };
}
```

### Transform Existing Data

```javascript
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  // Convert string prices to numbers
  const result = await operations.transformField(
    'products', 
    'price', 
    (value) => typeof value === 'string' ? parseFloat(value) : value
  );
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    message: `Converted ${result.documentsAffected} product prices to numbers`
  };
}
```

### Rename Field

```javascript
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.renameField('users', 'fullName', 'displayName');
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    message: `Renamed fullName to displayName for ${result.documentsAffected} users`
  };
}

async down(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.renameField('users', 'displayName', 'fullName');
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    message: `Renamed displayName back to fullName`
  };
}
```

### Insert Seed Data

```javascript
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const newPlans = [
    { name: 'Starter', price: 9, features: ['basic-feature'] },
    { name: 'Pro', price: 29, features: ['basic-feature', 'pro-feature'] }
  ];
  
  const result = await operations.insertSeedData(
    'plans', 
    newPlans, 
    { upsert: true, upsertKey: 'name' }
  );
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    message: `Added ${result.documentsAffected} plans`
  };
}

async down(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.removeDocuments('plans', {
    name: { $in: ['Starter', 'Pro'] }
  });
  
  return {
    success: true,
    documentsAffected: result.documentsAffected,
    message: `Removed ${result.documentsAffected} plans`
  };
}
```

### Create New Collection

```javascript
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.createCollection('notifications', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'message', 'createdAt'],
        properties: {
          userId: { bsonType: 'objectId' },
          message: { bsonType: 'string' },
          createdAt: { bsonType: 'date' }
        }
      }
    }
  });
  
  return {
    success: true,
    message: `Created notifications collection with validation`
  };
}

async down(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const result = await operations.dropCollection('notifications');
  
  return {
    success: true,
    message: `Dropped notifications collection`
  };
}
```

## 🔍 Migration Validation

Add validation to ensure migrations applied correctly:

```javascript
async validate(db, client) {
  // Check that field was added
  const usersWithoutPreferences = await db.collection('users').countDocuments({
    preferences: { $exists: false }
  });
  
  if (usersWithoutPreferences > 0) {
    throw new Error(`${usersWithoutPreferences} users missing preferences`);
  }
  
  // Check field structure
  const invalidPreferences = await db.collection('users').findOne({
    $or: [
      { 'preferences.theme': { $exists: false } },
      { 'preferences.notifications': { $exists: false } }
    ]
  });
  
  if (invalidPreferences) {
    throw new Error('Some users have incomplete preferences structure');
  }
  
  return true;
}
```

## 🚨 Safety & Best Practices

### Before Running Migrations

1. **Always backup production data**
2. **Test migrations in development first**
3. **Use dry-run mode**: `npm run migrate --dry-run`
4. **Review migration code carefully**
5. **Ensure rollback logic is implemented**

### Migration Naming Convention

```
001_add_user_preferences.js
002_create_product_indexes.js
003_update_workspace_schema.js
004_seed_initial_plans.js
```

- Use 3-digit numbers (001, 002, 003...)
- Use descriptive names with underscores
- Keep names concise but clear

### Writing Safe Migrations

```javascript
// ✅ GOOD: Handle errors gracefully
async up(db, client) {
  try {
    const operations = new MigrationOperations(db, client);
    const result = await operations.addField('users', 'newField', 'defaultValue');
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return {
      success: true,
      documentsAffected: result.documentsAffected,
      message: `Migration completed successfully`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ❌ BAD: No error handling
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  await operations.addField('users', 'newField', 'defaultValue');
  // Missing error handling and return
}
```

### Rollback Strategy

Always implement reversible operations:

```javascript
// ✅ GOOD: Reversible
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  return await operations.addField('users', 'newField', 'defaultValue');
}

async down(db, client) {
  const operations = new MigrationOperations(db, client);
  return await operations.removeField('users', 'newField');
}

// ❌ BAD: Not easily reversible
async up(db, client) {
  // Complex data transformation without storing rollback info
  const users = await db.collection('users').find().toArray();
  // ... complex operations ...
}
```

## 🗂️ File Structure

```
/server/
├── migrations/                    # Migration files
│   ├── .template/
│   │   └── migration-template.js  # Template for new migrations
│   ├── 001_add_user_preferences.js
│   ├── 002_create_indexes.js
│   └── 003_seed_data.js
├── scripts/
│   ├── migrate.js                 # Main migration runner
│   ├── create-migration.js        # Create new migrations
│   └── migration-status.js        # Status checker
└── src/migrations/                # Migration infrastructure
    ├── baseMigration.ts           # Base migration interface
    ├── migrationRunner.ts         # Core runner engine
    ├── migrationTracker.ts        # Track applied migrations
    ├── migrationValidator.ts      # Validate migrations
    ├── migrationOperations.ts     # Helper operations
    └── migrationSafety.ts         # Safety & backup features
```

## 🔧 Environment Configuration

Set the MongoDB connection string:

```bash
# In your .env file or environment
MONGODB_URI=mongodb://localhost:27017/racky

# Or pass directly
MONGODB_URI=mongodb://localhost:27017/racky npm run migrate:status
```

## 📊 Migration Status Output

When you run `npm run migrate:status`, you'll see:

```
============================================================
📊 RACKY DATABASE MIGRATION STATUS
============================================================

📈 Migration Statistics:
   • Total migration files: 3
   • Applied successfully: 2
   • Pending: 1
   • Failed: 0

🗃️  Database Information:
   • Connection: mongodb://localhost:27017/racky
   • Database: racky
   • Environment: development

🔄 Last Migration Applied:
   • ID: 002_create_product_indexes
   • Status: ✅ completed
   • Applied: Jan 15, 2024, 10:30:45 AM UTC
   • Author: developer-name
   • Environment: development
   • Execution time: 245ms
   • Documents affected: 1250

📋 All Migration Files:
   ✅ 001_add_user_preferences (Applied: Jan 14, 2024, 2:15:30 PM UTC)
   ✅ 002_create_product_indexes (Applied: Jan 15, 2024, 10:30:45 AM UTC)
   ⏳ 003_seed_initial_plans (Pending)

⏳ Pending Migrations (1):
   1. 003_seed_initial_plans

💡 To apply pending migrations, run:
   npm run migrate
```

## 🚫 Troubleshooting

### Common Issues

**Migration fails with "MODULE_NOT_FOUND"**
```bash
# Build TypeScript files first
npm run build
```

**Database connection errors**
```bash
# Check MongoDB URI
echo $MONGODB_URI

# Test connection manually
npm run migrate:status
```

**Migration validation fails**
```bash
# Check specific migration
npm run migrate --validate --only 001_migration_name

# Review validation logic in migration file
```

### Recovery Procedures

**Rollback last migration**
```bash
npm run migrate:down
```

**Mark migration as failed and retry**
```bash
# Check status to see failed migration
npm run migrate:status

# Fix migration file and retry
npm run migrate --force
```

**Reset development database**
```bash
# ⚠️ WARNING: Deletes all data!
npm run migrate:reset --confirm
```

## 👥 Team Workflow

### For New Team Members

1. Clone repository
2. Install dependencies: `npm install`
3. Check migration status: `npm run migrate:status`
4. Apply pending migrations: `npm run migrate`

### When Adding Database Changes

1. Create migration: `npm run migrate:create "describe your change"`
2. Implement up(), down(), and validate() methods
3. Test locally with dry-run: `npm run migrate --dry-run --only your_migration`
4. Apply locally: `npm run migrate --only your_migration`
5. Test rollback: `npm run migrate:down`
6. Re-apply: `npm run migrate`
7. Commit migration file with your code changes

### In Pull Requests

- Include migration files in your PR
- Document what the migration does
- Ensure migration is tested and reversible
- Update this documentation if adding new patterns

## 📚 Advanced Usage

### Custom Operations

For operations not covered by `MigrationOperations`, use direct MongoDB commands:

```javascript
async up(db, client) {
  // Direct MongoDB operations
  const result = await db.collection('users').aggregate([
    { $match: { status: 'inactive' } },
    { $out: 'inactive_users' }
  ]).toArray();
  
  return {
    success: true,
    message: `Created inactive_users collection with ${result.length} documents`
  };
}
```

### Transactions

Use transactions for complex operations:

```javascript
async up(db, client) {
  const operations = new MigrationOperations(db, client);
  
  const transactionResult = await operations.executeInTransaction([
    () => operations.addField('users', 'status', 'active'),
    () => operations.createIndex('users', { status: 1 }),
    () => operations.insertSeedData('user_statuses', [
      { name: 'active', description: 'Active user' },
      { name: 'inactive', description: 'Inactive user' }
    ])
  ]);
  
  return transactionResult;
}
```

This migration system provides a professional, battle-tested approach to managing MongoDB schema changes across development teams and deployment environments.