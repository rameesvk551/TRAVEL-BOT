require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

async function verify() {
  const agencyId = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018';
  const queries = {
    leads: `SELECT COUNT(*) FROM leads WHERE agency_id = '${agencyId}'`,
    customers: `SELECT COUNT(*) FROM customers WHERE agency_id = '${agencyId}'`,
    packages: `SELECT COUNT(*) FROM packages WHERE agency_id = '${agencyId}'`,
    channels: `SELECT COUNT(*) FROM agency_channels WHERE agency_id = '${agencyId}'`
  };
  
  for (const [key, sql] of Object.entries(queries)) {
    const [res] = await sequelize.query(sql);
    console.log(`${key}: ${res[0].count}`);
  }
  process.exit(0);
}
verify();
