// FILE: /backend/src/scripts/backfillAgencySubdomains.ts
//
// Every agency needs a human-readable subdomain — it is the :agencyKey in the public
// lead-form link (/lead/:agencyKey) and the public website. Without one the link falls
// back to the raw agency UUID, which works but is useless in an Instagram bio.
//
// This backfills a unique slug (derived from the agency name) for every active agency
// that has none, and can rename a specific agency via --rename=<id-or-current>:<new>.
//
// Usage:
//   tsx src/scripts/backfillAgencySubdomains.ts --dry-run
//   tsx src/scripts/backfillAgencySubdomains.ts
//   tsx src/scripts/backfillAgencySubdomains.ts --rename=myagency:wayon-travels

const { Op } = require('sequelize');
const { Agency, sequelize } = require('../models');

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'lead', 'public', 'sites', 'static', 'assets']);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

async function uniqueSubdomain(base, takenLocally) {
  const root = slugify(base) || 'agency';
  const safeRoot = RESERVED.has(root) ? `${root}-travel` : root;

  for (let n = 1; ; n += 1) {
    const candidate = n === 1 ? safeRoot : `${safeRoot}-${n}`.slice(0, 63);
    if (takenLocally.has(candidate)) continue;
    const clash = await Agency.findOne({ where: { subdomain: candidate }, attributes: ['id'] });
    if (!clash) {
      takenLocally.add(candidate);
      return candidate;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const renameArg = args.find((a) => a.startsWith('--rename='));

  const taken = new Set(
    (await Agency.findAll({ where: { subdomain: { [Op.ne]: null } }, attributes: ['subdomain'] }))
      .map((a) => a.subdomain)
      .filter(Boolean),
  );

  // ---- explicit rename (e.g. the placeholder "myagency") ----
  if (renameArg) {
    const [from, to] = renameArg.slice('--rename='.length).split(':');
    const agency = await Agency.findOne({
      where: { [Op.or]: [{ subdomain: from }, ...(from.includes('-') && from.length > 30 ? [{ id: from }] : [])] },
    });
    if (!agency) {
      console.error(`  RENAME: no agency with subdomain "${from}"`);
    } else {
      const target = slugify(to);
      const clash = await Agency.findOne({ where: { subdomain: target, id: { [Op.ne]: agency.id } } });
      if (clash) {
        console.error(`  RENAME: "${target}" is already taken by ${clash.name}`);
      } else {
        console.log(`  RENAME: ${agency.name}: "${agency.subdomain}" -> "${target}"${dryRun ? '  (dry-run)' : ''}`);
        if (!dryRun) await agency.update({ subdomain: target });
        taken.delete(from);
        taken.add(target);
      }
    }
  }

  // ---- backfill everyone missing a subdomain ----
  const missing = await Agency.findAll({
    where: {
      isActive: true,
      [Op.or]: [{ subdomain: null }, { subdomain: '' }],
    },
    order: [['name', 'ASC']],
  });

  console.log(`\n  ${missing.length} active agencies without a subdomain\n`);
  for (const agency of missing) {
    const subdomain = await uniqueSubdomain(agency.name, taken);
    console.log(`  ${dryRun ? '[dry]' : '[set]'} ${String(agency.name).padEnd(36)} -> ${subdomain}`);
    if (!dryRun) await agency.update({ subdomain });
  }

  console.log('\n  --- final ---');
  const all = await Agency.findAll({ where: { isActive: true }, order: [['name', 'ASC']], attributes: ['name', 'subdomain'] });
  all.forEach((a) => console.log(`  ${String(a.name).padEnd(36)} /lead/${a.subdomain || '<UUID FALLBACK>'}`));

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
