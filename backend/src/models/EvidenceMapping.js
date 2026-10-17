const mongoose = require('mongoose');
const { EVIDENCE_REVIEW_STATUS } = require('../constants/workflow');
const mappingSchema = new mongoose.Schema({
  criterionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceCriterion', required: true, index: true },
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence', default: null, index: true },
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  mappedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewStatus: { type: String, enum: EVIDENCE_REVIEW_STATUS, default: 'PENDING', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewComment: { type: String, trim: true, maxlength: 3000, default: '' }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
module.exports = mongoose.models.EvidenceMapping || mongoose.model('EvidenceMapping', mappingSchema);
