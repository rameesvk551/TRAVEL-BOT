const serviceRoutingService = require('../services/serviceRoutingService');

async function list(req, res, next) {
  try {
    const rules = await serviceRoutingService.listRoutingRules(req.agency.id);
    const intents = await serviceRoutingService.getDynamicIntents(req.agency.id);
    const strategy = await serviceRoutingService.getRoutingStrategy(req.agency.id);
    res.json({
      success: true,
      data: {
        intents,
        rules,
        strategy,
        strategies: serviceRoutingService.ROUTING_STRATEGIES,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function setStrategy(req, res, next) {
  try {
    const strategy = await serviceRoutingService.setRoutingStrategy(req.agency.id, req.body.strategy);
    res.json({
      success: true,
      data: { strategy },
      message: 'Lead routing strategy updated',
    });
  } catch (err) {
    next(err);
  }
}

async function replace(req, res, next) {
  try {
    const rules = await serviceRoutingService.replaceRoutingRules(req.agency.id, req.body.rules);
    const intents = await serviceRoutingService.getDynamicIntents(req.agency.id);
    res.json({
      success: true,
      data: {
        intents,
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
  setStrategy,
};
