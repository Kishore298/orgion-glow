const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const { ApiError } = require('../utils/apiResponse');

const ACCESS_COOKIE = 'orgion_access_token';
const REFRESH_COOKIE = 'orgion_refresh_token';
const ADMIN_ACCESS_COOKIE = 'orgion_admin_access_token';
const ADMIN_REFRESH_COOKIE = 'orgion_admin_refresh_token';

function isAdminPortal(req) {
  return req.headers['x-orgion-portal'] === 'admin';
}

function getCookieNames(req) {
  return isAdminPortal(req)
    ? { access: ADMIN_ACCESS_COOKIE, refresh: ADMIN_REFRESH_COOKIE }
    : { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE };
}

function extractToken(req) {
  const { access } = getCookieNames(req);
  if (req.cookies && req.cookies[access]) {
    return req.cookies[access];
  }
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch {
      throw new ApiError(401, 'Invalid or expired access token');
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new ApiError(401, 'Account not found');
    }
    if (user.isBlocked) {
      throw new ApiError(403, 'Your account has been suspended. Please contact support.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.sub);
    if (user && !user.isBlocked) {
      req.user = user;
    }
  } catch {
    // ignore invalid optional token
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  getCookieNames,
  authenticate,
  optionalAuth,
  requireRole,
};
