const mongoose = require('mongoose');
const { ACTIVITY_STATUS } = require('../constants/workflow');
const historySchema = new mongoose.Schema({
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromStatus: { type: String, enum: ACTIVITY_STATUS.concat([null]), default: null },
  toStatus: { type: String, enum: ACTIVITY_STATUS, required: true },
  comment: { type: String, trim: true, maxlength: 3000, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
historySchema.pre('save', function preventMutation(next) { if (!this.isNew) return next(new Error('Workflow history is append-only')); next(); });
module.exports = mongoose.models.WorkflowHistory || mongoose.model('WorkflowHistory', historySchema);
