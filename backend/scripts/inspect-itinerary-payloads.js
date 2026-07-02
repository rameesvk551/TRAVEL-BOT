require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('tsx/cjs');

const { Itinerary, Package } = require('../src/models');

async function main() {
  const packages = await Package.findAll({
    where: { name: 'Kashmir 5days trip' },
    order: [['updatedAt', 'DESC']],
    limit: 5,
  });

  for (const pkg of packages) {
    console.log(JSON.stringify({
      packageId: pkg.id,
      name: pkg.name,
      agencyId: pkg.agencyId,
      updatedAt: pkg.updatedAt,
    }, null, 2));

    const rows = await Itinerary.findAll({
      where: { packageId: pkg.id, agencyId: pkg.agencyId },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
      limit: 8,
    });

    for (const row of rows) {
      console.log(JSON.stringify({
        itineraryId: row.id,
        name: row.name,
        pdfUrl: row.pdfUrl,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      }, null, 2));
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
