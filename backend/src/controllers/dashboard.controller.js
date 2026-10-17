const Activity = require('../models/Activity');
const User = require('../models/User');
const Department = require('../models/Department');
const Committee = require('../models/Committee');
const AcademicYear = require('../models/AcademicYear');
const Evidence = require('../models/Evidence');
const Notification = require('../models/Notification');
const ActivityAssignment = require('../models/ActivityAssignment');
const CalendarEvent = require('../models/CalendarEvent');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/serialize');

function activityScope(user) {
  if (user.role === 'HOD') return { departmentId: { $in: user.departmentIds } };
  if (user.role === 'COMMITTEE_HEAD') return { committeeId: { $in: user.committeeIds } };
  if (user.role === 'FACULTY') return { $or: [{ ownerId: user._id }, { createdBy: user._id }] };
  return {};
}
const me = asyncHandler(async (req, res) => {
  const filter = { isArchived: false, ...activityScope(req.user) };
  if (req.user.role === 'FACULTY') {
    const assignments = await ActivityAssignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
    filter.$or = [...(filter.$or || []), { _id: { $in: assignments } }];
  }
  const now = new Date();
  const activityIds = await Activity.find(filter).distinct('_id');
  const eventFilter = { isArchived: false, endAt: { $gte: now } };
  if (req.user.role === 'HOD') eventFilter.$or = [{ visibility: 'INSTITUTION' }, { departmentIds: { $in: req.user.departmentIds } }];
  else if (req.user.role === 'COMMITTEE_HEAD') eventFilter.$or = [{ visibility: 'INSTITUTION' }, { committeeIds: { $in: req.user.committeeIds } }];
  else if (req.user.role === 'FACULTY') {
    const assignedActivityIds = await ActivityAssignment.find({ assigneeId: req.user._id, isActive: true }).distinct('activityId');
    eventFilter.$or = [{ visibility: 'INSTITUTION' }, { departmentIds: { $in: req.user.departmentIds } }, { committeeIds: { $in: req.user.committeeIds } }, { createdBy: req.user._id }, { activityId: { $in: assignedActivityIds } }];
  }
  const upcomingEvents = (await CalendarEvent.find(eventFilter).sort({ startAt: 1 }).limit(5).lean()).map(event => ({ id: String(event._id), title: event.title, description: event.description, startAt: event.startAt, endAt: event.endAt, visibility: event.visibility }));
  const evidenceFilter = ['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(req.user.role) ? { reviewStatus: 'PENDING', isArchived: false } : { reviewStatus: 'PENDING', isArchived: false, activityId: { $in: activityIds } };
  const [total, planned, inProgress, submitted, returned, verified, closed, overdue, unreadNotifications, pendingEvidence] = await Promise.all([
    Activity.countDocuments(filter), Activity.countDocuments({ ...filter, status: 'PLANNED' }), Activity.countDocuments({ ...filter, status: 'IN_PROGRESS' }),
    Activity.countDocuments({ ...filter, status: 'SUBMITTED' }), Activity.countDocuments({ ...filter, status: 'RETURNED' }),
    Activity.countDocuments({ ...filter, status: 'VERIFIED' }), Activity.countDocuments({ ...filter, status: 'CLOSED' }),
    Activity.countDocuments({ ...filter, dueDate: { $lt: now }, status: { $nin: ['VERIFIED', 'CLOSED'] } }),
    Notification.countDocuments({ recipientId: req.user._id, readAt: null }), Evidence.countDocuments(evidenceFilter)
  ]);
  return success(res, { role: req.user.role, counts: { total, planned, inProgress, submitted, returned, verified, closed, overdue, unreadNotifications, pendingEvidence }, upcomingEvents });
});
const institution = asyncHandler(async (req, res) => {
  if (!['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(req.user.role)) throw new ApiError(403, 'FORBIDDEN', 'Institution dashboard is restricted to institution leadership');
  const now = new Date();
  const [users, departments, committees, activeAcademicYear, totalActivities, overdueActivities, pendingEvidence] = await Promise.all([
    User.countDocuments({ isActive: true }), Department.countDocuments({ isActive: true }), Committee.countDocuments({ isActive: true }),
    AcademicYear.findOne({ isActive: true }).lean(), Activity.countDocuments({ isArchived: false }),
    Activity.countDocuments({ dueDate: { $lt: now }, status: { $nin: ['VERIFIED', 'CLOSED'] }, isArchived: false }),
    Evidence.countDocuments({ reviewStatus: 'PENDING', isArchived: false })
  ]);
  return success(res, { users, departments, committees, activeAcademicYear: activeAcademicYear ? { id: String(activeAcademicYear._id), name: activeAcademicYear.name } : null, totalActivities, overdueActivities, pendingEvidence });
});
const departmentDashboard = asyncHandler(async (req, res) => {
  const departmentId = req.params.id;
  if (req.user.role === 'HOD' && !req.user.departmentIds.some(id => String(id) === departmentId)) throw new ApiError(403, 'FORBIDDEN', 'Department is outside your scope');
  if (!['DIRECTOR', 'PRINCIPAL', 'ADMIN', 'HOD'].includes(req.user.role)) throw new ApiError(403, 'FORBIDDEN', 'Department dashboard is not available for your role');
  const department = await Department.findById(departmentId);
  if (!department) throw new ApiError(404, 'NOT_FOUND', 'Department not found');
  const now = new Date();
  const [total, overdue, submitted, verified] = await Promise.all([
    Activity.countDocuments({ departmentId, isArchived: false }), Activity.countDocuments({ departmentId, isArchived: false, dueDate: { $lt: now }, status: { $nin: ['VERIFIED', 'CLOSED'] } }),
    Activity.countDocuments({ departmentId, isArchived: false, status: 'SUBMITTED' }), Activity.countDocuments({ departmentId, isArchived: false, status: 'VERIFIED' })
  ]);
  return success(res, { department: { id: String(department._id), name: department.name, code: department.code }, counts: { total, overdue, submitted, verified } });
});
module.exports = { me, institution, departmentDashboard };
