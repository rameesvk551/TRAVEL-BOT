require('dotenv').config({ path: '/home/ec2-user/wayon-e-com/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

const agencyId = '288037c9-2299-4b49-bdc9-862f0e4633f1';

sequelize.query(`UPDATE "agencies" SET "whatsapp_number" = '', "whatsapp_provider" = 'SELF_HOSTED', "marketing_os_tenant_id" = NULL, "whatsapp_connection_status" = 'NOT_CONNECTED' WHERE id = '${agencyId}'`)
  .then(([results, metadata]) => {
    console.log(`Successfully cleared WhatsApp details from E-com database. Updated ${metadata.rowCount} rows.`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
