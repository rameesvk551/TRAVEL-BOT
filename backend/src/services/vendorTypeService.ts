const { VendorType, Vendor, sequelize } = require('../models');
const accountingService = require('./accountingService');

async function createVendorType(agencyId, payload) {
  const transaction = await sequelize.transaction();
  try {
    const name = payload.name?.trim();
    if (!name) {
      throw Object.assign(new Error('Vendor type name is required'), { statusCode: 400 });
    }

    // Check for duplicate name (case-insensitive)
    const { Op } = require('sequelize');
    const existing = await VendorType.findOne({
      where: {
        agencyId,
        name: { [Op.iLike]: name },
      },
      transaction,
    });
    if (existing) {
      throw Object.assign(new Error('A vendor type with this name already exists'), { statusCode: 409 });
    }

    // Create ledger group under Supplier Payables (2001)
    const groupName = `${name} Vendors`;
    const parentLedger = await accountingService.getLedgerByCode(agencyId, '2001', transaction);

    const groupLedger = await accountingService.createLedger(agencyId, {
      name: groupName,
      type: 'LIABILITY',
      parentId: parentLedger.id,
      isGroup: true,
      financialStatement: 'BALANCE_SHEET',
    }, transaction);

    // Create the VendorType record
    const vendorType = await VendorType.create({
      agencyId,
      name,
      description: payload.description || null,
      ledgerGroupId: groupLedger.id,
    }, { transaction });

    await transaction.commit();
    return vendorType;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listVendorTypes(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const vendorTypes = await VendorType.findAll({
    where,
    order: [['name', 'ASC']],
  });

  // Get vendor count per type
  const vendorCounts = await Vendor.findAll({
    attributes: [
      'type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: { agencyId },
    group: ['type'],
    raw: true,
  });

  const countMap = {};
  vendorCounts.forEach((vc) => {
    countMap[vc.type] = parseInt(vc.count, 10);
  });

  return vendorTypes.map((vt) => ({
    ...vt.toJSON(),
    vendorCount: countMap[vt.name] || 0,
  }));
}

async function getVendorType(agencyId, id) {
  const vendorType = await VendorType.findOne({ where: { id, agencyId } });
  if (!vendorType) {
    throw Object.assign(new Error('Vendor type not found'), { statusCode: 404 });
  }
  return vendorType;
}

async function updateVendorType(agencyId, id, payload) {
  const vendorType = await getVendorType(agencyId, id);
  const updates = {};

  if (payload.name !== undefined) {
    const name = payload.name?.trim();
    if (!name) {
      throw Object.assign(new Error('Vendor type name is required'), { statusCode: 400 });
    }

    // Check for duplicate name if changing
    if (name !== vendorType.name) {
      const { Op } = require('sequelize');
      const existing = await VendorType.findOne({
        where: {
          agencyId,
          name: { [Op.iLike]: name },
          id: { [Op.ne]: id },
        },
      });
      if (existing) {
        throw Object.assign(new Error('A vendor type with this name already exists'), { statusCode: 409 });
      }
    }
    updates.name = name;
  }

  if (payload.description !== undefined) {
    updates.description = payload.description;
  }

  if (payload.isActive !== undefined) {
    updates.isActive = payload.isActive;
  }

  await vendorType.update(updates);
  return vendorType;
}

async function deleteVendorType(agencyId, id) {
  const vendorType = await getVendorType(agencyId, id);

  // Check if any vendors use this type
  const vendorCount = await Vendor.count({
    where: { agencyId, type: vendorType.name },
  });

  if (vendorCount > 0) {
    throw Object.assign(
      new Error(`Cannot delete: ${vendorCount} vendor(s) are using this type. Deactivate it instead.`),
      { statusCode: 400 }
    );
  }

  await vendorType.destroy();
  return { deleted: true };
}

module.exports = {
  createVendorType,
  listVendorTypes,
  getVendorType,
  updateVendorType,
  deleteVendorType,
};
