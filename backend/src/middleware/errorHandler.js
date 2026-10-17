const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/errors');

function errorHandler(err, req, res, _next) {
  let error = err;

  if (err instanceof mongoose.Error.ValidationError) {
    error = new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Request validation failed',
      Object.values(err.errors).map((item) => ({ field: item.path, message: item.message })));
  } else if (err instanceof mongoose.Error.CastError) {
    error = new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid value for ${err.path}`,
      [{ field: err.path, message: 'Invalid identifier or value' }]);
  } else if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'resource';
    error = new ApiError(409, ERROR_CODES.DUPLICATE_RESOURCE, `${field} already exists`,
      [{ field, message: 'Must be unique' }]);
  } else if (err && err.type === 'entity.parse.failed') {
    error = new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Malformed JSON request body');
  } else if (err && err.message === 'Origin is not allowed by CORS') {
    error = new ApiError(403, ERROR_CODES.FORBIDDEN, 'Origin is not allowed by CORS');
  } else if (err && err.name === 'TokenExpiredError') {
    error = new ApiError(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Authentication token has expired');
  } else if (err && err.name === 'JsonWebTokenError') {
    error = new ApiError(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Invalid authentication token');
  } else if (!(err instanceof ApiError)) {
    error = new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'An unexpected server error occurred');
  }

  const body = {
    success: false,
    error: {
      code: error.code || ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
      requestId: req.id || null
    }
  };
  if (error.details) body.error.details = error.details;
  if (process.env.NODE_ENV !== 'production' && error.statusCode >= 500) {
    body.error.debug = { name: err.name || 'Error' };
  }
  if (error.statusCode >= 500) console.error(`[${req.id || 'no-request-id'}]`, err);
  res.status(error.statusCode || 500).json(body);
}

module.exports = errorHandler;
