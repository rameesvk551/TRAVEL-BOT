require('dotenv').config({ path: '/home/ec2-user/wayon-e-com/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

const numberStr = '%73060%68207%';
sequelize.query(`SELECT id, name, "whatsapp_number", "whatsapp_provider", "marketing_os_tenant_id" FROM "agencies" WHERE "whatsapp_number" LIKE '${numberStr}'`)
  .then(([agencies]) => {
    console.log('Found in ecom agencies:', agencies);
    return sequelize.query(`SELECT id, agency_id, whatsapp_number, whatsapp_provider, marketing_os_tenant_id FROM "agency_channels" WHERE "whatsapp_number" LIKE '${numberStr}'`).catch(() => [[], null]);
  })
  .then(([channels]) => {
    if (channels && channels.length > 0) {
      console.log('Found in ecom agency_channels:', channels);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
