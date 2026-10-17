const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');
const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.resourceType) filter.resourceType = req.query.resourceType;
  if (req.query.actorId) filter.actorId = req.query.actorId;
  if (req.query.from || req.query.to) filter.createdAt = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to) } : {}) };
  if (req.user.role === 'HOD') filter.departmentId = { $in: req.user.departmentIds };
  if (req.user.role === 'COMMITTEE_HEAD') filter.actorId = req.user._id;
  if (req.user.role === 'FACULTY') throw new ApiError(403, 'FORBIDDEN', 'Audit log access is not available for faculty');
  const result = await paginatedList(AuditLog, filter, req.query, { sort: { createdAt: -1 }, populate: [{ path: 'actorId', select: 'name role email' }] });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
module.exports = { list };
