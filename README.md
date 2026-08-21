# Attendance Management System

A full-stack employee attendance/check-in app with GPS geofencing, leave management, salary estimation, and reporting. Two role-based views (Manager/Admin vs Employee), 4-language i18n with RTL. Node/Express + Supabase (Postgres) backend, React (Vite) frontend.

## Tech Stack

**Backend** (`backend/`)

- Node.js (ESM) + Express 4
- Supabase Postgres via `pg` (node-postgres), connected through the Supavisor session pooler
- JWT auth (access + refresh tokens), bcryptjs password hashing
- Security: helmet, express-rate-limit, express-validator, CORS
- Extras: geolib (geofence math), exceljs / pdfkit (report export), node-cron, winston, multer
- Dev/test: nodemon, jest, supertest

**Frontend** (`frontend/`)

- React 18 + Vite, React Router 7
- Zustand (auth state), axios (API client with auto token-refresh interceptor)
- Tailwind CSS, logical (start/end) spacing throughout for RTL support
- i18next / react-i18next — 4 languages: English, Hebrew (RTL), Russian, Georgian
- date-fns, react-hot-toast

## Architecture

```
backend/
  server.js              entrypoint — connects DB, starts Express, graceful shutdown
  src/
    app.js               Express app: CORS, helmet, rate limiting, audit log, routes
    config/database.js   pg.Pool connection to Supabase Postgres (via Supavisor pooler)
    db/schema.sql         full Postgres schema (tables, constraints, triggers)
    models/              User, Attendance, GeofenceLocation, LeaveRequest, LeaveBalance, AuditLog — plain SQL query modules (no ORM)
    controllers/         auth, attendance, geofence, leave, report (business logic)
    routes/               auth, attendance, geofence, leave, reports
    middleware/           auth (JWT verify + role guard), auditLog, errorHandler
    utils/rowMapper.js    snake_case (DB) <-> camelCase (JS) conversion

supabase/
  config.toml            Supabase CLI project config (from `supabase init`)
  migrations/            timestamped copy of db/schema.sql, for `supabase db push` / CLI workflows

frontend/
  src/
    App.jsx              routes, role-gated via ProtectedRoute
    store/authStore.js   zustand auth state (wraps authService + localStorage)
    services/            api.js (axios instance) + one service per resource (auth/attendance/geofence/leave/user/report)
    components/          AppLayout (responsive sidebar/drawer + header), ProtectedRoute, ClockWidget, PresentNowWidget,
                          LanguageSwitcher, StatusBadge
    pages/                LoginPage, DashboardPage, AttendancePage, LeavePage, SalaryPage, ProfilePage,
                          EmployeesPage (Admin), GeofencesPage (Admin), ReportsPage (Manager/Admin)
    i18n/                config.js + en/he/ru/ka.json (RTL auto-applied for Hebrew)
```

## Domain Model

- **User** — email/password (bcrypt-hashed), role (`EMPLOYEE` / `MANAGER` / `ADMIN`), department, position, salary, `workingHoursPerDay`, `canCheckInFromAnywhere` flag, status.
- **Attendance** — one record per user/day: clock-in/out timestamps + GPS (lat/lng/accuracy/geofence check), computed `totalHours`/`overtimeHours` (auto-deducts 1hr lunch if >8h, correctly spans midnight since it diffs full timestamps), status (`PENDING`/`COMPLETED`/`MISSING_CLOCKOUT`/`INCOMPLETE`). A forgotten clock-out from a previous day is auto-flagged `MISSING_CLOCKOUT` the next time that user clocks in. Managers can manually correct any record.
- **GeofenceLocation** — named office location (lat/lng/radius, 100–5000m), haversine distance check, per-location allowlist of users exempted from GPS checks (`canCheckInFromAnywhere`).
- **LeaveRequest** — type (vacation/sick/personal/unpaid/maternity/other), date range, approval workflow (pending/approved/rejected/cancelled), employee can cancel their own pending requests.
- **LeaveBalance** — per-user/year/type allowance tracking (defaults auto-provisioned on registration: 21 vacation / 14 sick / 5 personal / 90 maternity days), carryover, auto-computed remaining days, decremented only on approval.
- **AuditLog** — request audit trail (table + write path exist; not yet wired into every route).

## API Surface

| Route                                                 | Auth          | Notes                                                                                       |
| ----------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`                             | Admin         | only an admin can create accounts                                                           |
| `POST /api/auth/login`                                | —             |                                                                                             |
| `POST /api/auth/refresh`                              | —             | rotate access token                                                                         |
| `GET /api/auth/me`                                    | JWT           |                                                                                             |
| `GET /api/auth/users`                                 | Manager/Admin | list all users (for pickers, employee management)                                           |
| `POST /api/auth/logout`                               | JWT           |                                                                                             |
| `POST /api/attendance/clock-in` / `clock-out`         | JWT           | rejects if outside geofence (unless `canCheckInFromAnywhere`); auto-flags stale open shifts |
| `GET /api/attendance/today` \| `records` \| `summary` | JWT           | employees see only their own                                                                |
| `GET /api/attendance/active-now`                      | Manager/Admin | who's currently clocked in                                                                  |
| `PUT /api/attendance/:id`                             | Manager/Admin | manual correction                                                                           |
| `GET/POST/PUT/DELETE /api/geofence`                   | JWT / Admin   | manage office locations                                                                     |
| `POST /api/geofence/:id/(add\|remove)-free-checkin`   | Admin         | exempt specific users from GPS                                                              |
| `POST /api/leave` \| `GET /mine` \| `GET /balance`    | JWT           | submit / view own requests & balance                                                        |
| `GET /api/leave?status=`                              | Manager/Admin | all requests, optional status filter                                                        |
| `PUT /api/leave/:id/approve` \| `/reject`             | Manager/Admin | decrements balance on approval                                                              |
| `PUT /api/leave/:id/cancel`                           | JWT (owner)   | cancel own pending request                                                                  |
| `GET /api/reports/attendance/excel` \| `/pdf`         | JWT           | `?userId=&year=&month=`; employees forced to their own userId                               |
| `GET /api/health`                                     | —             |                                                                                             |

## Database (Supabase Postgres)

- Schema lives in [backend/src/db/schema.sql](backend/src/db/schema.sql) (mirrored under `supabase/migrations/`), already applied to the live project.
- Six tables: `users`, `attendance`, `geofence_locations`, `leave_requests`, `leave_balances`, `audit_logs` — UUID primary keys, `CHECK`-constraint enums, `updated_at` triggers, `leave_balances.remaining` auto-computed by trigger.
- **Connection**: through Supabase's **Supavisor session pooler** (`aws-0-eu-central-1.pooler.supabase.com:5432`), not the direct `db.<ref>.supabase.co` host — that's IPv6-only and was unreachable from this dev machine. Pooler username is `postgres.<project-ref>`.
- **Gotcha**: DB passwords containing `#` must be quoted in `.env` (`SUPABASE_DB_PASSWORD="...#..."`) — unquoted, dotenv treats `#` as a comment and silently truncates the value. Already handled.
- To change schema: edit `backend/src/db/schema.sql`, apply with `psql`, copy into a new timestamped file under `supabase/migrations/`.

## First login / bootstrapping

Since `/api/auth/register` requires an admin token, the very first admin is seeded directly via SQL: [backend/src/db/seed_admin.sql](backend/src/db/seed_admin.sql) (already applied).

```
email:    admin@attendance
password: Admin@12345
```

```
email:    john@attendance
password: Employee@12345
```

```
email:    anna@attendance
password: Employee@12345
```

```
email:    giorgi@attendance
password: Employee@12345
```

```
email:    levan@attendance
password: Employee@12345
```

Log in as this admin, then use the **Employees** page to create Manager/Employee accounts (each gets default leave balances automatically). Change this seed password's hash directly in the DB if needed — there's no self-service change-password endpoint yet.

## Setup

```bash
# Backend
cd backend
cp .env.example .env   # fill in Supabase pooler host/user/password, JWT secrets, etc.
npm install
npm run dev             # nodemon, http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev              # vite, http://localhost:3000 (see vite.config.js)
```

Backend `.env` requires (see `.env.example`): `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_NAME`, `CORS_ORIGIN` (must include the frontend's origin), JWT secrets.

Frontend `.env`: `VITE_API_URL` (defaults to `http://localhost:5000/api` if unset).

## Current Status

Implemented end-to-end and verified live (both via API calls and driving the actual UI in a browser):

- Auth (admin-gated registration, login, JWT refresh)
- Digital clock in/out with GPS geofencing, automatic hour/overtime calculation (midnight-safe), missing-clockout and double-clock-in edge cases
- Leave requests with balance tracking, manager approve/reject, employee cancel
- Automatic salary estimate from worked hours (regular + 1.5x overtime) on the Salary page
- Attendance reports exportable as Excel (`exceljs`) and PDF (`pdfkit`), per employee/month
- Manager "who's present now" dashboard widget
- Employee management (Admin) and office-location management (Admin) screens
- Responsive layout (desktop fixed sidebar, mobile slide-in drawer) and full RTL for Hebrew

Not built yet (natural next steps): self-service profile editing / password change, notifications & reminders (e.g. forgot-to-clock-out alerts), audit log surfaced anywhere in the UI, automated tests. No `.git` repo initialized yet.
