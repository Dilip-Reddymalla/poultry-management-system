# Poultry Management System

A full-stack poultry farm management application with a React frontend and an
Express + Prisma + PostgreSQL backend.

## Project structure

- `client/` — Vite + React + TypeScript frontend
- `server/` — Express + TypeScript API with Prisma and PostgreSQL
- `docker-compose.yml` — PostgreSQL 17 for local development

## Implemented features

- **Authentication** — email/password login and phone + OTP login (with
  multi-account selection), backed by an HTTP-only JWT cookie with server-side
  session revocation.
- **Authorization (RBAC)** — permission-based access control resolved from the
  database per request, with seeded roles (DGM, Assistant Manager, Super
  Incharge, Incharge, Supervisor, Accountant). `GET /api/auth/me` returns the
  user's resolved roles and permissions so the frontend can gate its UI.
- **Employee management** — create, read, update, deactivate/reactivate, plus
  paginated listing with filtering and search.
- **User provisioning** — issue a login account (with a role) for an employee.
- **Farm management** — list/get farms plus create, update, and
  deactivate/reactivate lifecycle endpoints.
- **Shed management** — list/get sheds plus create, update, and controlled status
  transitions (`AVAILABLE` / `MAINTENANCE` / `INACTIVE`).
- **Reference data** — read-only `GET /api/designations`, `GET /api/roles` and
  `GET /api/companies` lists so forms never hardcode options.
- **Frontend application** — cookie-session bootstrap through `GET /api/auth/me`,
  protected routing, permission-aware navigation, and working dashboard,
  employee, farm, shed and profile screens (see [`client/README.md`](client/README.md)).
- **Installable PWA** — the frontend is a production-quality Progressive Web App:
  installable and launchable standalone, with a manifest, branded icons and a
  service worker that precaches only static app assets (never authenticated API
  data) and shows a clear offline notice when the network drops
  (see [`client/README.md`](client/README.md#progressive-web-app)).
- **Attendance & Shift Management** — shift-wise attendance recording (`MORNING_SHIFT`, `AFTERNOON_SHIFT`, `NIGHT_SHIFT`, `OVERTIME`), mandatory GPS geolocation recording, deduplication of already marked individuals, shift-wise Attendance Dashboard grouped by shed, user profile attendance history with filters, and Accountant Excel spreadsheet exports.
- **OTP retention cleanup** — a reusable service plus `npm run otp:cleanup`
  script that prunes consumed/expired OTP challenges without touching active ones.
- **Automated tests** — Vitest + Supertest integration suite covering auth/RBAC,
  reference data, employee, farm, shed, and attendance behaviour against the real database.

Planned for future expansion: batch management, flock production tracking, and automated report generation. Some of their permissions are already seeded so roles are ready.

## Getting started

1. **Install dependencies** for both apps:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```
2. **Start PostgreSQL** (from the repository root). Copy the root `.env.example`
   to `.env` first if you want to override the default credentials:
   ```bash
   docker compose up -d
   ```
3. **Configure the server.** In `server/`, copy the example env and fill in real
   values (see `server/README.md` for the full variable reference, including
   `CLIENT_ORIGIN` for CORS):
   ```bash
   cd server && cp .env.example .env
   ```
4. **Apply migrations and seed** the database:
   ```bash
   npx prisma migrate dev
   npm run seed
   ```
5. **Configure the client** (optional — the default API base URL already points
   at the dev server):
   ```bash
   cd client && cp .env.example .env
   ```
6. **Run the dev servers** (in separate terminals):
   ```bash
   cd server && npm run dev
   cd client && npm run dev
   ```

The API listens on `http://localhost:5000` and the client dev server on
`http://localhost:5173`.

## Running the tests

The backend test suite runs against the local development database and requires
the seed to have been applied:

```bash
cd server && npm run test
```

It creates only prefixed temporary fixtures and cleans them up, never sends SMS,
and leaves seeded data untouched. See [`server/README.md`](server/README.md#testing)
for details.

## Other backend commands

Run from `server/`:

```bash
npm run typecheck    # type-check src and tests
npm run otp:cleanup  # prune expired/consumed OTP challenges
npm run build        # compile to dist/
npm run start        # run the compiled server
```

## Frontend commands

Run from `client/`:

```bash
npm run typecheck    # tsc -b
npm run lint         # ESLint
npm run build        # type-check then build to dist/
npm run preview      # serve the built bundle
```

## Documentation

- Backend setup, environment variables, API reference, authentication,
  authorization, the data model, OTP cleanup, and testing:
  [`server/README.md`](server/README.md)
- Building the frontend against this API (base URL, cookies, `/auth/me`,
  401 vs 403, error and pagination shapes, permission-based UI):
  [Frontend Integration Contract](server/README.md#frontend-integration-contract)
- Frontend notes: [`client/README.md`](client/README.md)

## Notes

- Keep environment values in local `.env` files; never commit real secrets. The
  `.env.example` files contain placeholders only.
- The root `.env.example` supplies the Docker Compose Postgres credentials and a
  matching `DATABASE_URL`; the server reads its own `server/.env`, and the client
  reads `client/.env` (only `VITE_API_BASE_URL`, which is not a secret).
- The client never stores a token. The session is an httpOnly cookie issued by
  the API, so every frontend request is sent with `credentials: "include"`.
