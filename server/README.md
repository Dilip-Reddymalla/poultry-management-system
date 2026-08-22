# Server API

Backend API for the Poultry Management System. It exposes a JSON HTTP API for
authentication, authorization, employee management, user provisioning, and farm
and shed management (reads plus writes and lifecycle transitions).

## Tech stack

- Node.js + TypeScript (ESM, `NodeNext` module resolution)
- Express 5
- Prisma ORM 7 with the `@prisma/adapter-pg` driver adapter (`pg` connection pool)
- PostgreSQL 17
- Zod for request validation
- argon2 for password and OTP hashing
- JSON Web Tokens delivered via an HTTP-only cookie
- Vitest + Supertest for the automated test suite

## Folder structure

```
server/
├─ prisma/
│  ├─ schema.prisma        # data model + indexes
│  ├─ migrations/          # SQL migration history
│  └─ seed.ts              # idempotent seed (company, farm, sheds, roles, permissions, DGM)
├─ prisma.config.ts        # Prisma 7 config: datasource URL + seed command
├─ vitest.config.ts        # test runner config
├─ tsconfig.test.json      # type-checks src + tests together
├─ tests/                  # Supertest integration tests (auth/RBAC, employee, farm, shed, API contract)
└─ src/
   ├─ app.ts               # Express app, middleware, route mounting
   ├─ server.ts            # HTTP bootstrap
   ├─ config/              # env parsing, Prisma client
   ├─ middlewares/         # requireAuth, requirePermission/requireRole, error handler
   ├─ scripts/             # operational one-off scripts (OTP retention cleanup)
   ├─ utils/               # jwt, auth-cookie, password, otp, phone, httpsms, app-error
   └─ modules/
      ├─ auth/             # login, /me, logout, OTP phone login, OTP cleanup service
      ├─ employee/         # employee CRUD + lifecycle + user provisioning
      ├─ farm/             # farm reads + writes + lifecycle
      └─ shed/             # shed reads + writes + status transitions
```

## Scripts

- `npm run dev` — start the API in watch mode (`tsx watch src/server.ts`)
- `npm run build` — compile TypeScript to `dist/`
- `npm run start` — run the compiled server (`node dist/server.js`)
- `npm run seed` — run the idempotent database seed (`prisma db seed`)
- `npm run otp:cleanup` — delete retained expired/consumed OTP challenges
- `npm run test` — run the automated test suite once (`vitest run`)
- `npm run test:watch` — run the test suite in watch mode
- `npm run typecheck` — type-check `src` (build config) and then `src` + `tests`

## Environment configuration

Environment variables are parsed and validated at boot in
[`src/config/env.ts`](src/config/env.ts); the process exits if any are missing or
invalid. Copy `.env.example` to `.env` and fill in real values.

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | yes | `development` \| `test` \| `production` |
| `PORT` | yes | Positive integer, e.g. `5000` |
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | At least 32 characters |
| `HTTPSMS_API_KEY` | yes | HTTPSMS API key used to deliver OTPs |
| `HTTPSMS_FROM_PHONE` | yes | HTTPSMS sender phone number |
| `CLIENT_ORIGIN` | production only | Frontend origin allowed by CORS (e.g. `https://poultry.example.com`). Optional in development, where it defaults to `http://localhost:5173`; **required** when `NODE_ENV=production` and the process refuses to boot without it |
| `SEED_DGM_EMAIL` | seed only | Bootstrap DGM login email |
| `SEED_DGM_PASSWORD` | seed only | Bootstrap DGM password |
| `SEED_DGM_PHONE` | seed only | Bootstrap DGM phone |

Never commit `.env` or real secrets. `.env.example` contains placeholders only.

## Database setup

PostgreSQL runs via Docker Compose defined at the repository root.

```bash
# from the repository root
docker compose up -d
```

Then, from `server/`:

```bash
npm install
cp .env.example .env   # then edit .env with real values
npx prisma migrate dev # apply migrations and generate the Prisma client
npm run seed           # populate reference data + the bootstrap DGM account
npm run dev            # start the API
```

### Prisma & migrations

- The datasource URL is supplied by [`prisma.config.ts`](prisma.config.ts) (Prisma
  7 config), not by the `datasource` block in `schema.prisma`.
- Apply and create migrations in development: `npx prisma migrate dev`
- Check state without changing anything: `npx prisma migrate status`
- Regenerate the client after a schema edit: `npx prisma generate`
- The seed is idempotent (upserts only) and safe to run repeatedly. It never
  deletes existing rows.

## Authentication

Two login paths issue the same session. On success the API sets an HTTP-only
cookie named `poultry_auth` containing a JWT (`{ sub: <userId> }`, 1-hour
expiry, `sameSite=lax`, `secure` in production). The token is verified on every
protected request. The cookie name, flags and lifetime live in one place —
[`src/utils/auth-cookie.ts`](src/utils/auth-cookie.ts) — and the `maxAge` is
derived from the JWT lifetime so the cookie and the token always expire together.

The JWT carries **identity only** (`sub`). Roles and permissions are never
encoded in the token; they are resolved from the database on every request, so a
role change or a deactivation takes effect immediately without waiting for the
token to expire.

### Email + password

`POST /api/auth/login` with `{ email, password }`. Login is rejected with a
generic `401 Invalid email or password` when the user does not exist, the user
is inactive, the linked employee is not `ACTIVE`, or the password is wrong — the
message never reveals which.

### Phone + OTP

1. `POST /api/auth/phone/request-otp` `{ phone }` — generates a 6-digit OTP,
   hashes it, stores an `OtpChallenge`, and sends the code via HTTPSMS. A 60s
   resend cooldown and a 5-minute expiry apply.
2. `POST /api/auth/phone/verify-otp` `{ phone, otp }` — verifies the latest
   active challenge (max 5 attempts).
   - If exactly one active account matches the phone, a session cookie is set.
   - If **multiple** accounts share the phone, the response returns
     `requiresUserSelection: true`, the matching accounts, and a short-lived
     `selectionToken`.
3. `POST /api/auth/phone/select-user` `{ selectionToken, userId }` — completes
   login for the chosen account.

### Session endpoints

- `GET /api/auth/me` (requires auth) — returns the current safe user, including
  the resolved `roles` and `permissions`.
- `POST /api/auth/logout` — clears the cookie.

### Session validity & revocation

Session validity is re-checked from the database on every authenticated request:
if the user is missing/inactive or the linked employee is `INACTIVE`, the request
is rejected with `401` even when the JWT is still cryptographically valid. So
deactivating an employee ends their live session immediately, and reactivating
restores it — no token rotation involved. `User.isActive` is a separate switch:
either flag being off blocks authentication.

`passwordHash`, `otpHash`, and the phone `selectionToken` are never returned in
any response.

### OTP challenge retention

`OtpChallenge` rows are written on every OTP request and are never needed once a
challenge has been consumed or has expired, so the table needs pruning.

- `purgeExpiredOtpChallenges()` in
  [`src/modules/auth/auth.service.ts`](src/modules/auth/auth.service.ts) deletes
  only challenges that are **already consumed or already expired** *and* older
  than the retention window `OTP_RETENTION_MS` (24 hours, defined in
  [`src/utils/otp.ts`](src/utils/otp.ts)). An active, unexpired challenge is
  never deleted, so a login in progress cannot be broken.
- The delete is idempotent and safe to run repeatedly or concurrently; it returns
  the number of rows removed.
- The short retention window keeps recently expired challenges around briefly for
  troubleshooting a failed login rather than deleting them the moment they expire.
- The lookup uses the existing `OtpChallenge(phone, createdAt)` index for reads;
  the cleanup itself is a single bulk `DELETE` filtered on `createdAt`.

**Intended execution mechanism:** run the bundled script on a schedule from
whatever scheduler the deployment already has (cron, Windows Task Scheduler, a
container cron sidecar, or a platform scheduled job). No in-process scheduler is
built into the API.

```bash
npm run otp:cleanup
```

Example crontab entry (daily at 03:15):

```bash
15 3 * * * cd /srv/poultry/server && npm run otp:cleanup >> /var/log/otp-cleanup.log 2>&1
```

## CORS, cookies & frontend connection

The frontend is a separate application on its own origin, so the session cookie
only reaches the API when both sides are configured correctly.

| Concern | Configuration | Where |
|---------|---------------|-------|
| Allowed origin | Exactly one origin: `CLIENT_ORIGIN`, defaulting to `http://localhost:5173` in development. A wildcard is impossible here — the CORS spec forbids `*` on credentialed requests | [`src/app.ts`](src/app.ts), [`src/config/env.ts`](src/config/env.ts) |
| Credentials | `credentials: true`, so the browser is allowed to attach the cookie. The frontend **must** send requests with `credentials: "include"` (`withCredentials: true` for Axios) | [`src/app.ts`](src/app.ts) |
| `httpOnly` | Always on — the token is unreadable from JavaScript, so an XSS bug cannot steal the session | [`src/utils/auth-cookie.ts`](src/utils/auth-cookie.ts) |
| `secure` | On when `NODE_ENV=production` (HTTPS only), off in local development because localhost is plain HTTP | [`src/utils/auth-cookie.ts`](src/utils/auth-cookie.ts) |
| `sameSite` | `lax` | [`src/utils/auth-cookie.ts`](src/utils/auth-cookie.ts) |
| Lifetime | `maxAge` derived from the JWT TTL (1 hour), so cookie and token expire together | [`src/utils/jwt.ts`](src/utils/jwt.ts) |
| Path | `/` for both setting and clearing, so logout reliably removes the cookie | [`src/utils/auth-cookie.ts`](src/utils/auth-cookie.ts) |

Development vs production:

- **Development** — `CLIENT_ORIGIN` may be omitted; the Vite dev server origin
  `http://localhost:5173` is assumed. `secure` is off. `localhost:5173` and
  `localhost:5000` are cross-*origin* but same-*site* (ports are not part of a
  site), so the `lax` cookie is sent normally.
- **Production** — `CLIENT_ORIGIN` is mandatory and the process exits at boot if
  it is missing, so the API can never fall back to a development origin by
  accident. `secure` is on, which means the API must be served over HTTPS.
- **Same-site requirement** — with `sameSite=lax`, the API and the frontend must
  share a registrable domain (e.g. `app.example.com` + `api.example.com`).
  Serving them from two unrelated domains would require `sameSite=none` +
  `secure`, which weakens CSRF protection; that is a deliberate decision to make
  at deployment time, not a default this codebase ships.

## Authorization (RBAC)

Permissions are always resolved fresh from the database per request; they are
never read from the request body, query, or JWT claims.

- `requireAuth` — verifies the cookie and attaches `userId`. `401` if absent/invalid.
- `requirePermission(...names)` — runs behind `requireAuth`; allows the request if
  the user holds **any** of the listed permissions. `403` otherwise.
- `requireRole(...names)` — same shape, matched against role names.

Model: `User → UserRole → Role → RolePermission → Permission`. Permission names
follow a `resource:action` convention (e.g. `employee:view`, `user:create`).

### Seeded roles

| Role | Permission count | Summary |
|------|------------------|---------|
| DGM | all (29) | Full authority; automatically granted every permission |
| Assistant Manager | 25 | Broad operational management, incl. farm/shed creation and updates |
| Super Incharge | 15 | Broad farm operations, incl. shed status changes |
| Incharge | 13 | Operational supervision, incl. shed status changes |
| Supervisor | 7 | Assigned shed / operational entry (read-only for farms and sheds) |
| Accountant | 9 | Administrative + financial views; retains employee deactivate/reactivate |

The exact matrix lives in [`prisma/seed.ts`](prisma/seed.ts). DGM is assigned
every permission programmatically so it stays full-authority as new permissions
are added. Approvals (`approval:approve` / `approval:reject`) are DGM-only.

Infrastructure write authority is deliberately narrow:

| Permission | Roles |
|------------|-------|
| `farm:create`, `farm:update` | DGM, Assistant Manager |
| `farm:deactivate`, `farm:reactivate` | DGM only (taking a farm out of service is high-impact) |
| `shed:create`, `shed:update` | DGM, Assistant Manager |
| `shed:update-status` | DGM, Assistant Manager, Super Incharge, Incharge (day-to-day maintenance state) |

## API reference

Base path: `/api`. Everything is JSON in and JSON out.

### Response & error envelope

- Success: `{ "success": true, ...payload }`. Single resources use the entity name
  (`employee`, `farm`, `shed`, `user`), collections use the plural
  (`employees`, `farms`, `sheds`). Writes also include a human-readable `message`.
- Error: `{ "success": false, "message": "..." }`, plus `errors` (per-field
  messages) and `formErrors` (object-level messages) on validation failures.
- Status codes are used consistently across every module:

| Status | Meaning | Example |
|--------|---------|---------|
| `400` | Request failed validation (body, query or path param) | non-UUID `:id`, missing required field, `capacity: -1` |
| `401` | Not authenticated — no cookie, invalid/expired token, or the account/employee is no longer active | `GET /api/auth/me` without a cookie |
| `403` | Authenticated but missing the required permission | Supervisor calling `POST /api/farms` |
| `404` | The addressed resource, or a referenced one, does not exist | unknown employee id, unknown `companyId` |
| `409` | Request conflicts with current state | duplicate code, deactivating an already-inactive record |
| `429` | OTP resend cooldown or attempt limit | repeated `request-otp` within 60s |
| `500` | Unexpected server error (details are logged, never returned) | — |

Representation conventions: IDs are UUID strings; enums are `UPPER_SNAKE_CASE`
strings; dates and timestamps are ISO-8601 strings (`joiningDate` may be `null`);
optional values are always present as explicit `null` rather than omitted;
booleans are real booleans (`hasUser`, `success`).

### List response standard

Two deliberate list shapes, chosen per collection rather than uniformly:

| Shape | Used by | Rule |
|-------|---------|------|
| Paginated — `{ success, <plural>: [...], pagination: { page, limit, total, totalPages } }` | `GET /api/employees` | Collections that grow with the business (employees, and future attendance/batch/production records) |
| Simple list — `{ success, <plural>: [...] }` | `GET /api/farms`, `GET /api/sheds` | Small, slow-changing reference collections a frontend can hold in memory and filter client-side |

A frontend can tell the two apart reliably: **a paginated endpoint always
returns a `pagination` object; a simple list never does.** Query filters exist on
both shapes and do not change it. Farm and shed lists are intentionally
unpaginated (single-digit farms, tens of sheds); adding pagination there would add
client complexity for no benefit. If either collection later grows, it moves to
the paginated shape by gaining a `pagination` object — an additive change.

### Auth (`/api/auth`)

`GET /api/health` and every `/api/auth` route except `/me` are public; `/me`
requires the session cookie. No auth route requires a permission.

| Method | Path | Auth | Request | Success | Notable errors |
|--------|------|------|---------|---------|----------------|
| POST | `/login` | public | `{ email, password }` | `200 { success, message, user }` + sets `poultry_auth` cookie | `400` invalid body; `401 Invalid email or password` — returned identically for unknown email, wrong password, inactive user and non-`ACTIVE` employee |
| POST | `/phone/request-otp` | public | `{ phone }` | `200 { success, message, phone }` (normalised phone) | `400` invalid body; `429 OTP resend cooldown active` (60s) |
| POST | `/phone/verify-otp` | public | `{ phone, otp }` (6 digits) | `200 { success, message, requiresUserSelection: false, user }` + cookie, **or** `200 { success, message, requiresUserSelection: true, selectionToken, users: [{ id, employeeId, name, designation }] }` when several accounts share the phone | `400 Invalid or expired OTP`; `429 OTP attempt limit exceeded` (5 tries); `404` no active account for the phone |
| POST | `/phone/select-user` | selection token | `{ selectionToken, userId }` | `200 { success, message, user }` + cookie | `400` invalid body, expired/forged token, or a `userId` outside the token's accounts |
| GET | `/me` | cookie | — | `200 { success, user }` | `401` missing/invalid cookie, deleted/inactive user, or employee no longer `ACTIVE` |
| POST | `/logout` | public | — | `200 { success, message }` + clears the cookie | — (deliberately idempotent, so a client with an expired session can still clear it) |

The `user` object is identical in all four cases — see
[Frontend Integration Contract](#frontend-integration-contract) for the shape.

### Employees (`/api/employees`)

All routes require authentication plus the noted permission.

| Method | Path | Permission | Request | Success | Notable errors |
|--------|------|------------|---------|---------|----------------|
| GET | `/` | `employee:view` | Query: `page` (≥1, default 1), `limit` (1–100, default 20), `status`, `designationId`, `search` (name, case-insensitive) | `200 { success, employees, pagination }` | `400` invalid query value |
| GET | `/:id` | `employee:view` | Path: `id` (UUID) | `200 { success, employee }` | `400` non-UUID id; `404 Employee not found` |
| POST | `/` | `employee:create` | `{ employeeId, name, designationId, phone?, photoUrl?, joiningDate? }` | `201 { success, message, employee }` | `400`; `404 Designation not found`; `409 Employee ID already exists` |
| PATCH | `/:id` | `employee:update` | Any of `{ name, designationId, phone, photoUrl, joiningDate }`; the three nullable fields accept `null` to clear | `200 { success, message, employee }` | `400`; `404` employee or designation; `409` duplicate `employeeId` |
| PATCH | `/:id/deactivate` | `employee:deactivate` | Path: `id` | `200 { success, message, employee }` | `404`; `409 Employee is already inactive` |
| PATCH | `/:id/reactivate` | `employee:reactivate` | Path: `id` | `200 { success, message, employee }` | `404`; `409 Employee is already active` |
| POST | `/:id/user` | `user:create` | `{ email, password (min 8), roleId }` | `201 { success, message, user }` | `400`; `404` employee or role; `409` inactive employee, existing account, or email in use |

- `employeeId` (business identity) and `status` are **not** editable via `PATCH /:id`;
  status is owned solely by the deactivate/reactivate endpoints.
- Deactivate rejects an already-inactive employee (`409`); reactivate rejects an
  already-active one (`409`).
- Employee responses never include the linked user's secret fields; they expose
  only `hasUser`.

### User provisioning (`POST /api/employees/:id/user`)

Body `{ email, password (min 8), roleId }`. Requires the employee to exist, be
`ACTIVE`, and have no existing user. Creates the `User` and its single
`UserRole` in one transaction. Duplicate email → `409`. Roles remain the source
of permissions; permissions are never assigned directly to a user.

### Farms (`/api/farms`)

All routes require authentication plus the noted permission.

| Method | Path | Permission | Request | Success | Notable errors |
|--------|------|------------|---------|---------|----------------|
| GET | `/` | `farm:view` | Query: `status` (`ACTIVE` \| `INACTIVE`) | `200 { success, farms }` (each with nested `company`) | `400` invalid `status` |
| GET | `/:id` | `farm:view` | Path: `id` (UUID) | `200 { success, farm }` | `400` non-UUID id; `404 Farm not found` |
| POST | `/` | `farm:create` | `{ companyId, code, name }` | `201 { success, message, farm }` | `400`; `404 Company not found`; `409` duplicate `code` in that company |
| PATCH | `/:id` | `farm:update` | Any of `{ code, name }` | `200 { success, message, farm }` | `400`; `404`; `409` duplicate `code` |
| PATCH | `/:id/deactivate` | `farm:deactivate` | Path: `id` | `200 { success, message, farm }` | `404`; `409 Farm is already inactive` |
| PATCH | `/:id/reactivate` | `farm:reactivate` | Path: `id` | `200 { success, message, farm }` | `404`; `409 Farm is already active` |

- The owning company is fixed at creation, so a farm can never be reparented via
  `PATCH`; `status` is owned solely by the deactivate/reactivate endpoints.
- Unknown `companyId` → `404`; duplicate `code` within the company → `409`.
- Deactivating an already-inactive farm (or reactivating an active one) → `409`.
- Farm **deletion** is not implemented: farms own sheds under a `RESTRICT`
  foreign key and are historical operational records, so deactivation is the
  correct retirement path.

### Sheds (`/api/sheds`)

All routes require authentication plus the noted permission.

| Method | Path | Permission | Request | Success | Notable errors |
|--------|------|------------|---------|---------|----------------|
| GET | `/` | `shed:view` | Query: `farmId` (UUID), `status` (`AVAILABLE` \| `OCCUPIED` \| `MAINTENANCE` \| `INACTIVE`) | `200 { success, sheds }` (each with nested `farm`) | `400` invalid `farmId`/`status` |
| GET | `/:id` | `shed:view` | Path: `id` (UUID) | `200 { success, shed }` | `400` non-UUID id; `404 Shed not found` |
| POST | `/` | `shed:create` | `{ farmId, number, capacity }` (`capacity` integer ≥ 0) | `201 { success, message, shed }` | `400`; `404 Farm not found`; `409` inactive farm or duplicate `number` in that farm |
| PATCH | `/:id` | `shed:update` | Any of `{ number, capacity }` | `200 { success, message, shed }` | `400`; `404`; `409` duplicate `number` |
| PATCH | `/:id/status` | `shed:update-status` | `{ status }` — `AVAILABLE` \| `MAINTENANCE` \| `INACTIVE` | `200 { success, message, shed }` | `400` invalid or `OCCUPIED` status; `404`; `409` shed is currently `OCCUPIED` or already in the requested status |

- The owning farm is fixed at creation, so a shed can never be moved across farms
  via `PATCH`, and an invalid cross-farm relationship cannot be introduced.
- Unknown `farmId` → `404`. A shed cannot be created under an `INACTIVE` farm →
  `409`. Duplicate `number` within the same farm → `409`.
- `OCCUPIED` is **not** an assignable status on the status endpoint: occupancy
  belongs to the batch lifecycle, which is not implemented yet. Changing the
  status of a shed that is currently `OCCUPIED` → `409`, and re-applying the
  status a shed already has → `409`.
- Shed **assignment** (`shed:assign`-style behaviour) is not implemented because
  there is no batch entity to assign; see *Implemented vs planned*.

## Frontend Integration Contract

Everything a frontend needs in order to talk to this API. Nothing here is
aspirational — it all describes endpoints that exist today.

### Base URL & credentials

- Base URL: `http://localhost:5000/api` in development; in production whatever
  origin the API is deployed to, plus `/api`. Keep it in a single frontend env
  variable (`VITE_API_BASE_URL`) — never hardcode it per call.
- **Every** request must send cookies, including the ones that set them:

```ts
fetch(`${BASE_URL}/auth/me`, { credentials: "include" });
// axios.create({ baseURL: BASE_URL, withCredentials: true });
```

Without `credentials: "include"` the session cookie is neither stored nor sent,
and every protected call returns `401`. The API must also know the frontend
origin — see [CORS, cookies & frontend connection](#cors-cookies--frontend-connection).

There is no token for the frontend to read, store or attach: the session lives in
an `httpOnly` cookie the browser manages. Do not attempt to read `document.cookie`
and do not build an `Authorization` header.

### Authentication flow

**Email + password**

1. `POST /auth/login` with `{ email, password }` → `200` and the cookie is set.
2. Use the returned `user` immediately; no follow-up request is needed.
3. On `401`, show a single generic message ("Invalid email or password"). The API
   deliberately does not distinguish wrong password from unknown/inactive account.

**Phone + OTP**

1. `POST /auth/phone/request-otp` `{ phone }` → `200`; show the code entry screen.
   Handle `429` by disabling resend for the 60s cooldown.
2. `POST /auth/phone/verify-otp` `{ phone, otp }`:
   - `requiresUserSelection: false` → logged in, cookie set, `user` returned.
   - `requiresUserSelection: true` → render `users[]` as an account picker and keep
     `selectionToken` in memory only (never persist it).
3. `POST /auth/phone/select-user` `{ selectionToken, userId }` → logged in.

**Session bootstrap and logout**

- On app start (and after a page reload) call `GET /auth/me`. `200` means the
  session is valid — use the returned `user` to hydrate app state. `401` means
  "not logged in": route to the login screen. This is the only reliable way to
  know whether the cookie is still good, because the frontend cannot inspect it.
- `POST /auth/logout` clears the cookie and always succeeds; then drop client
  state and redirect to login.
- Sessions last 1 hour and are re-validated against the database on every request.
  Deactivating an employee invalidates their live session immediately, so a `401`
  can appear mid-session — treat it as "session ended", not as a bug.

### 401 vs 403

| Status | Meaning | Frontend behaviour |
|--------|---------|--------------------|
| `401` | Not authenticated: no cookie, expired token, or the account/employee was deactivated | Clear client auth state and redirect to login. A global interceptor is the right place for this |
| `403` | Authenticated, but this user lacks the required permission | Do **not** log out and do **not** retry. Show "you do not have access" (or better: never render the action — see below) |

### Error handling

Every failure uses the same envelope:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "email": ["Invalid email address"] },
  "formErrors": []
}
```

- `message` is always present and safe to display.
- `errors` (only on `400`) maps field name → messages; bind these straight onto
  form fields. Keys match the request body/query/param names.
- `formErrors` (only on `400`) holds messages that belong to the request as a
  whole rather than to one field; render them above the form. Usually empty.
- `409` carries a specific, displayable `message` (e.g. `Employee ID already
  exists`) — surface it instead of a generic error.
- `500` always returns exactly `Internal server error`; internal details are
  logged server-side and never sent to the client.

### Pagination

`GET /employees` is paginated; `GET /farms` and `GET /sheds` return simple lists.
See [List response standard](#list-response-standard) for the rule and how to tell
them apart (`pagination` present or absent).

```json
{
  "success": true,
  "employees": [],
  "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

Send `page` and `limit` (max `100`) as query params; `total` and `totalPages`
drive the pager.

### Enum values currently exposed

| Field | Values | Notes |
|-------|--------|-------|
| `employee.status` | `ACTIVE`, `INACTIVE` | Changed only via the deactivate/reactivate endpoints |
| `farm.status` | `ACTIVE`, `INACTIVE` | Changed only via the deactivate/reactivate endpoints |
| `shed.status` | `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `INACTIVE` | `OCCUPIED` can be **read** but not set; the status endpoint accepts the other three |
| `user.roles[]` | `DGM`, `Assistant Manager`, `Super Incharge`, `Incharge`, `Supervisor`, `Accountant` | Display labels only |

Permission names follow `resource:action`. The full set currently seeded:

```
approval:approve  approval:reject   approval:view
attendance:create attendance:update attendance:view
batch:create      batch:update      batch:view
employee:create   employee:deactivate employee:reactivate
employee:update   employee:view
farm:create       farm:deactivate   farm:reactivate
farm:update       farm:view
production:create production:update production:view
report:export     report:view
shed:create       shed:update       shed:update-status
shed:view         user:create
```

`attendance:*`, `batch:*`, `production:*`, `approval:*` and `report:*` are seeded
so roles are ready, but **no endpoints implement them yet** — do not build screens
against them.

### Response examples

`GET /auth/me` (identical `user` shape from `/auth/login`,
`/auth/phone/verify-otp`, `/auth/phone/select-user` and `POST /employees/:id/user`):

```json
{
  "success": true,
  "user": {
    "id": "60929b46-4d94-4f5a-8d23-c59e9d000636",
    "employeeId": "EMP001",
    "email": "dgm@example.com",
    "employee": {
      "name": "System DGM",
      "designation": { "id": "5e068a7c-...", "name": "DGM" }
    },
    "roles": ["DGM"],
    "permissions": ["employee:view", "farm:view", "user:create"]
  }
}
```

`user.employeeId` is the **business** employee code (`EMP001`), not a UUID.
`user.id` is the user UUID. Employee endpoints address employees by their own
`id` (UUID), so `employee.id` from a list is what belongs in a URL path.

`GET /employees/:id`:

```json
{
  "success": true,
  "employee": {
    "id": "49095465-3aa9-4e3e-b10d-52e356c2c1a2",
    "employeeId": "EMP001",
    "name": "System DGM",
    "phone": "919876543210",
    "photoUrl": null,
    "joiningDate": null,
    "status": "ACTIVE",
    "designation": { "id": "5e068a7c-...", "name": "DGM" },
    "hasUser": true
  }
}
```

`GET /farms` / `GET /sheds`:

```json
{
  "success": true,
  "farms": [
    {
      "id": "bb3876da-...",
      "code": "SR-1",
      "name": "SR-1 Farm",
      "status": "ACTIVE",
      "company": { "id": "225c8591-...", "name": "Poultry Management Company", "code": "PMS" }
    }
  ]
}
```

```json
{
  "success": true,
  "sheds": [
    {
      "id": "f8229560-...",
      "number": "Shed-1",
      "capacity": 0,
      "status": "AVAILABLE",
      "farm": { "id": "bb3876da-...", "code": "SR-1", "name": "SR-1 Farm" }
    }
  ]
}
```

Relations are always returned as small nested objects with the fields a UI
actually renders. Prisma internals, join rows and the misspelled database column
`desiginationId` are never exposed — the API only ever uses `designation` /
`designationId`.

### Permission-based UI

**The backend is authoritative.** Every protected route re-resolves the user's
permissions from the database and returns `403` when they are missing, regardless
of what the frontend believes or sends. Roles and permissions in a request body,
query string or token are ignored.

The frontend may use `user.permissions` from `/auth/me` to hide or disable UI —
that is a usability decision (don't show a button that will fail), never a
security boundary.

```ts
const can = (permission: string) => user.permissions.includes(permission);

{can("farm:create") && <Button onClick={createFarm}>Add farm</Button>}
```

**Do not branch on role names.** `roles` is for display (badges, greetings).
Gating on `user.roles.includes("DGM")` duplicates the permission matrix in the
client and silently breaks the moment a role's permissions change in the seed —
whereas checking `farm:deactivate` keeps working. If a screen needs a permission
that no endpoint enforces yet, that screen is not ready to build.

`/auth/me` is the source of both `roles` and `permissions`; refresh it after any
change that could alter them (e.g. a role reassignment) rather than caching them
across sessions. Should richer authorization data (per-farm scope, for example) be
needed later, it will be added to `/auth/me` or a dedicated endpoint — not to the
token.

## Data model

Core entities and relationships (see [`prisma/schema.prisma`](prisma/schema.prisma)):

- **Company** 1─* **Farm** 1─* **Shed**
- **Designation** 1─* **Employee** 1─1 **User** (`User.employeeId` is unique)
- **User** *─* **Role** via **UserRole** (composite PK `[userId, roleId]`)
- **Role** *─* **Permission** via **RolePermission** (composite PK `[roleId, permissionId]`)
- **OtpChallenge** — standalone table for phone-login OTPs

### Constraints

- Unique: `Company.code`, `Farm(companyId, code)`, `Shed(farmId, number)`,
  `Designation.name`, `Employee.employeeId`, `User.employeeId`, `User.email`,
  `Role.name`, `Permission.name`.
- `Employee.phone` is intentionally **not** unique — several employees may share a
  number, which is what drives phone account selection at login.
- Foreign keys use `RESTRICT` on core entities (cannot delete a company with
  farms, a designation in use, or an employee with a user) and `CASCADE` on the
  join tables (`UserRole`, `RolePermission`).

### Indexing strategy

Indexes are deliberately minimal — one per genuine access path, avoiding
low-value or redundant entries:

- `Employee(desiginationId)` — foreign key (Postgres does not auto-index FKs);
  also backs the `designationId` list filter.
- `Employee(phone)` — backs the phone-login lookup on a growing table.
- `OtpChallenge(phone, createdAt)` — the active-challenge lookup filters `phone`
  and orders by `createdAt DESC`; the composite serves both, so a plain `phone`
  index would be redundant.
- Unique constraints already provide indexes for email, `employeeId`, and the
  composite keys, so `Farm(companyId)` and `Shed(farmId)` FK lookups are covered
  by the leftmost prefix of their unique composites.
- Low-cardinality `status` fields and the case-insensitive name search are
  intentionally **not** indexed (small tables; leading-wildcard `ILIKE` cannot
  use a b-tree).

### Known naming issues

- The `Designation` model maps to the misspelled table `desgination`, and
  `Employee.desiginationId` is likewise misspelled. These names are baked into
  existing migrations. Renaming would require a data-preserving table/column
  migration plus code changes for a purely cosmetic gain, so the misspellings are
  **left intact by design**. Application code and Prisma field names use these
  exact spellings.
- `Permission` has `createdAt` but no `updatedAt` (all other models have both).
  Permissions are immutable seeded reference data with no update path, so this is
  left as-is.

## Testing

Integration tests run the real Express app in-process with Supertest against the
**real local development database** — there is no mocking layer, so route
wiring, middleware, RBAC, Prisma queries, and response shapes are all exercised.

```bash
npm run seed   # required once: tests rely on seeded roles, designations, company
npm run test
```

- Runner config: [`vitest.config.ts`](vitest.config.ts). Files run serially
  (`fileParallelism: false`) because they share one database.
- Shared fixtures and helpers: [`tests/helpers.ts`](tests/helpers.ts).
- Test actors are real employees + users holding exactly one **seeded** role, so
  the tests assert the actual production permission matrix rather than a mock.
- Isolation: every fixture is created with the `TMP-TEST-` prefix (employee IDs,
  farm codes, shed numbers) or an `@example.test` email. `cleanupTestData()` runs
  in both `beforeAll` and `afterAll` and deletes only those rows, in an order that
  respects the `RESTRICT` foreign keys. Seeded data is never modified or deleted.
- No SMS: the OTP send path is never invoked by the suite, so no real message is
  ever sent. Login fixtures use email + password.

Current coverage:

| File | Focus |
|------|-------|
| [`tests/auth.test.ts`](tests/auth.test.ts) | health check, missing/invalid cookie → `401`, session revoked when the employee becomes `INACTIVE` and restored on reactivate, generic login failure message, missing permission → `403`, forged `roles`/`permissions` in the body still → `403`, no sensitive-field leakage |
| [`tests/employee.test.ts`](tests/employee.test.ts) | create/update, duplicate `employeeId` → `409`, unknown designation → `404`, invalid UUID → `400`, `status` ignored by generic update, Accountant lifecycle allowed, Supervisor lifecycle denied, Accountant create denied, user provisioning + duplicate email/second account/inactive employee → `409` |
| [`tests/farm.test.ts`](tests/farm.test.ts) | Assistant Manager create/update, Supervisor create denied, unknown company → `404`, duplicate code → `409`, `status`/`companyId` ignored by generic update, DGM-only deactivate/reactivate incl. repeat → `409` |
| [`tests/shed.test.ts`](tests/shed.test.ts) | create under an active farm, unknown farm → `404`, inactive farm → `409`, duplicate number → `409`, negative capacity → `400`, farm never changed by update, status transition + repeat → `409`, `OCCUPIED` rejected (`400` as input, `409` as current state), Supervisor status change denied |
| [`tests/contract.test.ts`](tests/contract.test.ts) | health envelope, unknown route → JSON `404`, validation error exposes both `errors` and `formErrors`, `/auth/me` returns resolved `permissions` + `designation` object with no leaked secrets or `desigination*` field names, login and `/auth/me` return an identical user, provisioning returns the same user shape |

## Implemented vs planned

**Implemented:** email/password login, phone+OTP login with multi-account
selection, cookie sessions with live revocation, RBAC, employee CRUD + lifecycle,
user provisioning, farm reads/writes/lifecycle, shed reads/writes/status
transitions, OTP retention cleanup, idempotent seed, automated integration tests.

**Planned (not yet implemented):** attendance, batch, production, approval, and
report features. Some of their permissions are already seeded
(`attendance:view|create|update`, `batch:view|create|update`,
`production:view|create|update`, `approval:*`, `report:*`) so roles are ready,
but **no endpoints exist** for them. These modules are blocked on schema work:
`schema.prisma` currently has no `Attendance`, `Batch`, or `Production` model, so
there is nothing to persist. Standalone user CRUD (beyond provisioning) is also
not implemented.

**Known limitations:**

- Attendance, batch, and production APIs do not exist (schema gap above).
- Shed occupancy (`OCCUPIED`) cannot be set through the API; it is reserved for
  the future batch lifecycle.
- OTP cleanup has no in-process scheduler — it must be triggered externally (see
  *OTP challenge retention*).
- Farm and shed list endpoints are unpaginated (small reference tables).
- CORS allows exactly one origin (`CLIENT_ORIGIN`); multiple frontend origins
  would need an allow-list.
- There is no CSRF token. State-changing requests are protected by
  `sameSite=lax` plus the CORS allow-list, which is adequate for a single
  same-site SPA; introducing a genuinely cross-site frontend would require both
  `sameSite=none` and a CSRF strategy.
- Data scope is not enforced per farm/shed: the schema has no assignment link
  between an employee and a farm or shed, so permissions are global rather than
  scoped.
- The test suite runs against the local development database rather than a
  dedicated throwaway test database.
