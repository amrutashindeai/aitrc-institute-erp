# Institute ERP frontend

React + Vite single-page application for the Institute ERP Express backend. Business data is loaded through Axios; dashboard statistics are never replaced with mock values.

## Requirements
- Node.js 20 or newer
- Express API running at `http://localhost:5000`
- MongoDB configured and an initial administrator created via backend `npm run create-admin`

## Start
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

Set `VITE_API_BASE_URL` in `.env` to your backend base URL, including `/api/v1`.

## Verify
```bash
npm run build
npm test
```

## Pages
Login, role-aware navigation, dashboard, activity list and workflow details, calendar, evidence upload/protected download, reports and CSV export, notifications, user administration, departments, committees, academic years, compliance mappings, audit trail and password settings.

The backend remains authoritative for permissions, resource scope and validation. The first version stores the short-lived access token in `localStorage`; for higher-security production use, prefer short-lived access tokens plus a server-managed HttpOnly/Secure refresh session and appropriate CSRF protections.
