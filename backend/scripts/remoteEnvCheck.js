const path = require('path');
require('dotenv').config({ path: path.resolve('/home/ec2-user/travel-bot-git/.env') });
console.log('DB_NAME=' + process.env.DB_NAME);
console.log('DB_USER=' + process.env.DB_USER);
console.log('DB_HOST=' + process.env.DB_HOST);
console.log('DATABASE_URL=' + process.env.DATABASE_URL);
console.log('NODE_ENV=' + process.env.NODE_ENV);
console.log('CWD=' + process.cwd());
