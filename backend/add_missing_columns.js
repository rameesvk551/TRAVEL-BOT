const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'travelbot',
});

async function addMissingColumns() {
  try {
    console.log('🔍 Checking Lead table...');
    
    // Check if columns exist in leads table
    const leadResult = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'"
    );
    const leadColumns = leadResult.rows.map(row => row.column_name);
    console.log('Lead columns:', leadColumns);
    
    const missingLeadColumns = [];
    if (!leadColumns.includes('source')) missingLeadColumns.push('source');
    if (!leadColumns.includes('interest')) missingLeadColumns.push('interest');
    
    if (missingLeadColumns.length > 0) {
      console.log('❌ Missing in leads:', missingLeadColumns);
      // Add missing columns
      for (const col of missingLeadColumns) {
        if (col === 'source') {
          await pool.query(
            "ALTER TABLE leads ADD COLUMN source VARCHAR(100) DEFAULT 'whatsapp_organic'"
          );
          console.log('✅ Added column leads.source');
        } else if (col === 'interest') {
          await pool.query(
            "ALTER TABLE leads ADD COLUMN interest VARCHAR(50)"
          );
          console.log('✅ Added column leads.interest');
        }
      }
    } else {
      console.log('✅ Lead table has all required columns');
    }
    
    // Check customers table
    console.log('\n🔍 Checking Customer table...');
    const customerResult = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'customers'"
    );
    const customerColumns = customerResult.rows.map(row => row.column_name);
    console.log('Customer columns:', customerColumns);
    
    const missingCustomerColumns = [];
    if (!customerColumns.includes('source')) missingCustomerColumns.push('source');
    
    if (missingCustomerColumns.length > 0) {
      console.log('❌ Missing in customers:', missingCustomerColumns);
      // Add missing columns
      for (const col of missingCustomerColumns) {
        if (col === 'source') {
          await pool.query(
            "ALTER TABLE customers ADD COLUMN source VARCHAR(50) DEFAULT 'whatsapp'"
          );
          console.log('✅ Added column customers.source');
        }
      }
    } else {
      console.log('✅ Customer table has all required columns');
    }
    
    console.log('\n✅ All migrations complete!');
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

addMissingColumns();
