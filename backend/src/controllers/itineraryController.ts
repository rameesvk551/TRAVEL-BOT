const itineraryService = require('../services/itineraryService');
const { PDFDocument } = require('pdf-lib');
const mediaService = require('../services/mediaService');

function cleanPdfTitle(value = '') {
  return String(value || '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function withPdfMetadata(buffer, title) {
  try {
    const pdf = await PDFDocument.load(buffer);
    const safeTitle = cleanPdfTitle(title || 'Travel Itinerary');
    pdf.setTitle(safeTitle);
    pdf.setSubject(`Travel itinerary: ${safeTitle}`);
    pdf.setAuthor('Wayon Travels');
    pdf.setProducer('TravelBot');
    pdf.setCreator('TravelBot');
    return Buffer.from(await pdf.save());
  } catch (_err) {
    return buffer;
  }
}

async function list(req, res, next) {
  try {
    const itineraries = await itineraryService.listItineraries(req.agency.id);
    res.json({ success: true, data: itineraries });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const itinerary = await itineraryService.getItineraryById(req.params.id, req.agency.id);
    res.json({ success: true, data: itinerary });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const itinerary = await itineraryService.createItinerary(req.body, req.agency.id);
    res.status(201).json({ success: true, data: itinerary, message: 'Itinerary created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const itinerary = await itineraryService.updateItinerary(req.params.id, req.agency.id, req.body);
    res.json({ success: true, data: itinerary, message: 'Itinerary updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await itineraryService.deleteItinerary(req.params.id, req.agency.id);
    res.json({ success: true, message: 'Itinerary deleted' });
  } catch (err) {
    next(err);
  }
}

async function uploadPdf(req, res, next) {
  try {
    if (!req.file) {
      throw Object.assign(new Error('PDF file is required'), {
        statusCode: 400,
        code: 'PDF_FILE_REQUIRED',
      });
    }

    const itinerary = await itineraryService.getItineraryById(req.params.id, req.agency.id);
    const fileName = req.file.originalname || `${itinerary.name || 'itinerary'}.pdf`;
    const pdfBuffer = await withPdfMetadata(req.file.buffer, itinerary.name || fileName);
    const uploaded = await mediaService.uploadItineraryPdf(
      pdfBuffer,
      req.agency.id,
      itinerary.id,
      fileName
    );
    const updated = await itineraryService.updateItinerary(req.params.id, req.agency.id, {
      pdfUrl: uploaded.secureUrl,
    });

    res.json({
      success: true,
      data: {
        itinerary: updated,
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        fileName: uploaded.originalFilename,
      },
      message: 'Itinerary PDF uploaded',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  uploadPdf,
  remove,
};
