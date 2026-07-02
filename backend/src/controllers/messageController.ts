const messageService = require('../services/messageService');
const botSessionService = require('../services/botSessionService');

async function list(req, res, next) {
  try {
    const { customerId, limit, since } = req.query;
    if (!customerId) {
      throw Object.assign(new Error('customerId is required'), {
        statusCode: 400,
        code: 'MISSING_PARAM',
      });
    }
    const messages = await messageService.listMessages(customerId, req.agency.id, { limit, since });
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

async function live(req, res, next) {
  try {
    const messages = await messageService.getLiveMessages(req.agency.id, 10);
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

async function threads(req, res, next) {
  try {
    const { limit, q, channelId, channel } = req.query;
    const threads = await messageService.listThreads(req.agency.id, { limit, q, channelId, channel });
    res.json({ success: true, data: threads });
  } catch (err) {
    next(err);
  }
}

async function send(req, res, next) {
  try {
    const message = await messageService.sendMessage(req.body, req.agency.id, req.agent.id);
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

async function assignableAgents(req, res, next) {
  try {
    const agents = await messageService.listAssignableAgents(req.agency.id);
    res.json({ success: true, data: agents });
  } catch (err) {
    next(err);
  }
}

async function assign(req, res, next) {
  try {
    const result = await messageService.assignThread(req.params.customerId, req.body.agentId || null, req.agency.id);
    res.json({ success: true, data: result, message: 'Conversation assignment updated' });
  } catch (err) {
    next(err);
  }
}

async function takeover(req, res, next) {
  try {
    const session = await botSessionService.takeOverConversation(req.params.customerId, req.agency.id, req.agent.id);
    res.json({ success: true, data: session, message: 'Conversation taken over' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  live,
  threads,
  send,
  assignableAgents,
  assign,
  takeover,
};
