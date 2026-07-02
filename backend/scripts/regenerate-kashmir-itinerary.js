require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('tsx/cjs');

const { Package, Itinerary } = require('../src/models');
const { createPackageItineraryPdf } = require('../src/services/packageService.ts');

async function main() {
  const targetId = process.argv[2] || '2e383bcd-cd8a-4961-9616-cfd449b4d722';
  const pkg = await Package.findOne({ where: { id: targetId, isActive: true } });
  if (!pkg) throw new Error(`Package not found: ${targetId}`);

  const itinerary = await createPackageItineraryPdf(pkg);
  await Itinerary.update(
    { updatedAt: new Date(Date.now() - 1000) },
    {
      where: {
        packageId: pkg.id,
        agencyId: pkg.agencyId,
        id: { [require('sequelize').Op.ne]: itinerary.id },
      },
    }
  );

  console.log(JSON.stringify({
    packageId: pkg.id,
    packageName: pkg.name,
    itineraryId: itinerary.id,
    itineraryName: itinerary.name,
    pdfUrl: itinerary.pdfUrl,
  }, null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
