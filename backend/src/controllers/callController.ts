const callService = require('../services/callService');

async function start(req, res, next) {
  try {
    const callLog = await callService.startLeadCall(req.body.leadId, req.agency.id, req.agent);
    res.status(201).json({
      success: true,
      data: callLog,
      message: 'Calling your phone now',
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const callLogs = await callService.listCallLogs(req.agency.id, req.query, req.agent);
    res.json({ success: true, data: callLogs });
  } catch (err) {
    next(err);
  }
}

async function connectTwiml(req, res, next) {
  try {
    const twiml = await callService.buildConnectTwiML(req.query.callLogId, req);
    res.type('text/xml').send(twiml);
  } catch (err) {
    next(err);
  }
}

async function recording(req, res, next) {
  try {
    const { stream, contentType, contentLength, filename } = await callService.streamRecording(
      req.params.id,
      req.agency.id,
      req.agent
    );
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

async function inboundTwiml(req, res, next) {
  try {
    const twiml = await callService.buildInboundTwiML(req);
    res.type('text/xml').send(twiml);
  } catch (err) {
    next(err);
  }
}

async function statusWebhook(req, res, next) {
  try {
    await callService.handleStatusWebhook(req);
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

async function recordingWebhook(req, res, next) {
  try {
    await callService.handleRecordingWebhook(req);
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  connectTwiml,
  inboundTwiml,
  list,
  recording,
  recordingWebhook,
  start,
  statusWebhook,
};
