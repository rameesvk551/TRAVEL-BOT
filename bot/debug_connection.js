const path = require('path');
const { Lead } = require(path.resolve(__dirname, '../backend/src/models/index.ts'));

async function checkConnection() {
  try {
    console.log('🔍 Checking Lead model attributes...');
    console.log('Model name:', Lead.name);
    console.log('Table name:', Lead.tableName);
    console.log('Attributes:');
    Object.entries(Lead.rawAttributes).forEach(([key, attr]) => {
      const typeName = attr.type ? attr.type.constructor.name : 'unknown';
      console.log(`  ${key}: ${typeName}`);
    });
    
    // Try a simple query
    console.log('\n🔍 Attempting a simple query...');
    const result = await Lead.findOne({ limit: 1 });
    console.log('Query result:', result ? 'Success' : 'No results');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.original) {
      console.error('Original error:', error.original.message);
    }
  } finally {
    process.exit(0);
  }
}

setTimeout(checkConnection, 500);
