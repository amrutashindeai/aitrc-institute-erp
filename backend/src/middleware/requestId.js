const { randomUUID } = require('node:crypto');

function requestId(req, res, next) {
  const supplied = req.get('x-request-id');
  // Accept only a short safe correlation token; otherwise create our own.
  req.id = supplied && /^[a-zA-Z0-9._-]{1,100}$/.test(supplied) ? supplied : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

module.exports = requestId;
