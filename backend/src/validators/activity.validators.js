const { z } = require('zod');
const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid MongoDB ObjectId');
const activityCreate = z.object({
  title: z.string().trim().min(3).max(200), description: z.string().max(10000).optional(), activityType: z.string().trim().min(2).max(80),
  departmentId: oid.nullable().optional(), committeeId: oid.nullable().optional(), academicYearId: oid, ownerId: oid.nullable().optional(),
  startAt: z.coerce.date().nullable().optional(), dueDate: z.coerce.date(), requiredEvidence: z.array(z.string().trim().min(1).max(80)).default([]), sopReference: z.string().max(500).optional()
}).strict();
const activityPatch = z.object({ title: z.string().trim().min(3).max(200).optional(), description: z.string().max(10000).optional(), activityType: z.string().trim().min(2).max(80).optional(), departmentId: oid.nullable().optional(), committeeId: oid.nullable().optional(), academicYearId: oid.optional(), ownerId: oid.nullable().optional(), startAt: z.coerce.date().nullable().optional(), dueDate: z.coerce.date().optional(), requiredEvidence: z.array(z.string().trim().min(1).max(80)).optional(), sopReference: z.string().max(500).optional() }).strict();
const assignmentCreate = z.object({ assigneeId: oid, responsibility: z.string().trim().min(2).max(1000), dueDate: z.coerce.date().nullable().optional() }).strict();
const assignmentPatch = z.object({ responsibility: z.string().trim().min(2).max(1000).optional(), dueDate: z.coerce.date().nullable().optional(), isActive: z.boolean().optional() }).strict();
const workflowComment = z.object({ comment: z.string().trim().max(3000).optional() }).strict();
const returnComment = z.object({ comment: z.string().trim().min(5).max(3000) }).strict();
module.exports = { activityCreate, activityPatch, assignmentCreate, assignmentPatch, workflowComment, returnComment };
