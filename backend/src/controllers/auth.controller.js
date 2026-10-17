const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const config = require('../config/env');

const login = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user && user.isActive && await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  user.lastLoginAt = new Date();
  await user.save();
  const token = jwt.sign({ role: user.role }, config.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: 'institute-erp-api',
    audience: 'institute-erp-client'
  });
  return success(res, { accessToken: token, tokenType: 'Bearer', expiresIn: config.JWT_ACCESS_EXPIRES_IN, user: serializeDocument(user) });
});

const me = asyncHandler(async (req, res) => success(res, { user: serializeDocument(req.user) }));

const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Current password is incorrect', [{ field: 'currentPassword', message: 'Does not match current password' }]);
  }
  if (await bcrypt.compare(req.body.newPassword, user.passwordHash)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'New password must differ from current password', [{ field: 'newPassword', message: 'Choose a different password' }]);
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, config.BCRYPT_SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  await user.save();
  return success(res, { message: 'Password changed successfully. Sign in again if other sessions are active.' });
});

// JWT access tokens are stateless. Client discards its token on logout; refresh-token rotation is a separate optional feature.
const logout = asyncHandler(async (_req, res) => success(res, { message: 'Logged out. Discard the access token on the client.' }));

module.exports = { login, me, changePassword, logout };
