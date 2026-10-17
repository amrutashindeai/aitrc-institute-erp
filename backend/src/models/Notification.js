const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['ASSIGNMENT', 'RETURN', 'SUBMISSION', 'VERIFICATION', 'REMINDER', 'OVERDUE', 'SYSTEM'] },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  resourceType: { type: String, enum: ['ACTIVITY', 'EVIDENCE', 'CALENDAR_EVENT', 'USER', 'SYSTEM'], default: 'SYSTEM' },
  resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readAt: { type: Date, default: null, index: true },
  deliveryStatus: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'SENT' }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
