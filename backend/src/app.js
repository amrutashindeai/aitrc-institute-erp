const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const requestId = require('./middleware/requestId');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const resourceRoutes = require('./routes/resource.routes');
const activityRoutes = require('./routes/activities.routes');
const evidenceRoutes = require('./routes/evidence.routes');
const complianceRoutes = require('./routes/compliance.routes');
const notificationRoutes = require('./routes/notifications.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportRoutes = require('./routes/reports.routes');
const auditRoutes = require('./routes/audit.routes');
const auditTrail = require('./middleware/auditTrail');
const validateQueryParams = require('./middleware/validateQuery');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(requestId);
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(auditTrail);
app.use(config.API_PREFIX, validateQueryParams);

app.get('/', (_req, res) => res.json({ success: true, data: { name: 'Institute ERP API', version: '1.0.0' } }));
app.use(`${config.API_PREFIX}/health`, healthRoutes);
app.use(`${config.API_PREFIX}/auth`, authRoutes);
app.use(`${config.API_PREFIX}`, resourceRoutes);
app.use(`${config.API_PREFIX}/activities`, activityRoutes);
app.use(`${config.API_PREFIX}/evidence`, evidenceRoutes);
app.use(`${config.API_PREFIX}/compliance`, complianceRoutes);
app.use(`${config.API_PREFIX}/notifications`, notificationRoutes);
app.use(`${config.API_PREFIX}/dashboards`, dashboardRoutes);
app.use(`${config.API_PREFIX}/reports`, reportRoutes);
app.use(`${config.API_PREFIX}/audit-logs`, auditRoutes);

// Domain routes are mounted in subsequent implementation batches.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
