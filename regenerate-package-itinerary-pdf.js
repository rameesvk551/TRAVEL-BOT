const { Package, Itinerary } = require('./backend/src/models');
const packageService = require('./backend/src/services/packageService');

const packageId = process.argv[2];
const agencyId = process.argv[3];

(async () => {
  if (!packageId || !agencyId) {
    throw new Error('Usage: tsx regenerate-package-itinerary-pdf.js <packageId> <agencyId>');
  }

  process.env.PUBLIC_WEB_ROOT = process.env.PUBLIC_WEB_ROOT || '/home/ec2-user/travel-bot-frontend-release';

  const pkg = await Package.findOne({ where: { id: packageId, agencyId } });
  if (!pkg) throw new Error(`Package not found: ${packageId}`);

  const itinerary = await packageService.createPackageItineraryPdf(pkg);
  const reloaded = await Itinerary.findByPk(itinerary.id);

  console.log(JSON.stringify({
    packageId: pkg.id,
    packageName: pkg.name,
    itineraryId: reloaded.id,
    pdfUrl: reloaded.pdfUrl,
  }, null, 2));

  await Package.sequelize.close();
})().catch(async (err) => {
  console.error(err);
  try { await Package.sequelize.close(); } catch (_) {}
  process.exit(1);
});
