const mongoose = require('mongoose');
const { EVIDENCE_REVIEW_STATUS } = require('../constants/workflow');
const evidenceSchema = new mongoose.Schema({
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalName: { type: String, required: true, trim: true, maxlength: 255 },
  storageKey: { type: String, required: true, unique: true, select: false },
  mimeType: { type: String, required: true, maxlength: 150 },
  sizeBytes: { type: Number, required: true, min: 1, max: 104857600 },
  sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  documentType: { type: String, required: true, trim: true, maxlength: 80 },
  version: { type: Number, required: true, min: 1, default: 1 },
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence', default: null },
  isLatestVersion: { type: Boolean, default: true, index: true },
  reviewStatus: { type: String, enum: EVIDENCE_REVIEW_STATUS, default: 'PENDING', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  isArchived: { type: Boolean, default: false, index: true }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; delete ret.storageKey; return ret; } } });
evidenceSchema.index({ activityId: 1, isLatestVersion: 1 });
module.exports = mongoose.models.Evidence || mongoose.model('Evidence', evidenceSchema);
