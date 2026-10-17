const mongoose = require('mongoose');
const calendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true, index: true },
  departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  committeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Committee' }],
  visibility: { type: String, enum: ['INSTITUTION', 'DEPARTMENT', 'COMMITTEE', 'ASSIGNED'], default: 'INSTITUTION', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', default: null },
  isArchived: { type: Boolean, default: false, index: true }
}, { timestamps: true, toJSON: { virtuals: true, transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });
calendarEventSchema.pre('validate', function validateDates(next) { if (this.startAt && this.endAt && this.endAt < this.startAt) this.invalidate('endAt', 'endAt cannot be before startAt'); next(); });
module.exports = mongoose.models.CalendarEvent || mongoose.model('CalendarEvent', calendarEventSchema);
