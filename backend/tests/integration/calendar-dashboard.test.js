process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const User = require('../../src/models/User');
const AcademicYear = require('../../src/models/AcademicYear');
const CalendarEvent = require('../../src/models/CalendarEvent');

let mongo;
let token;
let academicYear;
let activityDueDate;
let eventStartAt;
let eventEndAt;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('institute_erp'));
  const user = await User.create({
    name: 'Test Director',
    email: 'director@example.edu',
    passwordHash: await bcrypt.hash('Correct-Horse-Battery-2026!', 10),
    role: 'DIRECTOR',
    isActive: true
  });
  const year = new Date().getUTCFullYear();
  academicYear = await AcademicYear.create({
    name: `${year}-${year + 1}`,
    startDate: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    endDate: new Date(Date.UTC(year + 1, 11, 31, 23, 59, 59, 999)),
    isActive: true,
    isArchived: false
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Correct-Horse-Battery-2026!' });
  expect(login.status).toBe(200);
  token = login.body.data.accessToken;
  activityDueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  eventStartAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  eventEndAt = new Date(eventStartAt.getTime() + 60 * 60 * 1000);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('calendar event dashboard integration', () => {
  test('department create and status patch match the resource validators', async () => {
    const created = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Computer Science', code: 'CSE', description: 'Test department' });
    expect(created.status).toBe(201);

    const patched = await request(app)
      .patch(`/api/v1/departments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(patched.status).toBe(200);
    expect(patched.body.data.isActive).toBe(false);
  });

  test('a newly created upcoming event is returned in dashboard data', async () => {
    const activity = await request(app)
      .post('/api/v1/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Dashboard integration activity',
        description: 'Verifies database-backed dashboard counts',
        activityType: 'Academic',
        departmentId: null,
        committeeId: null,
        academicYearId: String(academicYear._id),
        ownerId: null,
        startAt: null,
        dueDate: activityDueDate,
        requiredEvidence: []
      });
    expect(activity.status).toBe(201);

    const event = {
      title: 'Annual Quality Review',
      description: 'Integration test event',
      startAt: eventStartAt.toISOString(),
      endAt: eventEndAt.toISOString(),
      academicYearId: String(academicYear._id),
      departmentIds: [],
      committeeIds: [],
      visibility: 'INSTITUTION'
    };

    const created = await request(app)
      .post('/api/v1/calendar/events')
      .set('Authorization', `Bearer ${token}`)
      .send(event);

    expect(created.status).toBe(201);
    expect(created.body.data.title).toBe(event.title);

    const dashboard = await request(app)
      .get('/api/v1/dashboards/me')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.counts.total).toBe(1);
    expect(dashboard.body.data.upcomingEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: event.title })])
    );

    const calendar = await request(app)
      .get('/api/v1/calendar/events?limit=100')
      .set('Authorization', `Bearer ${token}`);
    expect(calendar.status).toBe(200);
    expect(calendar.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: event.title })])
    );
  });
});
