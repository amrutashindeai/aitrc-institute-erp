const ApiError = require('./ApiError');
function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid pagination parameters', [
      { field: 'page', message: 'Must be a positive integer' },
      { field: 'limit', message: 'Must be an integer between 1 and 100' }
    ]);
  }
  return { page, limit, skip: (page - 1) * limit };
}
async function paginatedList(Model, filter, query, options = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = options.sort || { createdAt: -1 };
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit).select(options.select || '').populate(options.populate || []).lean(),
    Model.countDocuments(filter)
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
module.exports = { parsePagination, paginatedList };
