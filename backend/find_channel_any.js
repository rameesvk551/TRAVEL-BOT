require('dotenv').config({ path: __dirname + '/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

const search = '%73060%68207%';

sequelize.query(`SELECT * FROM agency_channels WHERE whatsapp_number LIKE '${search}' OR whatsapp_display_phone_number LIKE '${search}' OR label LIKE '${search}'`)
  .then(([channels]) => {
    console.log('Channels with the number:', channels);
    return sequelize.query(`SELECT * FROM agencies WHERE whatsapp_number LIKE '${search}'`);
  })
  .then(([agencies]) => {
    console.log('Agencies with the number:', agencies);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
