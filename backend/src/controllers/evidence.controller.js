const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Evidence = require('../models/Evidence');
const Activity = require('../models/Activity');
const ActivityAssignment = require('../models/ActivityAssignment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');
const config = require('../config/env');

async function accessible(req, evidence) {
  const activity = await Activity.findById(evidence.activityId);
  if (!activity) return false;
  if (['DIRECTOR', 'PRINCIPAL'].includes(req.user.role)) return true;
  if (req.user.role === 'HOD') return Boolean(activity.departmentId && req.user.departmentIds.some(id => String(id) === String(activity.departmentId)));
  if (req.user.role === 'COMMITTEE_HEAD') return Boolean(activity.committeeId && req.user.committeeIds.some(id => String(id) === String(activity.committeeId)));
  if (String(evidence.uploadedBy) === String(req.user._id) || String(activity.createdBy) === String(req.user._id) || String(activity.ownerId || '') === String(req.user._id)) return true;
  return Boolean(await ActivityAssignment.exists({ activityId: activity._id, assigneeId: req.user._id, isActive: true }));
}
const list = asyncHandler(async (req, res) => {
  const filter = { isArchived: false };
  if (req.query.activityId) filter.activityId = req.query.activityId;
  if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
  if (['DIRECTOR', 'PRINCIPAL'].includes(req.user.role)) {
    // Institution leaders may inspect all evidence metadata.
  } else if (req.user.role === 'HOD') {
    const ids = await Activity.find({ departmentId: { $in: req.user.departmentIds } }).distinct('_id');
    filter.activityId = req.query.activityId ? (ids.some(id => String(id) === String(req.query.activityId)) ? req.query.activityId : { $in: [] }) : { $in: ids };
  } else if (req.user.role === 'COMMITTEE_HEAD') {
    const ids = await Activity.find({ committeeId: { $in: req.user.committeeIds } }).distinct('_id');
    filter.activityId = req.query.activityId ? (ids.some(id => String(id) === String(req.query.activityId)) ? req.query.activityId : { $in: [] }) : { $in: ids };
  } else {
    const assigned = await ActivityAssignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
    const owned = await Activity.find({ $or: [{ ownerId: req.user._id }, { createdBy: req.user._id }] }).distinct('_id');
    const ids = [...new Set([...assigned.map(String), ...owned.map(String)])];
    filter.activityId = req.query.activityId ? (ids.some(id => String(id) === String(req.query.activityId)) ? req.query.activityId : { $in: [] }) : { $in: ids };
  }
  const result = await paginatedList(Evidence, filter, req.query, { sort: { createdAt: -1 } });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
const uploadEvidence = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'VALIDATION_ERROR', 'A file is required in multipart field "file"');
  const { activityId, documentType } = req.body;
  if (!/^[a-f\d]{24}$/i.test(activityId || '') || !documentType || documentType.trim().length > 80) {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(400, 'VALIDATION_ERROR', 'activityId and documentType are required');
  }
  const activity = await Activity.findById(activityId);
  if (!activity) { fs.unlink(req.file.path, () => {}); throw new ApiError(404, 'NOT_FOUND', 'Activity not found'); }
  const assigned = await ActivityAssignment.exists({ activityId, assigneeId: req.user._id, isActive: true });
  const scoped = ['DIRECTOR', 'PRINCIPAL'].includes(req.user.role) || (req.user.role === 'HOD' && activity.departmentId && req.user.departmentIds.some(id => String(id) === String(activity.departmentId))) || (req.user.role === 'COMMITTEE_HEAD' && activity.committeeId && req.user.committeeIds.some(id => String(id) === String(activity.committeeId))) || assigned || String(activity.ownerId || '') === String(req.user._id) || String(activity.createdBy) === String(req.user._id);
  if (!scoped) { fs.unlink(req.file.path, () => {}); throw new ApiError(403, 'FORBIDDEN', 'Activity is outside your authorized scope'); }
  // MIME is supplied by the client; perform signature checks for common formats before accepting it.
  const buffer = Buffer.alloc(8);
  const fd = fs.openSync(req.file.path, 'r');
  try { fs.readSync(fd, buffer, 0, 8, 0); } finally { fs.closeSync(fd); }
  const signature = buffer.toString('hex');
  const mime = req.file.mimetype;
  const validSignature = (mime === 'application/pdf' && signature.startsWith('25504446')) || (mime === 'image/png' && signature.startsWith('89504e47')) || (mime === 'image/jpeg' && signature.startsWith('ffd8ff')) || (mime.includes('officedocument') && signature.startsWith('504b0304'));
  if (!validSignature) { fs.unlink(req.file.path, () => {}); throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'File signature does not match the claimed file type'); }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(req.file.path)).digest('hex');
  const previous = await Evidence.findOne({ activityId, documentType: documentType.trim(), isLatestVersion: true, isArchived: false }).sort({ version: -1 });
  const evidence = await Evidence.create({ activityId, uploadedBy: req.user._id, originalName: path.basename(req.file.originalname.replace(/\\/g, '/')).slice(0, 255), storageKey: path.basename(req.file.filename), mimeType: mime, sizeBytes: req.file.size, sha256: hash, documentType: documentType.trim(), version: previous ? previous.version + 1 : 1, previousVersionId: previous?._id || null, reviewStatus: 'PENDING' });
  if (previous) { previous.isLatestVersion = false; await previous.save(); }
  return success(res, serializeDocument(evidence), 201);
});
const uploadVersion = asyncHandler(async (req, res, next) => {
  const previous = await Evidence.findById(req.params.id).select('+storageKey');
  if (!previous || previous.isArchived) throw new ApiError(404, 'NOT_FOUND', 'Evidence not found');
  if (!(await accessible(req, previous))) throw new ApiError(403, 'FORBIDDEN', 'Evidence is outside your authorized scope');
  req.body.activityId = String(previous.activityId);
  req.body.documentType = previous.documentType;
  return uploadEvidence(req, res, next);
});

const getById = asyncHandler(async (req, res) => {
  const evidence = await Evidence.findById(req.params.id).select('+storageKey');
  if (!evidence || evidence.isArchived) throw new ApiError(404, 'NOT_FOUND', 'Evidence not found');
  if (!(await accessible(req, evidence))) throw new ApiError(403, 'FORBIDDEN', 'Evidence is outside your authorized scope');
  return success(res, serializeDocument(evidence));
});
const download = asyncHandler(async (req, res, next) => {
  const evidence = await Evidence.findById(req.params.id).select('+storageKey');
  if (!evidence || evidence.isArchived) throw new ApiError(404, 'NOT_FOUND', 'Evidence not found');
  if (!(await accessible(req, evidence))) throw new ApiError(403, 'FORBIDDEN', 'Evidence is outside your authorized scope');
  const filePath = path.join(config.UPLOAD_PATH, path.basename(evidence.storageKey));
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'NOT_FOUND', 'Evidence file is missing from private storage');
  res.setHeader('Content-Type', evidence.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${evidence.originalName.replace(/["\r\n]/g, '_')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(filePath, error => { if (error && !res.headersSent) next(error); });
});
const archive = asyncHandler(async (req, res) => {
  const evidence = await Evidence.findById(req.params.id);
  if (!evidence) throw new ApiError(404, 'NOT_FOUND', 'Evidence not found');
  if (!(await accessible(req, evidence))) throw new ApiError(403, 'FORBIDDEN', 'Evidence is outside your authorized scope');
  if (!['DIRECTOR', 'PRINCIPAL'].includes(req.user.role) && String(evidence.uploadedBy) !== String(req.user._id)) throw new ApiError(403, 'FORBIDDEN', 'Only the uploader or an institution manager may archive evidence');
  evidence.isArchived = true;
  evidence.isLatestVersion = false;
  await evidence.save();
  return success(res, { message: 'Evidence archived' });
});
module.exports = { list, uploadEvidence, uploadVersion, getById, download, archive };
