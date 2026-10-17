
const { z } = require('zod');
const { ROLES } = require('../constants/roles');
const { objectId } = require('./common.validators');

// User validation
const userCreate = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
  role: z.enum(ROLES),
  departmentIds: z.array(objectId).default([]),
  committeeIds: z.array(objectId).default([]),
  isActive: z.boolean().optional()
}).strict();

const userPatch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase())
    .optional(),
  departmentIds: z.array(objectId).optional(),
  committeeIds: z.array(objectId).optional()
}).strict();

// Department validation
const departmentCreate = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{2,20}$/)
    .transform((v) => v.toUpperCase()),
  description: z.string().max(2000).optional(),
  hodId: objectId.nullable().optional()
}).strict();

const departmentPatch = departmentCreate
  .partial()
  .extend({
    isActive: z.boolean().optional()
  });

// Committee validation
const committeeCreate = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{2,30}$/)
    .transform((v) => v.toUpperCase()),
  description: z.string().max(2000).optional(),
  departmentId: objectId.nullable().optional(),
  headId: objectId,
  memberIds: z.array(objectId).default([])
}).strict();

const committeePatch = committeeCreate
  .partial()
  .extend({
    isActive: z.boolean().optional()
  });

// Academic year validation
const academicYearCreate = z.object({
  name: z.string().regex(/^\d{4}-\d{4}$/),
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
})
  .strict()
  .refine(
    (v) => v.endDate > v.startDate,
    {
      path: ['endDate'],
      message: 'Must be after startDate'
    }
  );

const academicYearPatch = z.object({
  name: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
}).strict();

// Event validation fields
const eventFields = {
  title: z.string().trim().min(2).max(180),
  description: z.string().max(5000).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  academicYearId: objectId,
  departmentIds: z.array(objectId).default([]),
  committeeIds: z.array(objectId).default([]),
  visibility: z.enum([
    'INSTITUTION',
    'DEPARTMENT',
    'COMMITTEE',
    'ASSIGNED'
  ]).default('INSTITUTION'),
  activityId: objectId.nullable().optional()
};

// Event creation validation
const eventCreate = z.object(eventFields)
  .strict()
  .refine(
    (v) => v.endAt >= v.startAt,
    {
      path: ['endAt'],
      message: 'Cannot be before startAt'
    }
  );

// Event partial update validation
const eventPatch = z.object({
  title: eventFields.title.optional(),
  description: eventFields.description,
  startAt: eventFields.startAt.optional(),
  endAt: eventFields.endAt.optional(),
  academicYearId: eventFields.academicYearId.optional(),
  departmentIds: z.array(objectId).optional(),
  committeeIds: z.array(objectId).optional(),
  visibility: z.enum([
    'INSTITUTION',
    'DEPARTMENT',
    'COMMITTEE',
    'ASSIGNED'
  ]).optional(),
  activityId: eventFields.activityId
})
  .strict()
  .refine(
    (v) =>
      !v.startAt ||
      !v.endAt ||
      v.endAt >= v.startAt,
    {
      path: ['endAt'],
      message: 'Cannot be before startAt'
    }
  );

// Export validators
module.exports = {
  userCreate,
  userPatch,
  departmentCreate,
  departmentPatch,
  committeeCreate,
  committeePatch,
  academicYearCreate,
  academicYearPatch,
  eventCreate,
  eventPatch
};