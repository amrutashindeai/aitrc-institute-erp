const mongoose = require('mongoose');
const criterionSchema = new mongoose.Schema({
  framework: { type: String, required: true, enum: ['NBA', 'NAAC', 'IQAC'], index: true },
  criterionCode: { type: String, required: true, trim: true, maxlength: 50 },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', default: null },
  requiredEvidenceTypes: [{ type: String, trim: true, maxlength: 80 }],
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
criterionSchema.index({ framework: 1, criterionCode: 1, academicYearId: 1 }, { unique: true });
module.exports = mongoose.models.ComplianceCriterion || mongoose.model('ComplianceCriterion', criterionSchema);
