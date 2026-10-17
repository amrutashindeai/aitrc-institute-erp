const mongoose = require('mongoose');
const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{2,20}$/ },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  hodId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);
