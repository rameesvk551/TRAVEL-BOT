const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'travelbot',
});

async function debugSchema() {
  try {
    // Get all tables
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
    
    // Check leads table specifically
    console.log('\nLeads table columns:');
    const leads = await pool.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'leads' ORDER BY ordinal_position"
    );
    leads.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));
    
    // Try a raw SELECT with all columns listed
    const colNames = leads.rows.map(r => r.column_name);
    console.log('\nDirect SELECT test:');
    const selectStmt = 'SELECT ' + colNames.join(', ') + ' FROM leads LIMIT 1';
    console.log('Query:', selectStmt);
    const sample = await pool.query(selectStmt);
    console.log('Rows:', sample.rows.length);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugSchema();
