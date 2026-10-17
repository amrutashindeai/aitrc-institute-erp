const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A bearer access token is required');
  let payload;
  try { payload = jwt.verify(match[1], config.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'institute-erp-api', audience: 'institute-erp-client' }); }
  catch (error) { throw new ApiError(401, 'AUTHENTICATION_REQUIRED', error.name === 'TokenExpiredError' ? 'Access token has expired' : 'Invalid access token'); }
  if (!payload.sub) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Invalid access token');
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'User account is unavailable');
  req.user = user;
  next();
});

module.exports = authenticate;
