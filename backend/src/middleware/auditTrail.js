const AuditLog = require('../models/AuditLog');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function resourceTypeFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts[2] || 'UNKNOWN'; // /api/v1/{resource}/...
}
function auditTrail(req, res, next) {
  if (!MUTATING_METHODS.has(req.method) || req.path.endsWith('/auth/login') || req.path.startsWith('/api/v1/health')) return next();
  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400 || req.path.startsWith('/api/v1/audit-logs')) return;
    const resourceType = resourceTypeFromPath(req.path);
    const resourceId = req.params?.id || req.params?.activityId || null;
    AuditLog.create({
      actorId: req.user?._id || null,
      action: `${req.method} ${req.route?.path || req.path}`.slice(0, 100),
      resourceType: String(resourceType).slice(0, 100),
      resourceId,
      departmentId: req.user?.departmentIds?.[0] || null,
      requestId: req.id || null,
      metadata: { status: res.statusCode }
    }).catch(error => console.error(`[${req.id || 'no-request-id'}] audit write failed:`, error.message));
  });
  next();
}
module.exports = auditTrail;
