const { Package } = require('./backend/src/models');

(async () => {
  const rows = await Package.findAll({
    attributes: ['id', 'name', 'destinations', 'duration', 'updatedAt'],
    order: [['updatedAt', 'DESC']],
    limit: 8,
  });

  for (const p of rows) {
    console.log(JSON.stringify({
      id: p.id,
      name: p.name,
      destinations: p.destinations,
      duration: p.duration,
      updatedAt: p.updatedAt,
    }));
  }
  process.exit(0);
})().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
