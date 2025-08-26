const { MongoClient } = require('mongodb');
const path = require('path');
const { MigrationRunner } = require('../dist/migrations/migrationRunner');
require('dotenv').config();

async function main() {
  const args = process.argv.slice(2);
  const command = parseCommand(args);
  
  let client;
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const migrationDir = path.join(__dirname, '../migrations');
    
    const runner = new MigrationRunner(client, db, migrationDir);
    
    // Execute command
    switch (command.action) {
      case 'up':
        await runMigrations(runner, { direction: 'up', ...command.options });
        break;
        
      case 'down':
        await runMigrations(runner, { direction: 'down', ...command.options });
        break;
        
      case 'status':
        await showStatus(runner);
        break;
        
      case 'validate':
        await validateMigrations(runner);
        break;
        
      case 'reset':
        await resetDatabase(runner, command.options.confirm);
        break;
        
      default:
        // Default action is to run pending migrations
        await runMigrations(runner, { direction: 'up' });
        break;
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

function parseCommand(args) {
  const command = {
    action: 'up',
    options: {}
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--up':
        command.action = 'up';
        break;
        
      case '--down':
        command.action = 'down';
        break;
        
      case '--status':
        command.action = 'status';
        break;
        
      case '--validate':
        command.action = 'validate';
        break;
        
      case '--reset':
        command.action = 'reset';
        break;
        
      case '--confirm':
        command.options.confirm = true;
        break;
        
      case '--dry-run':
        command.options.dryRun = true;
        break;
        
      case '--force':
        command.options.force = true;
        break;
        
      case '--only':
        command.options.target = args[i + 1];
        i++; // Skip next argument as it's the target
        break;
        
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return command;
}

async function runMigrations(runner, options) {
  console.log('='.repeat(50));
  console.log('🚀 RACKY DATABASE MIGRATIONS');
  console.log('='.repeat(50));
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }
  
  if (options.target) {
    console.log(`📌 Running specific migration: ${options.target}\n`);
  } else if (options.direction === 'down') {
    console.log('⬇️  Rolling back last migration\n');
  } else {
    console.log('⬆️  Running pending migrations\n');
  }
  
  const result = await runner.runMigrations(options);
  
  if (result.success) {
    console.log('✅ Migration(s) completed successfully!');
    
    if (result.migrationsRun.length > 0) {
      console.log('\n📋 Migrations processed:');
      result.migrationsRun.forEach(id => console.log(`   • ${id}`));
    } else {
      console.log('   • No migrations to run');
    }
    
    if (result.totalTime > 0) {
      console.log(`\n⏱️  Total execution time: ${result.totalTime}ms`);
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
  } else {
    console.log('❌ Migration(s) failed!');
    console.log('\n🐛 Errors:');
    result.errors.forEach(error => console.log(`   • ${error}`));
    
    if (result.migrationsRun.length > 0) {
      console.log('\n✅ Successfully completed before failure:');
      result.migrationsRun.forEach(id => console.log(`   • ${id}`));
    }
    
    process.exit(1);
  }
}

async function showStatus(runner) {
  console.log('='.repeat(50));
  console.log('📊 MIGRATION STATUS');
  console.log('='.repeat(50));
  
  const status = await runner.getStatus();
  
  console.log(`\n📈 Overall Status:`);
  console.log(`   • Total migrations: ${status.status.total}`);
  console.log(`   • Applied: ${status.status.applied}`);
  console.log(`   • Pending: ${status.status.pending}`);
  console.log(`   • Failed: ${status.status.failed}`);
  
  if (status.status.lastMigration) {
    const lastMigration = status.status.lastMigration;
    console.log(`\n🔄 Last Migration:`);
    console.log(`   • ID: ${lastMigration.migrationId}`);
    console.log(`   • Status: ${lastMigration.status}`);
    console.log(`   • Applied: ${lastMigration.appliedAt}`);
    console.log(`   • Author: ${lastMigration.author}`);
    console.log(`   • Environment: ${lastMigration.environment}`);
  }
  
  if (status.pendingMigrations.length > 0) {
    console.log(`\n⏳ Pending Migrations:`);
    status.pendingMigrations.forEach(id => console.log(`   • ${id}`));
    console.log(`\n💡 Run 'npm run migrate' to apply pending migrations`);
  }
  
  if (status.failedMigrations.length > 0) {
    console.log(`\n❌ Failed Migrations:`);
    status.failedMigrations.forEach(migration => {
      console.log(`   • ${migration.migrationId}: ${migration.error || 'Unknown error'}`);
    });
  }
  
  console.log(`\n🗃️  Available Migration Files:`);
  status.availableMigrations.forEach(id => {
    const isApplied = status.appliedMigrations.includes(id);
    const isFailed = status.failedMigrations.some(m => m.migrationId === id);
    const symbol = isFailed ? '❌' : isApplied ? '✅' : '⏳';
    console.log(`   ${symbol} ${id}`);
  });
}

async function validateMigrations(runner) {
  console.log('='.repeat(50));
  console.log('🔍 VALIDATING MIGRATIONS');
  console.log('='.repeat(50));
  
  const result = await runner.runMigrations({ validate: true });
  
  if (result.success) {
    console.log('✅ All migrations validated successfully!');
  } else {
    console.log('❌ Migration validation failed!');
    result.errors.forEach(error => console.log(`   • ${error}`));
    process.exit(1);
  }
}

async function resetDatabase(runner, confirmed) {
  if (!confirmed) {
    console.log('⚠️  Database reset requires confirmation.');
    console.log('   Use --confirm flag to proceed: npm run migrate:reset --confirm');
    console.log('   ⚠️  WARNING: This will DELETE ALL DATA!');
    return;
  }
  
  if (process.env.NODE_ENV === 'production') {
    console.log('❌ Database reset is not allowed in production environment!');
    process.exit(1);
  }
  
  console.log('='.repeat(50));
  console.log('🔥 RESETTING DATABASE');
  console.log('='.repeat(50));
  console.log('⚠️  WARNING: This will delete all data and migration records!');
  
  try {
    // This is a dangerous operation - implement with care
    // For now, just clear migration records
    const status = await runner.getStatus();
    const db = runner.db || runner._db; // Access db instance
    
    await db.collection('migrations').deleteMany({});
    
    console.log('✅ Migration records cleared');
    console.log('💡 You may want to manually clear other collections as needed');
    
  } catch (error) {
    console.log('❌ Reset failed:', error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🚀 Racky Database Migration Tool

USAGE:
  npm run migrate [options]

OPTIONS:
  --up              Run pending migrations (default)
  --down            Rollback the last migration
  --status          Show migration status
  --validate        Validate all applied migrations
  --reset --confirm Reset database (development only)
  
  --only <id>       Run specific migration only
  --dry-run         Test migrations without applying them
  --force           Force run migrations (skip some checks)
  --help, -h        Show this help message

EXAMPLES:
  npm run migrate                    # Run all pending migrations
  npm run migrate --status           # Check migration status
  npm run migrate --down             # Rollback last migration
  npm run migrate --only 001_add_user_preferences  # Run specific migration
  npm run migrate --dry-run          # Test migrations without applying
  npm run migrate:reset --confirm    # Reset database (dev only)

SCRIPT ALIASES:
  npm run migrate:create "description"  # Create new migration file
  npm run migrate:status               # Same as --status
  npm run migrate:up                   # Same as --up
  npm run migrate:down                 # Same as --down
  npm run migrate:validate             # Same as --validate
  npm run migrate:reset --confirm      # Same as --reset --confirm

For more information, see CLAUDE.md or the migration documentation.
`);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the main function
main().catch(console.error);