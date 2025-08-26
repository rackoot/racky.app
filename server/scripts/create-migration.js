const fs = require('fs');
const path = require('path');
const { MigrationValidator } = require('../dist/migrations/migrationValidator');

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  const description = args.join(' ').toLowerCase().trim();
  
  if (!description) {
    console.error('❌ Error: Migration description is required');
    showHelp();
    process.exit(1);
  }
  
  try {
    const migration = createMigration(description);
    console.log('✅ Migration created successfully!');
    console.log(`📄 File: ${migration.filename}`);
    console.log(`🆔 ID: ${migration.id}`);
    console.log(`📝 Description: ${migration.description}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Edit the migration file to add your up() and down() logic');
    console.log('   2. Test with: npm run migrate --dry-run --only ' + migration.id);
    console.log('   3. Apply with: npm run migrate --only ' + migration.id);
  } catch (error) {
    console.error('❌ Error creating migration:', error.message);
    process.exit(1);
  }
}

function createMigration(description) {
  const migrationDir = path.join(__dirname, '../migrations');
  const templatePath = path.join(migrationDir, '.template', 'migration-template.js');
  
  // Ensure migration directory exists
  if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
  }
  
  // Get next migration number
  const validator = new MigrationValidator();
  const migrationNumber = validator.getNextMigrationNumber(migrationDir);
  
  // Create migration ID
  const sanitizedDescription = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50); // Limit length
  
  const migrationId = `${migrationNumber}_${sanitizedDescription}`;
  const filename = `${migrationId}.js`;
  const filePath = path.join(migrationDir, filename);
  
  // Check if file already exists
  if (fs.existsSync(filePath)) {
    throw new Error(`Migration file already exists: ${filename}`);
  }
  
  // Read template
  if (!fs.existsSync(templatePath)) {
    throw new Error('Migration template not found. Please ensure the migration system is properly installed.');
  }
  
  let template = fs.readFileSync(templatePath, 'utf8');
  
  // Get current date
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Get author from environment or use default
  const author = process.env.USER || process.env.USERNAME || 'developer';
  
  // Replace template placeholders
  template = template
    .replace(/__MIGRATION_ID__/g, migrationId)
    .replace(/__MIGRATION_DESCRIPTION__/g, description)
    .replace(/__MIGRATION_AUTHOR__/g, author)
    .replace(/__MIGRATION_DATE__/g, currentDate);
  
  // Write migration file
  fs.writeFileSync(filePath, template);
  
  return {
    id: migrationId,
    filename: filePath,
    description: description,
    number: migrationNumber
  };
}

function showHelp() {
  console.log(`
🔧 Create New Migration

USAGE:
  npm run migrate:create "<description>"

DESCRIPTION:
  Create a new migration file with the given description.
  The description should be concise and descriptive of what the migration does.

EXAMPLES:
  npm run migrate:create "add user preferences field"
  npm run migrate:create "create product indexes"
  npm run migrate:create "update workspace schema"
  npm run migrate:create "seed initial plan data"

NAMING RULES:
  • Description will be sanitized (lowercase, no special chars)
  • Migration ID format: ###_sanitized_description
  • Migration numbers are auto-incremented
  • File will be created in /server/migrations/

AFTER CREATION:
  1. Edit the generated file to implement up() and down() methods
  2. Test with: npm run migrate --dry-run --only <migration_id>
  3. Apply with: npm run migrate --only <migration_id>

For more information, see the migration documentation in CLAUDE.md
`);
}

main();