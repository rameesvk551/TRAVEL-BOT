// FILE: /backend/src/controllers/quotationController.ts
const { Quotation, QuotationTemplate, Lead, Customer, Agency } = require('../models');
const documentPdfService = require('../services/documentPdfService');
const documentDeliveryService = require('../services/documentDeliveryService');

async function list(req, res, next) {
  try {
    const quotations = await Quotation.findAll({
      where: { agencyId: req.agency.id },
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'destination'], include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: QuotationTemplate, as: 'template', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: quotations });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const quotation = await Quotation.findOne({
      where: { id: req.params.id, agencyId: req.agency.id },
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'destination'], include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: QuotationTemplate, as: 'template' }
      ]
    });
    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }
    res.json({ success: true, data: quotation });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { leadId, customerId, templateId, date, items, subTotal, totalAmount, amountInWords, status } = req.body;
    
    // Generate simple quotation number
    const count = await Quotation.count({ where: { agencyId: req.agency.id } });
    const quotationNumber = `EST-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const quotation = await Quotation.create({
      agencyId: req.agency.id,
      leadId: leadId || null,
      customerId: customerId || null,
      templateId: templateId || null,
      quotationNumber,
      date: date || new Date().toISOString().split('T')[0],
      items: items || [],
      subTotal: subTotal || 0,
      totalAmount: totalAmount || 0,
      amountInWords: amountInWords || '',
      status: status || 'DRAFT',
    });

    res.status(201).json({ success: true, data: quotation, message: 'Quotation created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const quotation = await Quotation.findOne({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    const wasSent = quotation.status === 'SENT';
    await quotation.update({
      leadId: req.body.leadId !== undefined ? req.body.leadId : quotation.leadId,
      customerId: req.body.customerId !== undefined ? req.body.customerId : quotation.customerId,
      templateId: req.body.templateId !== undefined ? req.body.templateId : quotation.templateId,
      date: req.body.date !== undefined ? req.body.date : quotation.date,
      items: req.body.items !== undefined ? req.body.items : quotation.items,
      subTotal: req.body.subTotal !== undefined ? req.body.subTotal : quotation.subTotal,
      totalAmount: req.body.totalAmount !== undefined ? req.body.totalAmount : quotation.totalAmount,
      amountInWords: req.body.amountInWords !== undefined ? req.body.amountInWords : quotation.amountInWords,
      status: req.body.status !== undefined ? req.body.status : quotation.status,
    });

    // Auto-send to WhatsApp when a quotation first transitions to SENT and the
    // agency has the quotation auto-send toggle enabled. Best-effort: never block
    // or fail the save on a delivery error.
    if (!wasSent && quotation.status === 'SENT' && documentDeliveryService.isAutoSendEnabled(req.agency, 'quotation')) {
      documentDeliveryService
        .sendQuotation(quotation.id, req.agency, { agentId: req.agent?.id })
        .catch((err) => console.error('[Quotation] auto-send failed:', err.message));
    }

    res.json({ success: true, data: quotation, message: 'Quotation updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const quotation = await Quotation.findOne({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    await quotation.destroy();
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (err) {
    next(err);
  }
}

// GET /api/quotations/:id/pdf - download the rendered quotation PDF
async function downloadPdf(req, res, next) {
  try {
    const { buffer, filename } = await documentPdfService.generateQuotationPdf(req.params.id, req.agency.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// POST /api/quotations/:id/send-whatsapp - generate + send to the customer
async function sendWhatsApp(req, res, next) {
  try {
    const quotation = await Quotation.findOne({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }
    const result = await documentDeliveryService.sendQuotation(quotation.id, req.agency, { agentId: req.agent?.id });
    if (quotation.status === 'DRAFT') {
      await quotation.update({ status: 'SENT' });
    }
    res.json({ success: true, data: result, message: 'Quotation sent on WhatsApp' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  downloadPdf,
  sendWhatsApp,
};
