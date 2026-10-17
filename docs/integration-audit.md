# Frontend/backend integration audit

## Fixes applied

- Fixed the generic resource create handler so departments, committees, and academic years can be created without calling an object as a function.
- Allowed `isActive` in department and committee patch validators to match the administration UI's activate/deactivate requests.
- Made activity access checks asynchronous and assignment-aware; faculty members assigned to an activity can open its detail/history and perform permitted workflow actions. Access checks now handle populated and unpopulated department/committee references.
- Fixed the returned-work UI lifecycle: a returned activity must first be resumed (`POST /activities/:id/start`) before it can be submitted again.
- Added upcoming calendar events to `GET /dashboards/me`, filtered by the authenticated user's role and scope. The dashboard displays these API results; no event or statistic is hard-coded.
- Added a database-backed integration test that creates an upcoming event, then asserts it is returned by both the dashboard and calendar APIs.
- Scoped the dashboard's pending-evidence count to activities the user can access, and excluded archived activities from dashboard activity counts.
- Matched the compliance completeness UI to the backend's actual array response (`completenessPercent`) and matched notification resource type casing (`ACTIVITY`).
- Restricted resource administration controls and compliance mapping controls in the UI to roles allowed by the backend. Server-side authorization remains authoritative.
- Enforced calendar event visibility scope on creation and required appropriate department/committee targets or an activity reference for scoped events.

## Commands (PowerShell, from the project root)

```powershell
# 1. Install dependencies
npm run install:all

# 2. Check backend JavaScript syntax
npm run lint:syntax --prefix backend

# 3. Run backend unit and integration tests
npm run test:backend

# 4. Run frontend tests
npm run test:frontend

# 5. Build the frontend for production
npm run build:frontend
```

Create `backend/.env` from `backend/.env.example`, use a random `JWT_ACCESS_SECRET` of at least 32 characters, and make sure MongoDB Community Server is running at `mongodb://127.0.0.1:27017/institute_erp`.

```powershell
# Create the first administrator (interactive; do not use a hard-coded password)
npm run create-admin --prefix backend

# Terminal 1: start the API
npm run start:backend

# Terminal 2: start the Vite development server
npm run dev:frontend
```

Check API liveness and database readiness:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
Invoke-RestMethod http://localhost:5000/api/v1/health/ready
```

## Failure diagnosis

- `Invalid environment configuration`: create `backend/.env` and set a valid `JWT_ACCESS_SECRET`.
- `DATABASE_UNAVAILABLE`, readiness HTTP 503, or server selection timeout: start MongoDB Community Server and verify `MONGODB_URI` in `backend/.env`.
- Browser CORS error: ensure `CORS_ORIGIN` matches the Vite origin exactly (normally `http://localhost:5173`), then restart the API.
- API HTTP 401: sign in again; confirm the browser request includes `Authorization: Bearer <accessToken>` and that the account is active.
- API HTTP 403: verify both the role and the resource's department/committee/assignment scope. Hiding a control in the SPA does not grant or deny backend permission.
- Event absent from dashboard: confirm it is not archived, its `endAt` is in the future, its visibility includes the signed-in user's scope, and refresh `/api/v1/dashboards/me` while authenticated.
- API HTTP 400: read the response's `error.details`; it contains field-level validation messages.
- Frontend build/test failure: run `npm install` inside `frontend/`, then rerun `npm test` and `npm run build`.
- Backend test failure: run `npm install` inside `backend/`; the calendar integration test uses `mongodb-memory-server` and may need access to download its MongoDB test binary the first time.

## Verification performed in the packaging environment

- Backend JavaScript syntax check passed.
- All frontend JS/JSX files passed TypeScript's JSX syntax transpilation check.
- Full Jest/Vitest execution and the Vite production build could not be completed in this environment because npm dependency installation timed out while the package registry was unreachable. They must be run in an environment with the dependencies installed; no claim is made that those suites or the production build passed here.
