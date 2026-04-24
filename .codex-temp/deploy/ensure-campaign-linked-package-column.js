const fs = require('fs');
const path = require('path');

const repoRoot = process.env.TRAVEL_BOT_ROOT || '/home/ec2-user/travel-bot-git';
const envPath = path.join(repoRoot, '.env');
const envText = fs.readFileSync(envPath, 'utf8');

for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex).trim();
  const value = trimmed.slice(eqIndex + 1).trim();
  if (!(key in process.env)) process.env[key] = value;
}

const { Client } = require(path.join(repoRoot, 'backend/node_modules/pg'));

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS linked_package_ids JSONB NOT NULL DEFAULT '[]'::jsonb;"
  );
  await client.end();
  console.log('campaigns.linked_package_ids ensured');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
