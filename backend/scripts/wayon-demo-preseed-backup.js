require('dotenv').config({ path: '/home/ec2-user/travel-bot-git/.env' });

const {
  sequelize,
  Agency,
  Customer,
  Lead,
  Booking,
  Payment,
  Campaign,
  CampaignRecipient,
  Package,
  Property,
  Review,
  FollowUp,
  Message,
  Itinerary,
  LeadNote,
  DripSequence,
  DripEnrollment,
} = require('/home/ec2-user/travel-bot-git/backend/src/models');

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

const outDir = '/home/ec2-user/db-backups';
const outPath = path.join(outDir, `wayon-demo-preseed-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

async function main() {
  await sequelize.authenticate();
  const [agency] = await sequelize.query(
    'SELECT id, name FROM agencies WHERE lower(name) = lower(:name) LIMIT 1',
    { replacements: { name: 'wayon travels' }, type: sequelize.QueryTypes.SELECT }
  );
  if (!agency) throw new Error('Wayon Travels agency not found');

  const agencyId = agency.id;
  const leads = await Lead.findAll({
    where: {
      agencyId,
      [Op.or]: [
        { source: 'wayon_demo_seed' },
        { tags: { [Op.contains]: ['demo-client-meeting'] } },
      ],
    },
    raw: true,
  });
  const leadIds = leads.map((lead) => lead.id);
  const customerIds = [...new Set(leads.map((lead) => lead.customerId).filter(Boolean))];

  const bookings = await Booking.findAll({
    where: {
      agencyId,
      [Op.or]: [
        { bookingRef: { [Op.like]: 'WY-%' } },
        leadIds.length ? { leadId: { [Op.in]: leadIds } } : { id: null },
      ],
    },
    raw: true,
  });
  const bookingIds = bookings.map((booking) => booking.id);

  const campaigns = await Campaign.findAll({
    where: { agencyId, name: { [Op.like]: 'Wayon Demo%' } },
    raw: true,
  });
  const campaignIds = campaigns.map((campaign) => campaign.id);

  const data = {
    createdAt: new Date().toISOString(),
    agency,
    records: {
      customers: customerIds.length ? await Customer.findAll({ where: { id: { [Op.in]: customerIds } }, raw: true }) : [],
      leads,
      bookings,
      payments: bookingIds.length ? await Payment.findAll({ where: { bookingId: { [Op.in]: bookingIds } }, raw: true }) : [],
      campaigns,
      campaignRecipients: campaignIds.length ? await CampaignRecipient.findAll({ where: { campaignId: { [Op.in]: campaignIds } }, raw: true }) : [],
      packages: await Package.findAll({ where: { agencyId, summary: { [Op.iLike]: '%wayon_demo_seed%' } }, raw: true }),
      properties: await Property.findAll({ where: { agencyId, description: { [Op.iLike]: '%Wayon demo%' } }, raw: true }),
      reviews: bookingIds.length ? await Review.findAll({ where: { bookingId: { [Op.in]: bookingIds } }, raw: true }) : [],
      followUps: leadIds.length ? await FollowUp.findAll({ where: { leadId: { [Op.in]: leadIds } }, raw: true }) : [],
      messages: customerIds.length ? await Message.findAll({ where: { agencyId, customerId: { [Op.in]: customerIds } }, raw: true }) : [],
      itineraries: leadIds.length ? await Itinerary.findAll({ where: { leadId: { [Op.in]: leadIds } }, raw: true }) : [],
      leadNotes: leadIds.length ? await LeadNote.findAll({ where: { leadId: { [Op.in]: leadIds } }, raw: true }) : [],
      dripSequences: await DripSequence.findAll({ where: { agencyId, name: { [Op.like]: 'Wayon Demo%' } }, raw: true }),
      dripEnrollments: leadIds.length ? await DripEnrollment.findAll({ where: { leadId: { [Op.in]: leadIds } }, raw: true }) : [],
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(outPath);
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (err) => {
    console.error(err.message);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
