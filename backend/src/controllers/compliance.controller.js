const Criterion = require('../models/ComplianceCriterion');
const Mapping = require('../models/EvidenceMapping');
const Evidence = require('../models/Evidence');
const Activity = require('../models/Activity');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');
const { z } = require('zod');

const criterionSchema = z.object({ framework: z.enum(['NBA', 'NAAC', 'IQAC']), criterionCode: z.string().trim().min(1).max(50), title: z.string().trim().min(2).max(200), description: z.string().max(5000).optional(), academicYearId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(), requiredEvidenceTypes: z.array(z.string().trim().min(1).max(80)).default([]), isActive: z.boolean().optional() }).strict();
const mappingSchema = z.object({ criterionId: z.string().regex(/^[a-f\d]{24}$/i), activityId: z.string().regex(/^[a-f\d]{24}$/i), evidenceId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional() }).strict();

async function assertActivityScope(user, activity) {
  if (['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(user.role)) return;
  if (user.role === 'HOD' && activity.departmentId && user.departmentIds.some(id => String(id) === String(activity.departmentId))) return;
  if (user.role === 'COMMITTEE_HEAD' && activity.committeeId && user.committeeIds.some(id => String(id) === String(activity.committeeId))) return;
  const ActivityAssignment = require('../models/ActivityAssignment');
  if (user.role === 'FACULTY' && (String(activity.ownerId || '') === String(user._id) || String(activity.createdBy) === String(user._id) || await ActivityAssignment.exists({ activityId: activity._id, assigneeId: user._id, isActive: true }))) return;
  throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope');
}

const listCriteria = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.framework) filter.framework = req.query.framework;
  if (req.query.academicYearId) filter.academicYearId = req.query.academicYearId;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  const result = await paginatedList(Criterion, filter, req.query, { sort: { framework: 1, criterionCode: 1 } });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
const createCriterion = asyncHandler(async (req, res) => success(res, serializeDocument(await Criterion.create({ ...req.body, createdBy: req.user._id })), 201));
const getCriterion = asyncHandler(async (req, res) => {
  const item = await Criterion.findById(req.params.id);
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Compliance criterion not found');
  return success(res, serializeDocument(item));
});
const updateCriterion = asyncHandler(async (req, res) => {
  const item = await Criterion.findById(req.params.id);
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Compliance criterion not found');
  for (const key of Object.keys(req.body)) if (!['framework', 'criterionCode', 'title', 'description', 'academicYearId', 'requiredEvidenceTypes', 'isActive'].includes(key)) throw new ApiError(400, 'VALIDATION_ERROR', `Field cannot be updated: ${key}`);
  Object.assign(item, req.body); await item.save(); return success(res, serializeDocument(item));
});
const listMappings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.criterionId) filter.criterionId = req.query.criterionId;
  if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
  if (['HOD', 'COMMITTEE_HEAD', 'FACULTY'].includes(req.user.role)) {
    const activityFilter = req.user.role === 'HOD' ? { departmentId: { $in: req.user.departmentIds } } : req.user.role === 'COMMITTEE_HEAD' ? { committeeId: { $in: req.user.committeeIds } } : { $or: [{ ownerId: req.user._id }, { createdBy: req.user._id }] };
    filter.activityId = { $in: await Activity.find(activityFilter).distinct('_id') };
    if (req.user.role === 'FACULTY') {
      const Assignment = require('../models/ActivityAssignment');
      const assigned = await Assignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
      const owned = await Activity.find(activityFilter).distinct('_id');
      filter.activityId = { $in: [...new Set([...assigned.map(String), ...owned.map(String)])] };
    }
  } else if (req.query.activityId) filter.activityId = req.query.activityId;
  const result = await paginatedList(Mapping, filter, req.query, { populate: [{ path: 'criterionId', select: 'framework criterionCode title' }, { path: 'evidenceId', select: 'originalName documentType reviewStatus' }] });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
const createMapping = asyncHandler(async (req, res) => {
  const criterion = await Criterion.findById(req.body.criterionId);
  const activity = await Activity.findById(req.body.activityId);
  if (!criterion || !criterion.isActive) throw new ApiError(400, 'VALIDATION_ERROR', 'Criterion is invalid or inactive');
  if (!activity) throw new ApiError(400, 'VALIDATION_ERROR', 'Activity does not exist');
  await assertActivityScope(req.user, activity);
  if (req.body.evidenceId) {
    const evidence = await Evidence.findOne({ _id: req.body.evidenceId, activityId: activity._id, isArchived: false });
    if (!evidence) throw new ApiError(400, 'VALIDATION_ERROR', 'Evidence must belong to the selected activity');
  }
  return success(res, serializeDocument(await Mapping.create({ ...req.body, mappedBy: req.user._id })), 201);
});
const updateMapping = asyncHandler(async (req, res) => {
  const item = await Mapping.findById(req.params.id);
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Evidence mapping not found');
  const activity = await Activity.findById(item.activityId);
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Mapped activity not found');
  await assertActivityScope(req.user, activity);
  if (req.body.evidenceId !== undefined) {
    if (req.body.evidenceId && !(await Evidence.exists({ _id: req.body.evidenceId, activityId: item.activityId, isArchived: false }))) throw new ApiError(400, 'VALIDATION_ERROR', 'Evidence must belong to the mapped activity');
    item.evidenceId = req.body.evidenceId;
  }
  await item.save(); return success(res, serializeDocument(item));
});
const reviewMapping = asyncHandler(async (req, res) => {
  const item = await Mapping.findById(req.params.id);
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Evidence mapping not found');
  const activity = await Activity.findById(item.activityId);
  if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Mapped activity not found');
  await assertActivityScope(req.user, activity);
  item.reviewStatus = req.body.reviewStatus; item.reviewedBy = req.user._id; item.reviewComment = req.body.reviewComment || ''; await item.save();
  return success(res, serializeDocument(item));
});
const completeness = asyncHandler(async (req, res) => {
  const criteria = await Criterion.find({ isActive: true, ...(req.query.framework ? { framework: req.query.framework } : {}), ...(req.query.academicYearId ? { academicYearId: req.query.academicYearId } : {}) }).lean();
  let activityIds = null;
  if (req.user.role === 'HOD') activityIds = await Activity.find({ departmentId: { $in: req.user.departmentIds } }).distinct('_id');
  else if (req.user.role === 'COMMITTEE_HEAD') activityIds = await Activity.find({ committeeId: { $in: req.user.committeeIds } }).distinct('_id');
  else if (req.user.role === 'FACULTY') {
    const Assignment = require('../models/ActivityAssignment');
    const assigned = await Assignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
    const owned = await Activity.find({ $or: [{ ownerId: req.user._id }, { createdBy: req.user._id }] }).distinct('_id');
    activityIds = [...new Set([...assigned.map(String), ...owned.map(String)])];
  }
  const rows = await Promise.all(criteria.map(async criterion => {
    const base = { criterionId: criterion._id, ...(activityIds ? { activityId: { $in: activityIds } } : {}) };
    const total = await Mapping.countDocuments(base);
    const accepted = await Mapping.countDocuments({ ...base, reviewStatus: 'ACCEPTED' });
    return { criterionId: String(criterion._id), framework: criterion.framework, criterionCode: criterion.criterionCode, title: criterion.title, totalMappings: total, acceptedMappings: accepted, completenessPercent: total ? Math.round(accepted / total * 100) : 0 };
  }));
  return success(res, rows);
});
module.exports = { criterionSchema, mappingSchema, listCriteria, createCriterion, getCriterion, updateCriterion, listMappings, createMapping, updateMapping, reviewMapping, completeness };
