const ApiError = require('../utils/ApiError');

function validate(schema, source = 'body') {
  return function validateRequest(req, _res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.issues.map((issue) => ({
        field: [source, ...issue.path].join('.'), message: issue.message
      }))));
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = validate;
