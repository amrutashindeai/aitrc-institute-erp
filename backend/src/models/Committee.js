const mongoose = require('mongoose');
const committeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{2,30}$/ },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  headId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
module.exports = mongoose.models.Committee || mongoose.model('Committee', committeeSchema);
