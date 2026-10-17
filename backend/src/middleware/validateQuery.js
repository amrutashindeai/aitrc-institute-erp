const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { ACTIVITY_STATUS, EVIDENCE_REVIEW_STATUS } = require('../constants/workflow');

const ALLOWED = new Set(['page', 'limit', 'search', 'isActive', 'role', 'academicYearId', 'departmentId', 'committeeId', 'activityId', 'criterionId', 'reviewStatus', 'status', 'framework', 'unread', 'from', 'to', 'reportType', 'action', 'resourceType', 'actorId', 'framework']);
const OBJECT_ID_KEYS = new Set(['academicYearId', 'departmentId', 'committeeId', 'activityId', 'criterionId', 'actorId']);
function validateQueryParams(req, _res, next) {
  const issues = [];
  for (const key of Object.keys(req.query)) {
    if (!ALLOWED.has(key)) issues.push({ field: key, message: 'Unsupported query parameter' });
  }
  for (const key of ['page', 'limit']) {
    if (req.query[key] !== undefined && (!/^\d+$/.test(String(req.query[key])) || Number(req.query[key]) < 1 || (key === 'limit' && Number(req.query[key]) > 100))) issues.push({ field: key, message: key === 'limit' ? 'Must be an integer between 1 and 100' : 'Must be a positive integer' });
  }
  if (req.query.search !== undefined && (typeof req.query.search !== 'string' || req.query.search.trim().length > 100)) issues.push({ field: 'search', message: 'Must be a string of at most 100 characters' });
  if (req.query.isActive !== undefined && !['true', 'false'].includes(req.query.isActive)) issues.push({ field: 'isActive', message: 'Must be true or false' });
  if (req.query.unread !== undefined && !['true', 'false'].includes(req.query.unread)) issues.push({ field: 'unread', message: 'Must be true or false' });
  if (req.query.role !== undefined && !ROLES.includes(req.query.role)) issues.push({ field: 'role', message: 'Invalid role' });
  if (req.query.status !== undefined && !ACTIVITY_STATUS.includes(req.query.status)) issues.push({ field: 'status', message: 'Invalid activity status' });
  if (req.query.reviewStatus !== undefined && !EVIDENCE_REVIEW_STATUS.includes(req.query.reviewStatus)) issues.push({ field: 'reviewStatus', message: 'Invalid review status' });
  if (req.query.framework !== undefined && !['NBA', 'NAAC', 'IQAC'].includes(req.query.framework)) issues.push({ field: 'framework', message: 'Invalid compliance framework' });
  if (req.query.reportType !== undefined && !['activities', 'overdue', 'evidence-completeness'].includes(req.query.reportType)) issues.push({ field: 'reportType', message: 'Invalid report type' });
  for (const key of OBJECT_ID_KEYS) if (req.query[key] !== undefined && !/^[a-f\d]{24}$/i.test(req.query[key])) issues.push({ field: key, message: 'Must be a valid MongoDB ObjectId' });
  for (const key of ['from', 'to']) if (req.query[key] !== undefined && (Number.isNaN(Date.parse(req.query[key])) || typeof req.query[key] !== 'string')) issues.push({ field: key, message: 'Must be a valid date string' });
  if (req.query.from && req.query.to && new Date(req.query.from) > new Date(req.query.to)) issues.push({ field: 'to', message: 'Must be on or after from' });
  if (issues.length) return next(new ApiError(400, 'VALIDATION_ERROR', 'Invalid query parameters', issues));
  return next();
}
module.exports = validateQueryParams;
