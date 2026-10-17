const mongoose = require('mongoose');
const academicYearSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, match: /^\d{4}-\d{4}$/ },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false, index: true },
  isArchived: { type: Boolean, default: false, index: true }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
academicYearSchema.pre('validate', function validateDates(next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) this.invalidate('endDate', 'endDate must be after startDate');
  next();
});
academicYearSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
module.exports = mongoose.models.AcademicYear || mongoose.model('AcademicYear', academicYearSchema);
