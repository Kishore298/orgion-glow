const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const registerPushToken = asyncHandler(async (req, res) => {
  const { token, device = 'web' } = req.body;
  if (!token || typeof token !== 'string' || token.trim().length < 10) {
    throw new ApiError(400, 'Valid FCM push token is required');
  }

  const trimmed = token.trim();
  const existing = req.user.fcmTokens.find((t) => t.token === trimmed);
  if (existing) {
    existing.lastUsedAt = new Date();
    existing.device = device;
  } else {
    req.user.fcmTokens.push({
      token: trimmed,
      device,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });
    // Cap stored tokens per user to 10
    if (req.user.fcmTokens.length > 10) {
      req.user.fcmTokens = req.user.fcmTokens.slice(-10);
    }
  }

  await req.user.save();
  return sendSuccess(res, { hasPushEnabled: true }, 'Push notifications enabled on this device');
});

const removePushToken = asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (token) {
    req.user.fcmTokens = req.user.fcmTokens.filter((t) => t.token !== String(token).trim());
  } else {
    req.user.fcmTokens = [];
  }
  await req.user.save();
  return sendSuccess(
    res,
    { hasPushEnabled: req.user.fcmTokens.length > 0 },
    'Push notifications disabled'
  );
});

module.exports = {
  registerPushToken,
  removePushToken,
};
