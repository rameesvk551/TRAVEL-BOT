const platformAuthService = require('../services/platformAuthService');

async function login(req, res, next) {
  try {
    const result = await platformAuthService.login(req.body.email, req.body.password, req);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await platformAuthService.refreshAccessToken(req.body.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await platformAuthService.logout(req.body.refreshToken, req.platformAdmin?.id, req);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const profile = await platformAuthService.getProfile(req.platformAdmin.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  refresh,
  logout,
  me,
};
