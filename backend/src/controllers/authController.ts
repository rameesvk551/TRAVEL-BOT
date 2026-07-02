const authService = require('../services/authService');
const brandingService = require('../services/brandingService');
const appManifestService = require('../services/appManifestService');

// Refresh token is mirrored into a first-party HttpOnly cookie so the session
// survives where localStorage does not — notably Safari/Mac & iOS standalone
// PWAs, which evict script-writable storage after ~7 days of inactivity.
const REFRESH_COOKIE = 'rt';
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30d — matches refresh token TTL

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // The dashboard talks to the API cross-origin (separate app host, plus
    // white-label partner domains), so the refresh cookie MUST be sent on
    // cross-site XHR. That requires SameSite=None, which browsers only honor
    // together with Secure (HTTPS). Fall back to Lax in dev where there's no
    // HTTPS and None would be silently dropped. This is the fix that lets the
    // cookie survive as the session fallback on iOS/Safari PWAs.
    sameSite: isProd ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  // Attributes (esp. sameSite/secure/path) must match the set options or the
  // browser won't clear the cookie.
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}

// Read the refresh cookie without requiring cookie-parser middleware.
function readRefreshCookie(req) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ success: true, data: result, message: 'Registration successful' });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    // Two possible sources: the request body (web app localStorage) and the
    // HttpOnly cookie (Safari/PWA fallback). They can diverge — e.g. a stale
    // localStorage token left behind after a rotation on another tab/device.
    const bodyToken = req.body.refreshToken || null;
    const cookieToken = readRefreshCookie(req);
    if (!bodyToken && !cookieToken) {
      throw Object.assign(new Error('Refresh token is required'), { statusCode: 401, code: 'NO_REFRESH_TOKEN' });
    }

    let result;
    try {
      result = await authService.refreshAccessToken(bodyToken || cookieToken);
    } catch (err) {
      // A stale/revoked body token must NOT lock the user out when a still-valid
      // cookie session exists. If the body token failed and the cookie carries a
      // different token, retry with the cookie before giving up.
      if (bodyToken && cookieToken && cookieToken !== bodyToken) {
        result = await authService.refreshAccessToken(cookieToken);
      } else {
        throw err;
      }
    }

    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json({
      success: true,
      message: 'If an account exists for this email, a reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ success: true, message: 'Password reset successful. Please sign in with your new password.' });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const rawToken = req.body.refreshToken || readRefreshCookie(req);
    if (rawToken) {
      await authService.logout(rawToken);
    }
    clearRefreshCookie(res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const profile = await authService.getProfile(req.agent.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

// GET /api/me/app-manifest
// Returns the per-tenant navigation manifest that drives the React Native mobile
// shell (tabs, modules, labels, branding, home widgets). See
// docs/plans/2026-07-01-mobile-app-adaptive-navigation.md and appManifestService.
async function appManifest(req, res, next) {
  try {
    const branding = await brandingService.brandingForAgency(req.agency);
    const manifest = appManifestService.buildManifest({
      agency: req.agency,
      agent: req.agent,
      branding,
    });
    res.json({ success: true, data: manifest });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
  appManifest,
};
