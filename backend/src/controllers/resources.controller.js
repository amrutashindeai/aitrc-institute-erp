const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');
const User = require('../models/User');
const Department = require('../models/Department');
const Committee = require('../models/Committee');
const AcademicYear = require('../models/AcademicYear');
const CalendarEvent = require('../models/CalendarEvent');

async function searchFilter(Model, req) {
  const filter = {};
  if (Model.modelName === 'CalendarEvent') filter.isArchived = false;
  const clauses = [];
  if (req.query.isActive !== undefined && ['User', 'Department', 'Committee'].includes(Model.modelName)) filter.isActive = req.query.isActive === 'true';
  if (req.query.academicYearId && Model.modelName === 'CalendarEvent') filter.academicYearId = req.query.academicYearId;
  if (req.query.departmentId && Model.modelName === 'CalendarEvent') filter.departmentIds = req.query.departmentId;
  if (req.query.departmentId && Model.modelName === 'Committee') filter.departmentId = req.query.departmentId;
  if (req.query.search) {
    const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fields = Model.modelName === 'AcademicYear' ? ['name'] : ['name', 'title', 'code'];
    clauses.push({ $or: fields.map(field => ({ [field]: { $regex: safe, $options: 'i' } })) });
  }
  if (req.user.role === 'HOD' && Model.modelName === 'CalendarEvent') clauses.push({ $or: [{ visibility: 'INSTITUTION' }, { departmentIds: { $in: req.user.departmentIds } }] });
  if (req.user.role === 'COMMITTEE_HEAD' && Model.modelName === 'CalendarEvent') clauses.push({ $or: [{ visibility: 'INSTITUTION' }, { committeeIds: { $in: req.user.committeeIds } }] });
  if (req.user.role === 'FACULTY' && Model.modelName === 'CalendarEvent') {
    const ActivityAssignment = require('../models/ActivityAssignment');
    const assignedActivityIds = await ActivityAssignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
    clauses.push({ $or: [{ visibility: 'INSTITUTION' }, { departmentIds: { $in: req.user.departmentIds } }, { committeeIds: { $in: req.user.committeeIds } }, { createdBy: req.user._id }, { activityId: { $in: assignedActivityIds } }] });
  }
  if (req.user.role === 'HOD' && Model.modelName === 'Committee') filter.departmentId = { $in: req.user.departmentIds };
  if (req.user.role === 'HOD' && Model.modelName === 'Department') filter._id = { $in: req.user.departmentIds };
  if (req.user.role === 'COMMITTEE_HEAD' && Model.modelName === 'Committee') filter._id = { $in: req.user.committeeIds };
  if (req.user.role === 'FACULTY' && Model.modelName === 'User') filter._id = req.user._id;
  if (clauses.length) filter.$and = clauses;
  return filter;
}

function list(Model) { return asyncHandler(async (req, res) => {
  const result = await paginatedList(Model, await searchFilter(Model, req), req.query);
  return success(res, result.items.map(serializeDocument), 200, result.meta);
}); }
function getById(Model) { return asyncHandler(async (req, res) => {
  const item = await Model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'NOT_FOUND', `${Model.modelName} not found`);
  await enforceScope(req.user, item, Model.modelName);
  return success(res, serializeDocument(item));
}); }
function create(Model, extra = () => ({})) { return asyncHandler(async (req, res) => {
  const data = { ...req.body, ...extra(req) };
  if (Model === Department && data.hodId) {
    const hod = await User.findById(data.hodId);
    if (!hod || !hod.isActive || hod.role !== 'HOD') throw new ApiError(400, 'VALIDATION_ERROR', 'hodId must reference an active HOD user');
  }
  if (Model === Committee) {
    const head = await User.findById(data.headId);
    if (!head || !head.isActive || head.role !== 'COMMITTEE_HEAD') throw new ApiError(400, 'VALIDATION_ERROR', 'headId must reference an active COMMITTEE_HEAD');
    const ids = [...new Set([...(data.memberIds || []), String(data.headId)])];
    const count = await User.countDocuments({ _id: { $in: ids }, isActive: true });
    if (count !== ids.length) throw new ApiError(400, 'VALIDATION_ERROR', 'All committee members must be active users');
    data.memberIds = ids;
  }
  if (Model === CalendarEvent) {
    data.departmentIds = [...new Set((data.departmentIds || []).map(String))];
    data.committeeIds = [...new Set((data.committeeIds || []).map(String))];
    const actor = req.user;
    if (actor.role === 'HOD') {
      if (!['DEPARTMENT', 'ASSIGNED'].includes(data.visibility)) throw new ApiError(403, 'FORBIDDEN', 'HOD users cannot create institution-wide or committee-wide events');
      if (data.departmentIds.some(id => !actor.departmentIds.some(own => String(own) === id))) throw new ApiError(403, 'FORBIDDEN', 'Event department is outside your scope');
      if (data.visibility === 'DEPARTMENT' && !data.departmentIds.length) data.departmentIds = actor.departmentIds.map(String);
    }
    if (actor.role === 'COMMITTEE_HEAD') {
      if (!['COMMITTEE', 'ASSIGNED'].includes(data.visibility)) throw new ApiError(403, 'FORBIDDEN', 'Committee heads cannot create institution-wide or department-wide events');
      if (data.committeeIds.some(id => !actor.committeeIds.some(own => String(own) === id))) throw new ApiError(403, 'FORBIDDEN', 'Event committee is outside your scope');
      if (data.visibility === 'COMMITTEE' && !data.committeeIds.length) data.committeeIds = actor.committeeIds.map(String);
    }
    if (data.visibility === 'DEPARTMENT' && !data.departmentIds.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Select at least one department for a department event');
    if (data.visibility === 'COMMITTEE' && !data.committeeIds.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Select at least one committee for a committee event');
    if (data.visibility === 'ASSIGNED' && !data.activityId) throw new ApiError(400, 'VALIDATION_ERROR', 'An activityId is required for an assigned event');
    if (data.departmentIds.length) {
      const count = await Department.countDocuments({ _id: { $in: data.departmentIds }, isActive: true });
      if (count !== data.departmentIds.length) throw new ApiError(400, 'VALIDATION_ERROR', 'One or more departments are invalid or inactive');
    }
    if (data.committeeIds.length) {
      const count = await Committee.countDocuments({ _id: { $in: data.committeeIds }, isActive: true });
      if (count !== data.committeeIds.length) throw new ApiError(400, 'VALIDATION_ERROR', 'One or more committees are invalid or inactive');
    }
    if (data.activityId) {
      const Activity = require('../models/Activity');
      const activity = await Activity.findById(data.activityId);
      if (!activity || activity.isArchived) throw new ApiError(400, 'VALIDATION_ERROR', 'activityId must reference an active activity');
      if (actor.role === 'HOD' && (!activity.departmentId || !actor.departmentIds.some(id => String(id) === String(activity.departmentId)))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your department scope');
      if (actor.role === 'COMMITTEE_HEAD' && (!activity.committeeId || !actor.committeeIds.some(id => String(id) === String(activity.committeeId)))) throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your committee scope');
      if (data.visibility === 'ASSIGNED') {
        data.departmentIds = activity.departmentId ? [String(activity.departmentId)] : [];
        data.committeeIds = activity.committeeId ? [String(activity.committeeId)] : [];
      }
    }
    const year = await AcademicYear.findById(data.academicYearId);
    if (!year || year.isArchived) throw new ApiError(400, 'VALIDATION_ERROR', 'academicYearId must reference a non-archived academic year');
    if (data.startAt < year.startDate || data.endAt > year.endDate) throw new ApiError(400, 'VALIDATION_ERROR', 'Event dates must fall within the academic year');
  }
  const item = await Model.create(data);
  if (Model === Department && item.hodId) await User.updateOne({ _id: item.hodId }, { $addToSet: { departmentIds: item._id } });
  if (Model === Committee) await User.updateMany({ _id: { $in: item.memberIds.concat([item.headId]) } }, { $addToSet: { committeeIds: item._id } });
  return success(res, serializeDocument(item), 201);
}); }
function update(Model, allowedFields) { return asyncHandler(async (req, res) => {
  const item = await Model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'NOT_FOUND', `${Model.modelName} not found`);
  await enforceScope(req.user, item, Model.modelName);
  if (Model === CalendarEvent && item.visibility === 'INSTITUTION' && ['HOD', 'COMMITTEE_HEAD'].includes(req.user.role)) throw new ApiError(403, 'FORBIDDEN', 'Only institution leadership can edit institution-wide events');
  for (const key of Object.keys(req.body)) if (!allowedFields.includes(key)) throw new ApiError(400, 'VALIDATION_ERROR', `Field cannot be updated: ${key}`);
  if (Model === Department && req.body.hodId) {
    const hod = await User.findById(req.body.hodId);
    if (!hod || !hod.isActive || hod.role !== 'HOD') throw new ApiError(400, 'VALIDATION_ERROR', 'hodId must reference an active HOD user');
  }
  if (Model === CalendarEvent) {
    const yearId = req.body.academicYearId || item.academicYearId;
    const year = await AcademicYear.findById(yearId);
    const startAt = req.body.startAt || item.startAt;
    const endAt = req.body.endAt || item.endAt;
    if (!year || year.isArchived || startAt < year.startDate || endAt > year.endDate) throw new ApiError(400, 'VALIDATION_ERROR', 'Event dates must fall within a non-archived academic year');
  }
  if (Model === Committee && req.body.headId) {
    const head = await User.findById(req.body.headId);
    if (!head || !head.isActive || head.role !== 'COMMITTEE_HEAD') throw new ApiError(400, 'VALIDATION_ERROR', 'headId must reference an active COMMITTEE_HEAD');
  }
  const previousHodId = Model === Department ? item.hodId && String(item.hodId) : null;
  const previousCommitteeUsers = Model === Committee ? [...item.memberIds.map(String), String(item.headId)] : [];
  Object.assign(item, req.body);
  if (Model === Committee) item.memberIds = [...new Set([...item.memberIds.map(String), String(item.headId)])];
  await item.save();
  if (Model === Department) {
    if (previousHodId && previousHodId !== String(item.hodId || '')) await User.updateOne({ _id: previousHodId }, { $pull: { departmentIds: item._id } });
    if (item.hodId) await User.updateOne({ _id: item.hodId }, { $addToSet: { departmentIds: item._id } });
  }
  if (Model === Committee) {
    const currentUsers = [...item.memberIds.map(String), String(item.headId)];
    const removed = previousCommitteeUsers.filter(id => !currentUsers.includes(id));
    if (removed.length) await User.updateMany({ _id: { $in: removed } }, { $pull: { committeeIds: item._id } });
    await User.updateMany({ _id: { $in: currentUsers } }, { $addToSet: { committeeIds: item._id } });
  }
  return success(res, serializeDocument(item));
}); }
async function enforceScope(actor, item, type) {
  if (['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(actor.role)) return;
  if (type === 'CalendarEvent') {
    if (item.visibility === 'INSTITUTION') return;
    if (actor.role === 'HOD' && item.departmentIds.some(id => actor.departmentIds.some(own => String(own) === String(id)))) return;
    if (actor.role === 'COMMITTEE_HEAD' && item.committeeIds.some(id => actor.committeeIds.some(own => String(own) === String(id)))) return;
    if (actor.role === 'FACULTY') {
      if (item.departmentIds.some(id => actor.departmentIds.some(own => String(own) === String(id))) || item.committeeIds.some(id => actor.committeeIds.some(own => String(own) === String(id))) || String(item.createdBy) === String(actor._id)) return;
      if (item.activityId) {
        const ActivityAssignment = require('../models/ActivityAssignment');
        const Activity = require('../models/Activity');
        const activity = await Activity.findById(item.activityId).select('ownerId createdBy');
        if (activity && (String(activity.ownerId || '') === String(actor._id) || String(activity.createdBy) === String(actor._id) || await ActivityAssignment.exists({ activityId: item.activityId, assigneeId: actor._id, isActive: true }))) return;
      }
    }
    throw new ApiError(403, 'FORBIDDEN', 'Calendar event is outside your authorized visibility scope');
  }
  if (actor.role === 'HOD') {
    const depId = item.departmentId || item._id;
    if (['Department', 'Committee'].includes(type) && !actor.departmentIds.some(id => String(id) === String(depId))) throw new ApiError(403, 'FORBIDDEN', 'Resource is outside your department scope');
  }
  if (actor.role === 'COMMITTEE_HEAD' && type === 'Committee' && !actor.committeeIds.some(id => String(id) === String(item._id))) throw new ApiError(403, 'FORBIDDEN', 'Committee is outside your scope');
}

const activateAcademicYear = asyncHandler(async (req, res) => {
  const year = await AcademicYear.findById(req.params.id);
  if (!year) throw new ApiError(404, 'NOT_FOUND', 'Academic year not found');
  if (year.isArchived) throw new ApiError(400, 'VALIDATION_ERROR', 'Archived academic years cannot be activated');
  // The unique partial index prevents multiple active years even under concurrent requests.
  await AcademicYear.updateMany({ isActive: true, _id: { $ne: year._id } }, { $set: { isActive: false } });
  year.isActive = true;
  await year.save();
  return success(res, serializeDocument(year));
});
const archiveAcademicYear = asyncHandler(async (req, res) => {
  const year = await AcademicYear.findById(req.params.id);
  if (!year) throw new ApiError(404, 'NOT_FOUND', 'Academic year not found');
  if (year.isActive) throw new ApiError(400, 'VALIDATION_ERROR', 'Deactivate the academic year before archiving it');
  year.isArchived = true;
  await year.save();
  return success(res, serializeDocument(year));
});
const replaceCommitteeMembers = asyncHandler(async (req, res) => {
  const committee = await Committee.findById(req.params.id);
  if (!committee) throw new ApiError(404, 'NOT_FOUND', 'Committee not found');
  const ids = [...new Set([...req.body.memberIds, String(committee.headId)])];
  const count = await User.countDocuments({ _id: { $in: ids }, isActive: true });
  if (count !== ids.length) throw new ApiError(400, 'VALIDATION_ERROR', 'All members must be active users');
  committee.memberIds = ids;
  await committee.save();
  await User.updateMany({ committeeIds: committee._id }, { $pull: { committeeIds: committee._id } });
  await User.updateMany({ _id: { $in: ids } }, { $addToSet: { committeeIds: committee._id } });
  return success(res, serializeDocument(committee));
});
module.exports = { list, getById, create, update, activateAcademicYear, archiveAcademicYear, replaceCommitteeMembers };
