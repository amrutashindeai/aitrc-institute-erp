const express = require('express');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Users = require('../controllers/users.controller');
const Resources = require('../controllers/resources.controller');
const User = require('../models/User');
const Department = require('../models/Department');
const Committee = require('../models/Committee');
const AcademicYear = require('../models/AcademicYear');
const CalendarEvent = require('../models/CalendarEvent');
const V = require('../validators/resource.validators');
const { z } = require('zod');
const { ROLES } = require('../constants/roles');

const router = express.Router();
router.use(authenticate);
const leadership = authorize('DIRECTOR', 'PRINCIPAL', 'ADMIN');
const departmentManagers = authorize('DIRECTOR', 'PRINCIPAL', 'ADMIN', 'HOD');
const calendarManagers = authorize('DIRECTOR', 'PRINCIPAL', 'ADMIN', 'HOD', 'COMMITTEE_HEAD');

router.get('/users', authorize(...ROLES.filter(r => r !== 'FACULTY')), Users.list);
router.post('/users', authorize('ADMIN'), validate(V.userCreate), Users.create);
router.get('/users/:id', authorize(...ROLES.filter(r => r !== 'FACULTY')), Users.getById);
router.patch('/users/:id', authorize('ADMIN'), validate(V.userPatch), Users.update);
router.patch('/users/:id/status', authorize('ADMIN'), validate(z.object({ isActive: z.boolean() }).strict()), Users.setStatus);
router.patch('/users/:id/role', authorize('ADMIN'), validate(z.object({ role: z.enum(ROLES) }).strict()), Users.changeRole);

router.get('/departments', Resources.list(Department));
router.post('/departments', leadership, validate(V.departmentCreate), Resources.create(Department));
router.get('/departments/:id', Resources.getById(Department));
router.patch('/departments/:id', leadership, validate(V.departmentPatch), Resources.update(Department, ['name', 'code', 'description', 'hodId', 'isActive']));

router.get('/committees', Resources.list(Committee));
router.post('/committees', leadership, validate(V.committeeCreate), Resources.create(Committee));
router.get('/committees/:id', Resources.getById(Committee));
router.patch('/committees/:id', leadership, validate(V.committeePatch), Resources.update(Committee, ['name', 'code', 'description', 'departmentId', 'headId', 'memberIds', 'isActive']));
router.put('/committees/:id/members', leadership, validate(z.object({ memberIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)) }).strict()), Resources.replaceCommitteeMembers);

router.get('/academic-years', Resources.list(AcademicYear));
router.post('/academic-years', leadership, validate(V.academicYearCreate), Resources.create(AcademicYear));
router.get('/academic-years/:id', Resources.getById(AcademicYear));
router.patch('/academic-years/:id', leadership, validate(V.academicYearPatch), Resources.update(AcademicYear, ['name', 'startDate', 'endDate']));
router.post('/academic-years/:id/activate', leadership, Resources.activateAcademicYear);
router.post('/academic-years/:id/archive', leadership, Resources.archiveAcademicYear);

router.get('/calendar/events', Resources.list(CalendarEvent));
router.post('/calendar/events', calendarManagers, validate(V.eventCreate), Resources.create(CalendarEvent, req => ({ createdBy: req.user._id })));
router.get('/calendar/events/:id', Resources.getById(CalendarEvent));
router.patch('/calendar/events/:id', calendarManagers, validate(V.eventPatch), Resources.update(CalendarEvent, ['title', 'description', 'startAt', 'endAt', 'academicYearId', 'departmentIds', 'committeeIds', 'visibility', 'activityId', 'isArchived']));
router.delete('/calendar/events/:id', leadership, (req, res, next) => {
  CalendarEvent.findByIdAndUpdate(req.params.id, { $set: { isArchived: true } }, { new: true, runValidators: true }).then(item => { if (!item) return next(new (require('../utils/ApiError'))(404, 'NOT_FOUND', 'Calendar event not found')); return res.json({ success: true, data: require('../utils/serialize').serializeDocument(item) }); }).catch(next);
});
module.exports = router;
