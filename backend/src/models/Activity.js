const mongoose = require('mongoose');
const { ACTIVITY_STATUS } = require('../constants/workflow');
const activitySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 10000, default: '' },
  activityType: { type: String, required: true, trim: true, maxlength: 80 },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  committeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Committee', default: null, index: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startAt: { type: Date, default: null },
  dueDate: { type: Date, required: true, index: true },
  status: { type: String, enum: ACTIVITY_STATUS, default: 'PLANNED', index: true },
  requiredEvidence: [{ type: String, trim: true, maxlength: 80 }],
  sopReference: { type: String, trim: true, maxlength: 500, default: '' },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  closedAt: { type: Date, default: null },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isArchived: { type: Boolean, default: false, index: true }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; ret.isOverdue = Boolean(ret.dueDate && new Date(ret.dueDate) < new Date() && !['VERIFIED', 'CLOSED'].includes(ret.status)); return ret; } } });
activitySchema.index({ departmentId: 1, academicYearId: 1, status: 1 });
activitySchema.index({ dueDate: 1, status: 1 });
module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
