// FILE: /backend/src/middleware/authenticate.js
// DEPS: jsonwebtoken
// ENV: JWT_SECRET

const jwt = require('jsonwebtoken');
const { Agent, Agency } = require('../models');

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches req.agent and req.agency to the request.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required. Please include Authorization: Bearer <token>',
        code: 'AUTH_TOKEN_MISSING',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Access token expired. Please refresh your token.',
          code: 'AUTH_TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid access token.',
        code: 'AUTH_TOKEN_INVALID',
      });
    }

    const agent = await Agent.findByPk(decoded.agentId, {
      attributes: { exclude: ['passwordHash'] },
    });

    if (!agent) {
      return res.status(401).json({
        success: false,
        error: 'Agent account not found.',
        code: 'AUTH_AGENT_NOT_FOUND',
      });
    }

    const agency = await Agency.findByPk(decoded.agencyId);
    if (!agency || !agency.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Agency is inactive or not found.',
        code: 'AUTH_AGENCY_INACTIVE',
      });
    }

    req.agent = agent;
    req.agency = agency;
    next();
  } catch (err) {
    console.error('[authenticate] error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed.',
      code: 'AUTH_INTERNAL_ERROR',
    });
  }
}

module.exports = authenticate;
