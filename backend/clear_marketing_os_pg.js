require('dotenv').config({ path: '/home/ec2-user/marketting-os/marketing-os-server/.env' });
const { Sequelize } = require('sequelize');

// The DB URL from .env
const dbUrl = process.env.DATABASE_URL || 'postgresql://edger_user:edger_pass@localhost:5436/travel_ops';

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
});

const numberStr = '%73060%68207%';

async function run() {
  try {
    // We will search for tables that have whatsappNumber or whatsapp_number
    const [tables] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    
    for (let t of tables) {
      const tableName = t.table_name;
      const [columns] = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${tableName}' AND column_name LIKE '%whatsapp%'`);
      
      let numberCol = null;
      for (let c of columns) {
        if (c.column_name === 'whatsapp_number' || c.column_name === 'whatsappNumber' || c.column_name === 'phoneNumber' || c.column_name === 'phone_number') {
           numberCol = c.column_name;
           break;
        }
      }
      
      if (!numberCol && columns.length > 0) {
        // Just take the first whatsapp related column that looks like a number
        numberCol = columns.find(c => c.column_name.includes('number'))?.column_name;
      }
      
      if (numberCol) {
         try {
           const [results] = await sequelize.query(`SELECT * FROM "${tableName}" WHERE "${numberCol}" LIKE '${numberStr}'`);
           if (results.length > 0) {
             console.log(`Found in table ${tableName}:`, results.length, `rows`);
             
             // Clear the column
             await sequelize.query(`UPDATE "${tableName}" SET "${numberCol}" = '' WHERE "${numberCol}" LIKE '${numberStr}'`);
             console.log(`Cleared ${numberCol} from table ${tableName}`);
           }
         } catch(err) {
           // ignore errors if column types mismatch
         }
      }
    }
    
    console.log("Done checking and clearing Postgres DB.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
