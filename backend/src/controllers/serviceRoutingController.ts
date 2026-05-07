const serviceRoutingService = require('../services/serviceRoutingService');

async function list(req, res, next) {
  try {
    const rules = await serviceRoutingService.listRoutingRules(req.agency.id);
    res.json({
      success: true,
      data: {
        intents: serviceRoutingService.DEFAULT_INTENTS,
        rules,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function replace(req, res, next) {
  try {
    const rules = await serviceRoutingService.replaceRoutingRules(req.agency.id, req.body.rules);
    res.json({
      success: true,
      data: {
        intents: serviceRoutingService.DEFAULT_INTENTS,
        rules,
      },
      message: 'Service routing updated',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  replace,
};
