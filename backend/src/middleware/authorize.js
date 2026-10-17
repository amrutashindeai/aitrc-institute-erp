const ApiError = require('../utils/ApiError');

function authorize(...allowedRoles) {
  return function roleAuthorization(req, _res, next) {
    if (!req.user) return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
    if (!allowedRoles.includes(req.user.role)) return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    return next();
  };
}

function requireScope(scopeResolver) {
  return async function scopeAuthorization(req, _res, next) {
    try {
      const allowed = await scopeResolver(req);
      if (!allowed) return next(new ApiError(403, 'FORBIDDEN', 'The requested resource is outside your authorized scope'));
      return next();
    } catch (error) { return next(error); }
  };
}

module.exports = { authorize, requireScope };
