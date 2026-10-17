const Activity = require('../models/Activity');
const Evidence = require('../models/Evidence');
const ActivityAssignment = require('../models/ActivityAssignment');
const Mapping = require('../models/EvidenceMapping');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');

function scope(req) {
  if (['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(req.user.role)) return {};
  if (req.user.role === 'HOD') return { departmentId: { $in: req.user.departmentIds } };
  if (req.user.role === 'COMMITTEE_HEAD') return { committeeId: { $in: req.user.committeeIds } };
  return { $or: [{ ownerId: req.user._id }, { createdBy: req.user._id }] };
}
async function filtered(req) {
  const filter = { isArchived: false, ...scope(req) };
  if (req.user.role === 'FACULTY') {
    const assignedIds = await ActivityAssignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
    filter.$or = [...(filter.$or || []), { _id: { $in: assignedIds } }];
  }
  if (req.query.academicYearId) filter.academicYearId = req.query.academicYearId;
  if (req.query.departmentId && ['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(req.user.role)) filter.departmentId = req.query.departmentId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) filter.dueDate = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to) } : {}) };
  return filter;
}
const activities = asyncHandler(async (req, res) => {
  const result = await paginatedList(Activity, await filtered(req), req.query, { sort: { dueDate: 1 } });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
const departments = asyncHandler(async (req, res) => {
  const rows = await Activity.find(await filtered(req)).select('departmentId dueDate status').lean();
  const byDepartment = new Map();
  const now = new Date();
  for (const row of rows) {
    const id = row.departmentId ? String(row.departmentId) : null;
    const item = byDepartment.get(id) || { departmentId: id, total: 0, overdue: 0 };
    item.total += 1;
    if (row.dueDate < now && !['VERIFIED', 'CLOSED'].includes(row.status)) item.overdue += 1;
    byDepartment.set(id, item);
  }
  return success(res, [...byDepartment.values()].sort((a, b) => b.total - a.total));
});
const responsibilities = asyncHandler(async (req, res) => {
  const activities = await Activity.find(await filtered(req)).select('_id title status dueDate').lean();
  const ids = activities.map(a => a._id);
  const assignments = await ActivityAssignment.find({ activityId: { $in: ids }, isActive: true }).populate('assigneeId', 'name email role').lean();
  return success(res, assignments.map(a => ({ activityId: String(a.activityId), activity: activities.find(item => String(item._id) === String(a.activityId))?.title, assignee: a.assigneeId ? { id: String(a.assigneeId._id), name: a.assigneeId.name, email: a.assigneeId.email, role: a.assigneeId.role } : null, responsibility: a.responsibility, dueDate: a.dueDate })));
});
const overdue = asyncHandler(async (req, res) => {
  const filter = { ...(await filtered(req)), dueDate: { $lt: new Date() }, status: { $nin: ['VERIFIED', 'CLOSED'] }, isArchived: false };
  const result = await paginatedList(Activity, filter, req.query, { sort: { dueDate: 1 } });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
const evidenceCompleteness = asyncHandler(async (req, res) => {
  const activities = await Activity.find(await filtered(req)).select('_id title requiredEvidence').lean();
  const rows = [];
  for (const activity of activities) {
    const requirements = activity.requiredEvidence || [];
    const present = await Evidence.distinct('documentType', { activityId: activity._id, isLatestVersion: true, isArchived: false });
    const missing = requirements.filter(type => !present.includes(type));
    rows.push({ activityId: String(activity._id), title: activity.title, requiredCount: requirements.length, presentCount: requirements.length - missing.length, missing, completenessPercent: requirements.length ? Math.round((requirements.length - missing.length) / requirements.length * 100) : 100 });
  }
  return success(res, rows);
});
const compliance = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
  let activityFilter = { isArchived: false, ...scope(req), ...(req.query.status ? { status: req.query.status } : {}) };
  if (req.user.role === 'FACULTY') activityFilter = await filtered(req);
  const accessibleActivities = await Activity.find(activityFilter).distinct('_id');
  filter.activityId = { $in: accessibleActivities };
  const rows = await Mapping.find(filter).populate('criterionId', 'framework criterionCode title').populate('activityId', 'title departmentId status').lean();
  return success(res, rows.map(row => ({ id: String(row._id), reviewStatus: row.reviewStatus, criterion: row.criterionId, activity: row.activityId })));
});
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
const exportCsv = asyncHandler(async (req, res) => {
  const type = req.query.reportType || 'activities';
  if (!['activities', 'overdue', 'evidence-completeness'].includes(type)) throw new ApiError(400, 'VALIDATION_ERROR', 'Unsupported reportType');
  let rows;
  let headers;
  if (type === 'evidence-completeness') {
    const activities = await Activity.find(await filtered(req)).sort({ dueDate: 1 }).limit(10000).select('_id title requiredEvidence').lean();
    rows = [];
    for (const activity of activities) {
      const requirements = activity.requiredEvidence || [];
      const present = await Evidence.distinct('documentType', { activityId: activity._id, isLatestVersion: true, isArchived: false });
      const missing = requirements.filter(value => !present.includes(value));
      rows.push({ id: activity._id, title: activity.title, requiredCount: requirements.length, presentCount: requirements.length - missing.length, missing: missing.join('; '), completenessPercent: requirements.length ? Math.round((requirements.length - missing.length) / requirements.length * 100) : 100 });
    }
    headers = ['id', 'title', 'requiredCount', 'presentCount', 'missing', 'completenessPercent'];
  } else {
    const filter = type === 'overdue' ? { ...(await filtered(req)), dueDate: { $lt: new Date() }, status: { $nin: ['VERIFIED', 'CLOSED'] } } : await filtered(req);
    rows = await Activity.find(filter).sort({ dueDate: 1 }).limit(10000).select('_id title activityType status dueDate departmentId academicYearId').lean();
    headers = ['id', 'title', 'activityType', 'status', 'dueDate', 'departmentId', 'academicYearId'];
  }
  const csv = [headers.map(csvCell).join(','), ...rows.map(row => headers.map(key => csvCell(key === 'id' ? row._id : row[key])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="institute-erp-${type}.csv"`);
  return res.status(200).send(csv);
});
module.exports = { activities, departments, responsibilities, overdue, evidenceCompleteness, compliance, exportCsv };
