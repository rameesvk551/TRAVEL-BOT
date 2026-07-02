require('dotenv').config({ path: __dirname + '/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

sequelize.query(`
  SELECT c."channelId", COUNT(l.id) as count
  FROM "Leads" l
  JOIN "Customers" c ON l."customerId" = c.id
  GROUP BY c."channelId"
`)
  .then(([results]) => {
    console.log('Leads grouped by customer channelId:', results);
    return sequelize.query(`
      SELECT "channelId", COUNT(*) as count
      FROM "Customers"
      GROUP BY "channelId"
    `);
  })
  .then(([results]) => {
    console.log('Customers grouped by channelId:', results);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
