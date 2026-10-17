const mongoose = require('mongoose');
const assignmentSchema = new mongoose.Schema({
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  responsibility: { type: String, required: true, trim: true, minlength: 2, maxlength: 1000 },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAt: { type: Date, default: Date.now },
  dueDate: { type: Date, default: null },
  isActive: { type: Boolean, default: true, index: true },
  endedAt: { type: Date, default: null }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
assignmentSchema.index({ activityId: 1, assigneeId: 1, isActive: 1 });
module.exports = mongoose.models.ActivityAssignment || mongoose.model('ActivityAssignment', assignmentSchema);
