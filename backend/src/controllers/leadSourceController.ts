const { LeadSource } = require('../models');
const { z } = require('zod');

const leadSourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional(),
});
const leadSourceUpdateSchema = leadSourceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
);

function getAgencyId(req) {
  return req.agency?.id || req.user?.agencyId;
}

exports.listLeadSources = async (req, res) => {
  try {
    const leadSources = await LeadSource.findAll({
      where: { agencyId: getAgencyId(req) },
      order: [['name', 'ASC']],
    });
    res.json(leadSources);
  } catch (err) {
    console.error('List Lead Sources error:', err);
    res.status(500).json({ error: 'Failed to fetch lead sources' });
  }
};

exports.createLeadSource = async (req, res) => {
  try {
    const data = leadSourceSchema.parse(req.body);
    const agencyId = getAgencyId(req);
    const existing = await LeadSource.findOne({
      where: { agencyId, name: data.name },
    });

    if (existing) {
      return res.status(400).json({ error: 'Lead source with this name already exists' });
    }

    const leadSource = await LeadSource.create({
      agencyId,
      ...data,
    });
    res.status(201).json(leadSource);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Create Lead Source error:', err);
    res.status(500).json({ error: 'Failed to create lead source' });
  }
};

exports.updateLeadSource = async (req, res) => {
  try {
    const { id } = req.params;
    const data = leadSourceUpdateSchema.parse(req.body);
    const agencyId = getAgencyId(req);

    const leadSource = await LeadSource.findOne({
      where: { id, agencyId },
    });

    if (!leadSource) {
      return res.status(404).json({ error: 'Lead source not found' });
    }

    if (data.name && data.name !== leadSource.name) {
      const existing = await LeadSource.findOne({
        where: { agencyId, name: data.name },
      });
      if (existing) {
        return res.status(400).json({ error: 'Lead source with this name already exists' });
      }
    }

    await leadSource.update(data);
    res.json(leadSource);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Update Lead Source error:', err);
    res.status(500).json({ error: 'Failed to update lead source' });
  }
};

exports.deleteLeadSource = async (req, res) => {
  try {
    const { id } = req.params;
    const agencyId = getAgencyId(req);
    const leadSource = await LeadSource.findOne({
      where: { id, agencyId },
    });

    if (!leadSource) {
      return res.status(404).json({ error: 'Lead source not found' });
    }

    await leadSource.destroy();
    res.status(204).send();
  } catch (err) {
    console.error('Delete Lead Source error:', err);
    res.status(500).json({ error: 'Failed to delete lead source' });
  }
};
