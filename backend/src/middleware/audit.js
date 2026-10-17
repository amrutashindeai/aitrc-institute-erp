const AuditLog = require('../models/AuditLog');

// Audit only allowlisted metadata. Never pass request bodies, credentials, or file contents.
function audit(action, resourceType, metadataResolver = () => ({})) {
  return async function auditRequest(req, _res, next) {
    try {
      const metadata = metadataResolver(req) || {};
      const allowlisted = {};
      for (const key of ['changedFields', 'count', 'status', 'targetRole']) {
        if (metadata[key] !== undefined) allowlisted[key] = metadata[key];
      }
      await AuditLog.create({
        actorId: req.user?._id || null,
        action,
        resourceType,
        resourceId: req.params.id || req.params.activityId || null,
        departmentId: req.user?.departmentIds?.[0] || null,
        requestId: req.id,
        metadata: allowlisted
      });
    } catch (error) {
      // Audit failures are surfaced; security-relevant mutations should not silently skip audit.
      return next(error);
    }
    return next();
  };
}
module.exports = audit;
