const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const env = require('../config/env');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const { getCookieNames } = require('../middleware/auth.middleware');
const { generateOtpCode, hashOtp, sendOtp } = require('../services/otp.service');

function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user._id), jti: crypto.randomBytes(12).toString('hex') },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: '/',
  };
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    mobile: user.mobile,
    email: user.email || '',
    role: user.role,
    isBlocked: user.isBlocked,
    addresses: user.addresses || [],
    hasPushEnabled: (user.fcmTokens || []).length > 0,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

async function issueSessionTokens(user, req, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Keep up to 5 active sessions per user
  const freshUser = await User.findById(user._id).select('+refreshTokens');
  const now = new Date();
  const activeTokens = (freshUser.refreshTokens || []).filter((t) => {
    if (t.expiresAt <= now) return false;
    // Prune rotated tokens older than 30s concurrency grace window
    if (t.usedAt && now.getTime() - new Date(t.usedAt).getTime() > 30 * 1000) return false;
    return true;
  });
  activeTokens.push({ tokenHash: refreshHash, expiresAt });
  freshUser.refreshTokens = activeTokens.slice(-8);
  freshUser.lastLoginAt = now;
  await freshUser.save();

  const cookies = getCookieNames(req);
  res.cookie(cookies.access, accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(cookies.refresh, refreshToken, cookieOptions(30 * 24 * 60 * 60 * 1000));

  return { accessToken, user: sanitizeUser(freshUser) };
}

const register = asyncHandler(async (req, res) => {
  const { name, mobile, email, password } = req.body;
  const existing = await User.findOne({ mobile });
  if (existing) {
    throw new ApiError(409, 'An account with this mobile number already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    mobile,
    email,
    passwordHash,
    role: 'customer',
  });

  const session = await issueSessionTokens(user, req, res);
  return sendSuccess(res, session, 'Account created successfully', 201);
});

const login = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;
  const user = await User.findOne({ mobile }).select('+passwordHash');
  if (!user) {
    throw new ApiError(401, 'Invalid mobile number or password');
  }
  if (user.isBlocked) {
    throw new ApiError(403, 'Your account has been suspended. Please contact support.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Invalid mobile number or password');
  }

  const session = await issueSessionTokens(user, req, res);
  return sendSuccess(res, session, 'Logged in successfully');
});

const refresh = asyncHandler(async (req, res) => {
  const cookies = getCookieNames(req);
  const token = req.cookies?.[cookies.refresh] || req.body?.refreshToken;
  if (!token) {
    throw new ApiError(401, 'Refresh token missing');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(token);
  const user = await User.findById(decoded.sub).select('+refreshTokens');
  if (!user || user.isBlocked) {
    throw new ApiError(401, 'Account unavailable');
  }

  const now = new Date();
  const tokenEntry = (user.refreshTokens || []).find(
    (t) => t.tokenHash === tokenHash && t.expiresAt > now
  );

  // Grace window (30s) avoids false revocation on concurrent requests/reloads
  const recentlyRotated =
    tokenEntry?.usedAt && now.getTime() - new Date(tokenEntry.usedAt).getTime() <= 30 * 1000;

  if (!tokenEntry || (tokenEntry.usedAt && !recentlyRotated)) {
    user.refreshTokens = [];
    await user.save();
    res.clearCookie(cookies.access, { path: '/' });
    res.clearCookie(cookies.refresh, { path: '/' });
    throw new ApiError(401, 'Refresh token revoked. Please log in again.');
  }

  if (!tokenEntry.usedAt) {
    tokenEntry.usedAt = now;
    await user.save();
  }

  const session = await issueSessionTokens(user, req, res);
  return sendSuccess(res, session, 'Session refreshed');
});

const logout = asyncHandler(async (req, res) => {
  const cookies = getCookieNames(req);
  const token = req.cookies?.[cookies.refresh];
  if (token) {
    const tokenHash = hashToken(token);
    await User.updateMany(
      { 'refreshTokens.tokenHash': tokenHash },
      { $pull: { refreshTokens: { tokenHash } } }
    );
  }
  res.clearCookie(cookies.access, { path: '/' });
  res.clearCookie(cookies.refresh, { path: '/' });
  return sendSuccess(res, null, 'Logged out successfully');
});

const getMe = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  return sendSuccess(res, { user: sanitizeUser(req.user) });
});

const updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (name !== undefined) req.user.name = name;
  if (email !== undefined) req.user.email = email;
  await req.user.save();
  return sendSuccess(res, { user: sanitizeUser(req.user) }, 'Profile updated');
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  return sendSuccess(res, null, 'Password updated successfully');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { mobile } = req.body;
  const user = await User.findOne({ mobile }).select('+resetOtpHash +resetOtpExpiresAt');
  // Always return generic message to avoid user enumeration
  if (user && !user.isBlocked) {
    const otp = generateOtpCode();
    user.resetOtpHash = hashOtp(otp);
    user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOtp({ mobile: user.mobile, email: user.email, purpose: 'password_reset', otp });
  }
  return sendSuccess(
    res,
    null,
    'If an account exists with this mobile number, an OTP has been sent.'
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { mobile, otp, newPassword } = req.body;
  const user = await User.findOne({ mobile }).select('+resetOtpHash +resetOtpExpiresAt +refreshTokens');
  if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }
  if (user.resetOtpExpiresAt < new Date() || user.resetOtpHash !== hashOtp(otp)) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetOtpHash = undefined;
  user.resetOtpExpiresAt = undefined;
  user.refreshTokens = [];
  await user.save();

  return sendSuccess(res, null, 'Password has been reset. Please log in with your new password.');
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  sanitizeUser,
};
