require('dotenv').config({ path: 'backend/.env' });

const { Op } = require('sequelize');
const { Agency, Customer, Message, sequelize } = require('./backend/src/models');
const agencyService = require('./backend/src/services/agencyService');

(async () => {
  const agencies = await Agency.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.iLike]: '%wayon%' } },
        { email: { [Op.iLike]: '%wayon%' } },
      ],
    },
    attributes: ['id', 'name', 'email', 'marketingOsTenantId', 'whatsappNumber'],
    order: [['createdAt', 'DESC']],
    limit: 10,
  });

  for (const agency of agencies) {
    const row = agency.toJSON();
    console.log('AGENCY', JSON.stringify(row));
    try {
      const ig = await agencyService.getInstagramConnection(row.id);
      console.log('INSTAGRAM', JSON.stringify({
        connected: ig.connected,
        errorMessage: ig.errorMessage,
        accounts: (ig.accounts || []).map((account) => ({
          id: account.id,
          username: account.username,
          name: account.name,
          status: account.status,
          isActive: account.isActive,
        })),
      }));
    } catch (err) {
      console.log('INSTAGRAM_ERROR', err.message);
    }

    const customers = await Customer.findAll({
      where: {
        agencyId: row.id,
        [Op.or]: [
          { source: 'instagram' },
          { phone: { [Op.like]: 'ig_%' } },
        ],
      },
      attributes: ['id', 'phone', 'name', 'source', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 8,
    });
    console.log('IG_CUSTOMERS', JSON.stringify(customers.map((customer) => customer.toJSON())));

    const customerIds = customers.map((customer) => customer.id);
    if (customerIds.length) {
      const messages = await Message.findAll({
        where: { agencyId: row.id, customerId: { [Op.in]: customerIds } },
        attributes: ['customerId', 'direction', 'content', 'status', 'timestamp'],
        order: [['timestamp', 'DESC']],
        limit: 12,
      });
      console.log('IG_MESSAGES', JSON.stringify(messages.map((message) => message.toJSON())));
    }
  }

  await sequelize.close();
})().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
