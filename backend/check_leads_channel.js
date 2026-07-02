require('dotenv').config({ path: __dirname + '/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

sequelize.query("SELECT c.channel_id, COUNT(l.id) FROM leads l JOIN customers c ON l.customer_id = c.id WHERE l.agency_id = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018' GROUP BY c.channel_id")
  .then(([res]) => {
    console.log(res);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
