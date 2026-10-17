const Activity = require('../models/Activity');
const ActivityAssignment = require('../models/ActivityAssignment');
const WorkflowHistory = require('../models/WorkflowHistory');
const User = require('../models/User');
const Department = require('../models/Department');
const Committee = require('../models/Committee');
const AcademicYear = require('../models/AcademicYear');
const Evidence = require('../models/Evidence');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');
const { transitionActivity } = require('../services/activityWorkflow.service');

function scopeFilter(user) {
  if (user.role === 'HOD') return { departmentId: { $in: user.departmentIds } };
  if (user.role === 'COMMITTEE_HEAD') return { committeeId: { $in: user.committeeIds } };
  if (user.role === 'FACULTY') return { $or: [{ ownerId: user._id }, { _id: { $in: [] } }] };
  return {};
}
async function canAccess(user, activity) {
  if (['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(user.role)) return true;
  const departmentId = activity.departmentId && typeof activity.departmentId === 'object' ? (activity.departmentId._id || activity.departmentId.id) : activity.departmentId;
  const committeeId = activity.committeeId && typeof activity.committeeId === 'object' ? (activity.committeeId._id || activity.committeeId.id) : activity.committeeId;
  if (user.role === 'HOD') return Boolean(departmentId && user.departmentIds.some(id => String(id) === String(departmentId)));
  if (user.role === 'COMMITTEE_HEAD') return Boolean(committeeId && user.committeeIds.some(id => String(id) === String(committeeId)));
  if (String(activity.ownerId || '') === String(user._id) || String(activity.createdBy) === String(user._id)) return true;
  return Boolean(await ActivityAssignment.exists({ activityId: activity._id, assigneeId: user._id, isActive: true }));
}
const list = asyncHandler(async (req, res) => {
  const filter = { isArchived: false, ...scopeFilter(req.user) };
  if (req.user.role === 'FACULTY') {
    const assignedIds = await ActivityAssignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
    filter.$or = [...(filter.$or || []), { _id: { $in: assignedIds } }];
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.academicYearId) filter.academicYearId = req.query.academicYearId;
  if (req.query.departmentId && ['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(req.user.role)) filter.departmentId = req.query.departmentId;
  if (req.query.search) filter.title = { $regex: req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const result = await paginatedList(Activity, filter, req.query, { populate: [{ path: 'departmentId', select: 'name code' }, { path: 'committeeId', select: 'name code' }, { path: 'academicYearId', select: 'name' }] });
  const now = new Date();
  return success(res, result.items.map(item => ({ ...serializeDocument(item), isOverdue: item.dueDate < now && !['VERIFIED', 'CLOSED'].includes(item.status) })), 200, result.meta);
});
const create = asyncHandler(async (req, res) => {
  if (req.body.departmentId && !(await Department.exists({ _id: req.body.departmentId, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid or inactive department');
  if (req.body.committeeId && !(await Committee.exists({ _id: req.body.committeeId, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid or inactive committee');
  const year = await AcademicYear.findById(req.body.academicYearId);
  if (!year || year.isArchived) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid or archived academic year');
  if (req.body.dueDate < year.startDate || req.body.dueDate > year.endDate || (req.body.startAt && (req.body.startAt < year.startDate || req.body.startAt > year.endDate))) throw new ApiError(400, 'VALIDATION_ERROR', 'Activity dates must fall within the academic year');
  if (req.user.role === 'HOD' && (!req.body.departmentId || !req.user.departmentIds.some(id => String(id) === String(req.body.departmentId)))) throw new ApiError(403, 'FORBIDDEN', 'Activity must belong to your department');
  if (req.user.role === 'COMMITTEE_HEAD' && (!req.body.committeeId || !req.user.committeeIds.some(id => String(id) === String(req.body.committeeId)))) throw new ApiError(403, 'FORBIDDEN', 'Activity must belong to your committee');
  if (req.body.ownerId) {
    const owner = await User.findById(req.body.ownerId);
    if (!owner || !owner.isActive) throw new ApiError(400, 'VALIDATION_ERROR', 'ownerId must reference an active user');
    if (req.body.departmentId && !owner.departmentIds.some(id => String(id) === String(req.body.departmentId))) throw new ApiError(400, 'VALIDATION_ERROR', 'Owner must belong to the activity department');
    if (req.body.committeeId && !owner.committeeIds.some(id => String(id) === String(req.body.committeeId))) throw new ApiError(400, 'VALIDATION_ERROR', 'Owner must belong to the activity committee');
  }
  if (req.body.startAt && req.body.dueDate < req.body.startAt) throw new ApiError(400, 'VALIDATION_ERROR', 'dueDate cannot be before startAt');
  const activity = await Activity.create({ ...req.body, createdBy: req.user._id });
  await WorkflowHistory.create({ activityId: activity._id, actorId: req.user._id, fromStatus: null, toStatus: 'PLANNED', comment: 'Activity created' });
  return success(res, serializeDocument(activity), 201);
});
const getById = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id).populate('departmentId', 'name code').populate('committeeId', 'name code').populate('academicYearId', 'name');
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
  if (!(await canAccess(req.user, activity))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope');
  return success(res, serializeDocument(activity));
});
const update = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
  if (!(await canAccess(req.user, activity))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope');
  if (!['PLANNED', 'ASSIGNED'].includes(activity.status)) throw new ApiError(409, 'INVALID_TRANSITION', 'Activity details cannot be edited after work begins');
  if (req.body.departmentId !== undefined) {
    if (req.body.departmentId && !(await Department.exists({ _id: req.body.departmentId, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid or inactive department');
    if (req.user.role === 'HOD' && (!req.body.departmentId || !req.user.departmentIds.some(id => String(id) === String(req.body.departmentId)))) throw new ApiError(403, 'FORBIDDEN', 'Activity must remain within your department');
  }
  if (req.body.committeeId !== undefined) {
    if (req.body.committeeId && !(await Committee.exists({ _id: req.body.committeeId, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid or inactive committee');
    if (req.user.role === 'COMMITTEE_HEAD' && (!req.body.committeeId || !req.user.committeeIds.some(id => String(id) === String(req.body.committeeId)))) throw new ApiError(403, 'FORBIDDEN', 'Activity must remain within your committee');
  }
  const targetYearId = req.body.academicYearId || activity.academicYearId;
  const year = await AcademicYear.findById(targetYearId);
  if (!year || year.isArchived) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid or archived academic year');
  const startAt = req.body.startAt === undefined ? activity.startAt : req.body.startAt;
  const dueDate = req.body.dueDate === undefined ? activity.dueDate : req.body.dueDate;
  if (startAt && dueDate < startAt) throw new ApiError(400, 'VALIDATION_ERROR', 'dueDate cannot be before startAt');
  if (dueDate < year.startDate || dueDate > year.endDate || (startAt && (startAt < year.startDate || startAt > year.endDate))) throw new ApiError(400, 'VALIDATION_ERROR', 'Activity dates must fall within the academic year');
  if (req.body.ownerId !== undefined && req.body.ownerId) {
    const owner = await User.findById(req.body.ownerId);
    const departmentId = req.body.departmentId === undefined ? activity.departmentId : req.body.departmentId;
    const committeeId = req.body.committeeId === undefined ? activity.committeeId : req.body.committeeId;
    if (!owner || !owner.isActive) throw new ApiError(400, 'VALIDATION_ERROR', 'ownerId must reference an active user');
    if (departmentId && !owner.departmentIds.some(id => String(id) === String(departmentId))) throw new ApiError(400, 'VALIDATION_ERROR', 'Owner must belong to the activity department');
    if (committeeId && !owner.committeeIds.some(id => String(id) === String(committeeId))) throw new ApiError(400, 'VALIDATION_ERROR', 'Owner must belong to the activity committee');
  }
  Object.assign(activity, req.body);
  await activity.save();
  return success(res, serializeDocument(activity));
});
const assign = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
  if (!(await canAccess(req.user, activity))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope');
  const assignee = await User.findById(req.body.assigneeId);
  if (!assignee || !assignee.isActive || !['FACULTY', 'HOD', 'COMMITTEE_HEAD'].includes(assignee.role)) throw new ApiError(400, 'VALIDATION_ERROR', 'Assignee must be an active eligible user');
  if (activity.departmentId && !assignee.departmentIds.some(id => String(id) === String(activity.departmentId))) throw new ApiError(400, 'VALIDATION_ERROR', 'Assignee must belong to the activity department');
  if (activity.committeeId && !assignee.committeeIds.some(id => String(id) === String(activity.committeeId))) throw new ApiError(400, 'VALIDATION_ERROR', 'Assignee must belong to the activity committee');
  if (req.body.dueDate && req.body.dueDate > activity.dueDate) throw new ApiError(400, 'VALIDATION_ERROR', 'Assignment dueDate cannot be later than activity dueDate');
  const assignment = await ActivityAssignment.create({ ...req.body, activityId: activity._id, assignedBy: req.user._id });
  if (activity.status === 'PLANNED') await transitionActivity({ activity, actor: req.user, toStatus: 'ASSIGNED', comment: 'Responsible person assigned' });
  return success(res, serializeDocument(assignment), 201);
});
const updateAssignment = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity || !(await canAccess(req.user, activity))) throw new ApiError(404, 'NOT_FOUND', 'Activity assignment not found');
  const assignment = await ActivityAssignment.findOne({ _id: req.params.assignmentId, activityId: activity._id });
  if (!assignment) throw new ApiError(404, 'NOT_FOUND', 'Activity assignment not found');
  if (req.body.isActive === false) { assignment.isActive = false; assignment.endedAt = new Date(); }
  if (req.body.responsibility !== undefined) assignment.responsibility = req.body.responsibility;
  if (req.body.dueDate !== undefined) assignment.dueDate = req.body.dueDate;
  await assignment.save();
  return success(res, serializeDocument(assignment));
});
const transition = (toStatus) => asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
  if (!(await canAccess(req.user, activity))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope');
  const isAssigned = await ActivityAssignment.exists({ activityId: activity._id, assigneeId: req.user._id, isActive: true });
  if (['IN_PROGRESS', 'SUBMITTED'].includes(toStatus) && !isAssigned && String(activity.ownerId || '') !== String(req.user._id) && !['DIRECTOR', 'PRINCIPAL', 'ADMIN', 'HOD', 'COMMITTEE_HEAD'].includes(req.user.role)) throw new ApiError(403, 'FORBIDDEN', 'Only assigned users can perform this workflow action');
  if (toStatus === 'VERIFIED' && !['DIRECTOR', 'PRINCIPAL', 'HOD', 'COMMITTEE_HEAD', 'ADMIN'].includes(req.user.role)) throw new ApiError(403, 'FORBIDDEN', 'Your role cannot verify activities');
  if (toStatus === 'CLOSED' && !['DIRECTOR', 'PRINCIPAL', 'HOD', 'ADMIN'].includes(req.user.role)) throw new ApiError(403, 'FORBIDDEN', 'Your role cannot close activities');
  await transitionActivity({ activity, actor: req.user, toStatus, comment: req.body.comment || '' });
  return success(res, serializeDocument(activity));
});
const history = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
  if (!(await canAccess(req.user, activity))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope');
  const entries = await WorkflowHistory.find({ activityId: activity._id }).sort({ createdAt: 1 }).populate('actorId', 'name role');
  return success(res, entries.map(serializeDocument));
});
const evidenceRequirements = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
  if (!(await canAccess(req.user, activity))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope');
  const requirements = await Promise.all((activity.requiredEvidence || []).map(async type => ({ type, satisfied: Boolean(await Evidence.exists({ activityId: activity._id, documentType: type, isLatestVersion: true, isArchived: false })) })));
  return success(res, requirements);
});
module.exports = { list, create, getById, update, assign, updateAssignment, start: transition('IN_PROGRESS'), submit: transition('SUBMITTED'), returnActivity: transition('RETURNED'), verify: transition('VERIFIED'), close: transition('CLOSED'), history, evidenceRequirements };
