const mongoose = require('mongoose');
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, trim: true, maxlength: 100, index: true },
  resourceType: { type: String, required: true, trim: true, maxlength: 100 },
  resourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  requestId: { type: String, trim: true, maxlength: 100, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
auditLogSchema.pre('save', function preventMutation(next) { if (!this.isNew) return next(new Error('Audit logs are append-only')); next(); });
module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
