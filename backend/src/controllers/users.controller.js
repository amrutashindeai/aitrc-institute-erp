const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const Committee = require('../models/Committee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');
const config = require('../config/env');
const { ROLES } = require('../constants/roles');

const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.role) { if (!ROLES.includes(req.query.role)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid role filter'); filter.role = req.query.role; }
  if (req.query.search) filter.$or = [{ name: { $regex: escapeRegex(req.query.search), $options: 'i' } }, { email: { $regex: escapeRegex(req.query.search), $options: 'i' } }];
  if (req.user.role === 'HOD') filter.departmentIds = { $in: req.user.departmentIds };
  if (req.user.role === 'COMMITTEE_HEAD') filter.committeeIds = { $in: req.user.committeeIds };
  const result = await paginatedList(User, filter, req.query, { select: '-passwordHash' });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
const create = asyncHandler(async (req, res) => {
  const { password, ...data } = req.body;
  for (const id of data.departmentIds || []) if (!(await Department.exists({ _id: id, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'A department is invalid or inactive');
  for (const id of data.committeeIds || []) if (!(await Committee.exists({ _id: id, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'A committee is invalid or inactive');
  const passwordHash = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);
  const user = await User.create({ ...data, passwordHash });
  return success(res, serializeDocument(user), 201);
});
const getById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  enforceUserScope(req.user, user);
  return success(res, serializeDocument(user));
});
const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  enforceUserScope(req.user, user);
  if (req.body.departmentIds) {
    for (const id of req.body.departmentIds) if (!(await Department.exists({ _id: id, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'A department is invalid or inactive');
  }
  if (req.body.committeeIds) {
    for (const id of req.body.committeeIds) if (!(await Committee.exists({ _id: id, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'A committee is invalid or inactive');
  }
  const previousCommitteeIds = user.committeeIds.map(String);
  Object.assign(user, req.body);
  await user.save();
  if (req.body.committeeIds) {
    const currentCommitteeIds = user.committeeIds.map(String);
    const removed = previousCommitteeIds.filter(id => !currentCommitteeIds.includes(id));
    const added = currentCommitteeIds.filter(id => !previousCommitteeIds.includes(id));
    if (removed.length) await Committee.updateMany({ _id: { $in: removed } }, { $pull: { memberIds: user._id } });
    if (added.length) await Committee.updateMany({ _id: { $in: added } }, { $addToSet: { memberIds: user._id } });
  }
  if (req.body.departmentIds) await Department.updateMany({ hodId: user._id, _id: { $nin: user.departmentIds } }, { $set: { hodId: null } });
  return success(res, serializeDocument(user));
});
const setStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  if (String(user._id) === String(req.user._id) && req.body.isActive === false) throw new ApiError(400, 'VALIDATION_ERROR', 'You cannot deactivate your own account');
  user.isActive = req.body.isActive;
  await user.save();
  return success(res, serializeDocument(user));
});
const changeRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  if (req.body.role !== 'HOD' && await Department.exists({ hodId: user._id })) throw new ApiError(400, 'VALIDATION_ERROR', 'Reassign this user’s HOD departments before changing their role');
  if (req.body.role !== 'COMMITTEE_HEAD' && await Committee.exists({ headId: user._id })) throw new ApiError(400, 'VALIDATION_ERROR', 'Reassign this user’s committee leadership before changing their role');
  user.role = req.body.role;
  await user.save();
  return success(res, serializeDocument(user));
});
function enforceUserScope(actor, target) {
  if (actor.role === 'HOD' && !target.departmentIds.some(id => actor.departmentIds.some(own => String(own) === String(id)))) throw new ApiError(403, 'FORBIDDEN', 'User is outside your department scope');
  if (actor.role === 'COMMITTEE_HEAD' && !target.committeeIds.some(id => actor.committeeIds.some(own => String(own) === String(id)))) throw new ApiError(403, 'FORBIDDEN', 'User is outside your committee scope');
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
module.exports = { list, create, getById, update, setStatus, changeRole };
