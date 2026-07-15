// Thin controllers over catalogMediaLinkService. Matches the property/package house style:
// req.user.agencyId + { status: 'success' }.

const catalogMediaLinkService = require('../services/catalogMediaLinkService');

async function listLinks(req, res, next) {
  try {
    const { agencyId } = req.user;
    const links = await catalogMediaLinkService.listLinks(agencyId, req.query);
    res.json({ status: 'success', data: links });
  } catch (error) {
    next(error);
  }
}

async function createLink(req, res, next) {
  try {
    const { agencyId } = req.user;
    const link = await catalogMediaLinkService.createLink(agencyId, req.body);
    res.status(201).json({ status: 'success', data: link });
  } catch (error) {
    next(error);
  }
}

async function updateLink(req, res, next) {
  try {
    const { agencyId } = req.user;
    const link = await catalogMediaLinkService.updateLink(agencyId, req.params.id, req.body);
    res.json({ status: 'success', data: link });
  } catch (error) {
    next(error);
  }
}

async function deleteLink(req, res, next) {
  try {
    const { agencyId } = req.user;
    const result = await catalogMediaLinkService.deleteLink(agencyId, req.params.id);
    res.json({ status: 'success', data: result, message: 'Link removed' });
  } catch (error) {
    next(error);
  }
}

module.exports = { listLinks, createLink, updateLink, deleteLink };
