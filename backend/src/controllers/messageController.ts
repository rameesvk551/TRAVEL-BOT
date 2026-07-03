const messageService = require('../services/messageService');
const botSessionService = require('../services/botSessionService');

async function list(req, res, next) {
  try {
    const { customerId, limit, since, before } = req.query;
    if (!customerId) {
      throw Object.assign(new Error('customerId is required'), {
        statusCode: 400,
        code: 'MISSING_PARAM',
      });
    }
    await messageService.assertThreadAccess(customerId, req.agency.id, req.agent);
    const messages = await messageService.listMessages(customerId, req.agency.id, { limit, since, before });
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
    const threads = await messageService.listThreads(req.agency.id, { limit, q, channelId, channel, requester: req.agent });
    res.json({ success: true, data: threads });
  } catch (err) {
    next(err);
  }
}

async function send(req, res, next) {
  try {
    await messageService.assertThreadAccess(req.body.customerId, req.agency.id, req.agent);
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

async function media(req, res, next) {
  try {
    const { stream, contentType, filename, isDocument } = await messageService.getMessageMedia(
      req.params.messageId,
      req.agency.id,
      req.agent
    );
    // Media is customer-uploaded (WhatsApp), so the stored content-type is untrusted.
    // Serving e.g. text/html or image/svg+xml inline on the admin origin would be stored
    // XSS. Allowlist inline-safe types; anything else is downgraded to a generic binary
    // and forced to download. Always block MIME-sniffing and sandbox the response.
    const INLINE_SAFE_TYPES = new Set([
      'image/jpeg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
      'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr', 'audio/wav',
      'video/mp4', 'video/3gpp', 'video/webm',
      'application/pdf',
    ]);
    const rawType = String(contentType || '').split(';')[0].trim().toLowerCase();
    const safeType = INLINE_SAFE_TYPES.has(rawType) ? rawType : 'application/octet-stream';
    const canInline = safeType !== 'application/octet-stream';
    // Strip CR/LF (header injection) and quotes from the filename.
    const safeName = filename ? String(filename).replace(/[\r\n"]/g, '').trim() : '';

    res.setHeader('Content-Type', safeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    const disposition = canInline ? 'inline' : 'attachment';
    if (safeName) {
      res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    } else if (!canInline) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    // If the upstream stream errors after headers are sent, tear the response down.
    stream.on('error', (err) => {
      if (!res.headersSent) {
        next(err);
      } else {
        res.destroy(err);
      }
    });
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

async function takeover(req, res, next) {
  try {
    await messageService.assertThreadAccess(req.params.customerId, req.agency.id, req.agent);
    const session = await botSessionService.takeOverConversation(req.params.customerId, req.agency.id, req.agent.id);
    // Taking over an unassigned chat claims it out of the shared pool.
    await messageService.claimThreadIfUnassigned(req.params.customerId, req.agency.id, req.agent.id);
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
  media,
  takeover,
};
