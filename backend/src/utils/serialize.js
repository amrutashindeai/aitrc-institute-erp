function serializeDocument(doc) {
  if (!doc) return null;
  const value = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (value._id && !value.id) value.id = String(value._id);
  delete value._id;
  delete value.__v;
  delete value.passwordHash;
  delete value.storageKey;
  return value;
}
function success(res, data, status = 200, meta = undefined) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}
module.exports = { serializeDocument, success };
