const Activity = require('../models/Activity');
const ActivityAssignment = require('../models/ActivityAssignment');
const WorkflowHistory = require('../models/WorkflowHistory');
const Evidence = require('../models/Evidence');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { WORKFLOW_TRANSITIONS } = require('../constants/workflow');

async function transitionActivity({ activity, actor, toStatus, comment = '' }) {
  const fromStatus = activity.status;
  if (!WORKFLOW_TRANSITIONS[fromStatus]?.includes(toStatus)) throw new ApiError(409, 'INVALID_TRANSITION', `Cannot transition activity from ${fromStatus} to ${toStatus}`);
  if (toStatus === 'ASSIGNED' && !(await ActivityAssignment.exists({ activityId: activity._id, isActive: true }))) throw new ApiError(400, 'VALIDATION_ERROR', 'Assign at least one responsible user before assigning the activity');
  if (toStatus === 'SUBMITTED') {
    const missing = [];
    for (const requiredType of activity.requiredEvidence || []) {
      const found = await Evidence.exists({ activityId: activity._id, documentType: requiredType, isLatestVersion: true, isArchived: false });
      if (!found) missing.push(requiredType);
    }
    if (missing.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Required evidence is missing', missing.map(field => ({ field: 'requiredEvidence', message: `Missing evidence type: ${field}` })));
  }
  if (toStatus === 'RETURNED' && comment.trim().length < 5) throw new ApiError(400, 'VALIDATION_ERROR', 'A meaningful comment is required when returning an activity');
  if (toStatus === 'VERIFIED') {
    const selfAssigned = await ActivityAssignment.exists({ activityId: activity._id, assigneeId: actor._id, isActive: true });
    if (String(activity.createdBy) === String(actor._id) || selfAssigned) throw new ApiError(403, 'FORBIDDEN', 'A creator or assignee cannot verify their own activity');
  }
  activity.status = toStatus;
  if (toStatus === 'VERIFIED') { activity.verifiedAt = new Date(); activity.verifiedBy = actor._id; }
  if (toStatus === 'CLOSED') { activity.closedAt = new Date(); activity.closedBy = actor._id; }
  await activity.save();
  await WorkflowHistory.create({ activityId: activity._id, actorId: actor._id, fromStatus, toStatus, comment });
  const assignments = await ActivityAssignment.find({ activityId: activity._id, isActive: true }).select('assigneeId');
  const recipients = new Set(assignments.map(item => String(item.assigneeId)));
  if (String(activity.createdBy) !== String(actor._id)) recipients.add(String(activity.createdBy));
  const typeMap = { ASSIGNED: 'ASSIGNMENT', SUBMITTED: 'SUBMISSION', RETURNED: 'RETURN', VERIFIED: 'VERIFICATION', IN_PROGRESS: 'SYSTEM', CLOSED: 'VERIFICATION' };
  for (const recipientId of recipients) {
    await Notification.create({ recipientId, type: typeMap[toStatus] || 'SYSTEM', title: `Activity ${toStatus.toLowerCase()}`, message: `${activity.title} is now ${toStatus.toLowerCase()}.${comment ? ` Comment: ${comment}` : ''}`, resourceType: 'ACTIVITY', resourceId: activity._id });
  }
  return activity;
}
module.exports = { transitionActivity };
