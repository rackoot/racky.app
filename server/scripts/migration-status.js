const { MongoClient } = require('mongodb');
const path = require('path');
const { MigrationRunner } = require('../dist/migrations/migrationRunner');
require('dotenv').config();

async function main() {
  let client;
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const migrationDir = path.join(__dirname, '../migrations');
    
    const runner = new MigrationRunner(client, db, migrationDir);
    
    console.log('='.repeat(60));
    console.log('📊 RACKY DATABASE MIGRATION STATUS');
    console.log('='.repeat(60));
    
    const status = await runner.getStatus();
    
    // Overall statistics
    console.log(`\n📈 Migration Statistics:`);
    console.log(`   • Total migration files: ${status.availableMigrations.length}`);
    console.log(`   • Applied successfully: ${status.status.applied}`);
    console.log(`   • Pending: ${status.status.pending}`);
    console.log(`   • Failed: ${status.status.failed}`);
    
    // Database information
    console.log(`\n🗃️  Database Information:`);
    console.log(`   • Connection: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/racky'}`);
    console.log(`   • Database: ${db.databaseName}`);
    console.log(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Last migration info
    if (status.status.lastMigration) {
      const lastMigration = status.status.lastMigration;
      console.log(`\n🔄 Last Migration Applied:`);
      console.log(`   • ID: ${lastMigration.migrationId}`);
      console.log(`   • Description: ${lastMigration.description}`);
      console.log(`   • Status: ${getStatusEmoji(lastMigration.status)} ${lastMigration.status}`);
      console.log(`   • Applied: ${formatDate(lastMigration.appliedAt)}`);
      console.log(`   • Author: ${lastMigration.author}`);
      console.log(`   • Environment: ${lastMigration.environment}`);
      
      if (lastMigration.executionTime) {
        console.log(`   • Execution time: ${lastMigration.executionTime}ms`);
      }
      
      if (lastMigration.documentsAffected !== undefined) {
        console.log(`   • Documents affected: ${lastMigration.documentsAffected}`);
      }
      
      if (lastMigration.error) {
        console.log(`   • Error: ${lastMigration.error}`);
      }
    }
    
    // Detailed migration list
    console.log(`\n📋 All Migration Files:`);
    if (status.availableMigrations.length === 0) {
      console.log('   • No migration files found');
    } else {
      status.availableMigrations.forEach(migrationId => {
        const isApplied = status.appliedMigrations.includes(migrationId);
        const failedMigration = status.failedMigrations.find(m => m.migrationId === migrationId);
        
        let statusInfo = '';
        let emoji = '';
        
        if (failedMigration) {
          emoji = '❌';
          statusInfo = ` (FAILED: ${failedMigration.error || 'Unknown error'})`;
        } else if (isApplied) {
          emoji = '✅';
          // Find the applied migration record for more details
          const appliedRecord = status.status.lastMigration?.migrationId === migrationId ? 
            status.status.lastMigration : null;
          if (appliedRecord && appliedRecord.appliedAt) {
            statusInfo = ` (Applied: ${formatDate(appliedRecord.appliedAt)})`;
          } else {
            statusInfo = ' (Applied)';
          }
        } else {
          emoji = '⏳';
          statusInfo = ' (Pending)';
        }
        
        console.log(`   ${emoji} ${migrationId}${statusInfo}`);
      });
    }
    
    // Pending migrations section
    if (status.pendingMigrations.length > 0) {
      console.log(`\n⏳ Pending Migrations (${status.pendingMigrations.length}):`);
      status.pendingMigrations.forEach((id, index) => {
        console.log(`   ${index + 1}. ${id}`);
      });
      console.log(`\n💡 To apply pending migrations, run:`);
      console.log(`   npm run migrate`);
    } else if (status.availableMigrations.length > 0) {
      console.log(`\n✅ All migrations are up to date!`);
    }
    
    // Failed migrations section
    if (status.failedMigrations.length > 0) {
      console.log(`\n❌ Failed Migrations (${status.failedMigrations.length}):`);
      status.failedMigrations.forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration.migrationId}`);
        console.log(`      • Error: ${migration.error || 'Unknown error'}`);
        console.log(`      • Failed at: ${formatDate(migration.appliedAt)}`);
        console.log(`      • Author: ${migration.author}`);
      });
      console.log(`\n💡 To retry failed migrations:`);
      console.log(`   npm run migrate --force`);
    }
    
    // Quick action suggestions
    console.log(`\n🛠️  Quick Actions:`);
    console.log(`   • Check status: npm run migrate:status`);
    console.log(`   • Run migrations: npm run migrate`);
    console.log(`   • Create new: npm run migrate:create "description"`);
    console.log(`   • Rollback last: npm run migrate:down`);
    console.log(`   • Validate all: npm run migrate:validate`);
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error checking migration status:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

function getStatusEmoji(status) {
  switch (status) {
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'running': return '⏳';
    case 'rolled_back': return '⏪';
    default: return '❓';
  }
}

function formatDate(date) {
  if (!date) return 'Unknown';
  
  try {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch (error) {
    return date.toString();
  }
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

main().catch(console.error);