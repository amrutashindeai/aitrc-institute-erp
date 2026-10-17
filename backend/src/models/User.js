const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ROLES, index: true },
  departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  committeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Committee' }],
  isActive: { type: Boolean, default: true, index: true },
  lastLoginAt: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: null }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; delete ret.passwordHash; return ret; } } });
userSchema.index({ name: 1 });
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
