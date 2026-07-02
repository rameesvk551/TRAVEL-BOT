require('dotenv').config({ path: '/home/ec2-user/marketting-os/marketing-os-server/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD || process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
  .then(([tables]) => {
    console.log('Tables:', tables.map(t => t.table_name));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
