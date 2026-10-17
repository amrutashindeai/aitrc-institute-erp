const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
}

module.exports = notFound;
