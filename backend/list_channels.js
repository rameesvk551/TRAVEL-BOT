require('dotenv').config({ path: __dirname + '/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

sequelize.query("SELECT id, label, whatsapp_number, is_active FROM agency_channels WHERE agency_id = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018'")
  .then(([res]) => {
    console.log(res);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
