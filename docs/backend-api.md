# Backend API contract

All routes are under `/api/v1`. JSON success responses use `{ "success": true, "data": ... }`; paginated responses add `meta: { page, limit, total, totalPages }`. Errors use `{ "success": false, "error": { "code", "message", "details?", "requestId" } }`. Identifiers are serialized as `id`; dates are ISO timestamps. Pagination defaults to page 1 / 20 records and caps `limit` at 100.

## Implemented route groups

- Health: `GET /health`, `GET /health/ready`
- Authentication: `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout`
- Users: `GET/POST /users`, `GET/PATCH /users/:id`, `PATCH /users/:id/status`, `PATCH /users/:id/role`
- Departments: `GET/POST /departments`, `GET/PATCH /departments/:id`
- Committees: `GET/POST /committees`, `GET/PATCH /committees/:id`, `PUT /committees/:id/members`
- Academic years: `GET/POST /academic-years`, `GET/PATCH /academic-years/:id`, `POST /academic-years/:id/activate`, `POST /academic-years/:id/archive`
- Calendar: `GET/POST /calendar/events`, `GET/PATCH/DELETE /calendar/events/:id`
- Activities: `GET/POST /activities`, `GET/PATCH /activities/:id`, `POST /activities/:id/assignments`, `PATCH /activities/:id/assignments/:assignmentId`, `POST /activities/:id/start|submit|return|verify|close`, `GET /activities/:id/history`, `GET /activities/:id/evidence-requirements`
- Evidence: `GET/POST /evidence`, `GET /evidence/:id`, `GET /evidence/:id/download`, `POST /evidence/:id/versions`, `DELETE /evidence/:id`
- Compliance: `GET/POST /compliance/criteria`, `GET/PATCH /compliance/criteria/:id`, `GET/POST /compliance/mappings`, `PATCH /compliance/mappings/:id`, `POST /compliance/mappings/:id/review`, `GET /compliance/completeness`
- Dashboards: `GET /dashboards/me`, `GET /dashboards/institution`, `GET /dashboards/departments/:id`
- Reports: `GET /reports/activities`, `/departments`, `/responsibilities`, `/overdue`, `/evidence-completeness`, `/compliance`, `/export.csv`
- Notifications: `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`
- Audit: `GET /audit-logs`

## Authentication and local development

Copy `backend/.env.example` to `backend/.env`; set a unique `JWT_ACCESS_SECRET` (at least 32 characters) and keep the MongoDB URI as `mongodb://127.0.0.1:27017/institute_erp`. Create the first admin interactively with `npm run create-admin`. Access tokens are stateless; logout instructs the client to discard its token. Refresh-token rotation is not implemented in this batch.

## Important deployment note

The local URI is a standalone MongoDB by default. Multi-document atomic transactions require a replica-set-capable MongoDB deployment; do not assume standalone local MongoDB supports transactions. Workflow status and history writes currently happen sequentially, so a production deployment that requires strict cross-document atomicity should run MongoDB as a replica set and add transaction boundaries around workflow changes.


## Dashboard calendar data

`GET /api/v1/dashboards/me` returns database-backed `counts` plus `upcomingEvents`, an array of up to five non-archived events whose `endAt` is in the future. Event visibility is scoped by role and department/committee membership or assigned activity. The dashboard UI uses this response directly, so an authorized upcoming event appears after refresh without hard-coded sample data.
