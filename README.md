# Institute ERP

A full-stack, role-based Institute ERP for academic planning, activity workflows, evidence management, calendar events, dashboards, and compliance reporting.

## Requirements

- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm 10 or newer
- MongoDB Community Server, running locally or reachable through `MONGODB_URI`

## Quick start

Run these commands from the project root.

```bash
npm run setup
npm run install:all
npm run check:syntax
```

`npm run setup` creates `backend/.env` and `frontend/.env` only if they do not already exist. It generates a fresh random `JWT_ACCESS_SECRET` for a new backend environment file. The script never overwrites existing environment files. Review both files before running the application.

Ensure MongoDB is running and that `backend/.env` has the correct `MONGODB_URI`. Start the API and frontend in **two separate terminals** from the project root:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Open the Vite URL printed in the frontend terminal (normally `http://localhost:5173`). The API defaults to `http://localhost:5000`, with the API prefix `/api/v1`.

## First administrator and optional sample data

Create the first administrator interactively; use a unique email and a strong password of at least 12 characters containing letters and numbers:

```bash
npm run create-admin
```

To create the administrator plus a sample CSE department and the 2026–2027 academic year, run the optional seed script instead:

```bash
npm run seed
```

The seed script is disabled when `NODE_ENV=production`, prompts for credentials, and preserves existing records. It is intended for development/demo databases; review `backend/scripts/seed.js` before using it with any shared data. Do not run both commands with the same administrator email.

## Build, test, and diagnostics

```bash
npm run check:syntax
npm run test:backend
npm run test:frontend
npm run test
npm run build:frontend
npm run preview:frontend
```

- `check:syntax` checks backend JavaScript syntax.
- Backend tests use Jest, Supertest, and MongoDB Memory Server; first run may require downloading a MongoDB test binary.
- Frontend tests use Vitest.
- `build:frontend` creates `frontend/dist/`; generated build output is intentionally excluded from source archives.

Health checks (PowerShell):

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
Invoke-RestMethod http://localhost:5000/api/v1/health/ready
```

The liveness endpoint checks the API process; readiness also depends on the database connection.

## Configuration

- `backend/.env.example`: server port, MongoDB URI, JWT settings, CORS origin, upload limits and logging.
- `frontend/.env.example`: frontend API base URL (`VITE_API_BASE_URL`).
- If the frontend is hosted at a different origin, update `CORS_ORIGIN` in `backend/.env` to the exact allowed origin(s), comma-separated.
- Uploaded evidence is stored under `backend/uploads/` by default and must be treated as private runtime data.

## Project layout

```text
backend/       Express API, Mongoose models, auth, validation, workflows and tests
frontend/      React + Vite application
scripts/       Root setup utility
 docs/         API, permission and integration-audit documentation
```

## Security and production readiness

Never commit real `.env` files, credentials, logs, or uploaded evidence. Authorization and validation must be enforced by the backend, not just by UI visibility. The current SPA stores its short-lived access token in `localStorage`; for production, consider server-managed HttpOnly/Secure refresh sessions with CSRF protections, TLS, backups, rate-limit monitoring, and a production secrets manager. Run the test suites and production build in the target environment before deployment.

See `docs/backend-api.md`, `docs/permissions.md`, and `docs/integration-audit.md` for API details, access rules, known audit findings, and verification notes.
