const { Op } = require('sequelize');
const { Itinerary, Package, Message } = require('./backend/src/models');

(async () => {
  const itineraries = await Itinerary.findAll({
    where: { pdfUrl: { [Op.ne]: null } },
    order: [['updatedAt', 'DESC']],
    limit: 5,
  });

  console.log('LATEST_ITINERARIES');
  for (const itinerary of itineraries) {
    const pkg = itinerary.packageId
      ? await Package.findOne({ where: { id: itinerary.packageId }, attributes: ['id', 'name', 'brochureUrl'] })
      : null;
    console.log(JSON.stringify({
      id: itinerary.id,
      name: itinerary.name,
      packageId: itinerary.packageId,
      packageName: pkg?.name || null,
      packageBrochureUrl: pkg?.brochureUrl || null,
      pdfUrl: itinerary.pdfUrl,
      updatedAt: itinerary.updatedAt,
    }));
  }

  const messages = await Message.findAll({
    where: {
      direction: 'OUT',
      type: { [Op.in]: ['DOCUMENT', 'TEXT'] },
    },
    order: [['timestamp', 'DESC']],
    limit: 15,
  });

  console.log('LATEST_MESSAGES');
  for (const message of messages) {
    console.log(JSON.stringify({
      id: message.id,
      type: message.type,
      status: message.status,
      waMessageId: message.waMessageId,
      timestamp: message.timestamp,
      content: String(message.content || '').slice(0, 500),
    }));
  }

  await Itinerary.sequelize.close();
})().catch(async (err) => {
  console.error(err);
  try { await Itinerary.sequelize.close(); } catch (_) {}
  process.exit(1);
});
