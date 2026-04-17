const whatsappFlowService = require('../services/whatsappFlowService');

async function handleFlowRequest(req, res, next) {
  try {
    const result = await whatsappFlowService.handleFlowRequest(req.body);

    if (result.isEncrypted) {
      res.status(result.statusCode).type('text/plain').send(result.body);
      return;
    }

    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleFlowRequest,
};
