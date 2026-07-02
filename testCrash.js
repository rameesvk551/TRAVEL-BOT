const { sequelize, Lead } = require('./backend/src/models');
const leadService = require('./backend/src/services/leadService');

async function run() {
  try {
    const leadModel = await Lead.findOne({ order: [['createdAt', 'DESC']] });
    if (!leadModel) return console.log('no lead');
    
    console.log('Fetching lead:', leadModel.id);
    const lead = await leadService.getLeadById(leadModel.id, leadModel.agencyId, null);
    console.log('Success!', lead.timeline.length);
  } catch (err) {
    console.error('CRASH:', err);
  }
}

run().then(() => process.exit(0));
