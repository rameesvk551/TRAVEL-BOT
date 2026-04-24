const fs = require('fs');
const path = require('path');

const repoRoot = process.env.TRAVEL_BOT_ROOT || '/home/ec2-user/travel-bot-git';
const envPath = path.join(repoRoot, '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const dbLine = envText.split(/\r?\n/).find((line) => line.startsWith('DATABASE_URL='));
const DATABASE_URL = dbLine ? dbLine.slice('DATABASE_URL='.length).trim() : '';

const { Client } = require(path.join(repoRoot, 'backend/node_modules/pg'));

(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const db = await client.query('select current_database(), current_user');
  const cols = await client.query(
    "select column_name from information_schema.columns where table_name='campaigns' order by ordinal_position"
  );
  console.log(JSON.stringify(db.rows, null, 2));
  console.log(cols.rows.map((row) => row.column_name).join(','));
  await client.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
