# Server API

Backend API for the Poultry Management System. It exposes a JSON HTTP API for
authentication, authorization, employee management, user provisioning, and
read-only access to farms and sheds.

## Tech stack

- Node.js + TypeScript (ESM, `NodeNext` module resolution)
- Express 5
- Prisma ORM 7 with the `@prisma/adapter-pg` driver adapter (`pg` connection pool)
- PostgreSQL 17
- Zod for request validation
- argon2 for password and OTP hashing
- JSON Web Tokens delivered via an HTTP-only cookie

## Folder structure

```
server/
├─ prisma/
│  ├─ schema.prisma        # data model + indexes
│  ├─ migrations/          # SQL migration history
│  └─ seed.ts              # idempotent seed (company, farm, sheds, roles, permissions, DGM)
├─ prisma.config.ts        # Prisma 7 config: datasource URL + seed command
└─ src/
   ├─ app.ts               # Express app, middleware, route mounting
   ├─ server.ts            # HTTP bootstrap
   ├─ config/              # env parsing, Prisma client
   ├─ middlewares/         # requireAuth, requirePermission/requireRole, error handler
   ├─ utils/               # jwt, password, otp, phone, httpsms, app-error
   └─ modules/
      ├─ auth/             # login, /me, logout, OTP phone login
      ├─ employee/         # employee CRUD + lifecycle + user provisioning
      ├─ farm/             # farm reads
      └─ shed/             # shed reads
```

## Scripts

- `npm run dev` — start the API in watch mode (`tsx watch src/server.ts`)
- `npm run build` — compile TypeScript to `dist/`
- `npm run start` — run the compiled server (`node dist/server.js`)
- `npm run seed` — run the idempotent database seed (`prisma db seed`)
- `npm run typecheck` — type-check without emitting

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
protected request.

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

- `GET /api/auth/me` (requires auth) — returns the current safe user.
- `POST /api/auth/logout` — clears the cookie.

Session validity is re-checked from the database on every authenticated request:
if the user is missing/inactive or the linked employee is `INACTIVE`, the request
is rejected with `401` even when the JWT is still cryptographically valid.
`passwordHash`, `otpHash`, and the phone `selectionToken` are never returned in
any response.

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
| DGM | all (22) | Full authority; automatically granted every permission |
| Assistant Manager | 20 | Broad operational management |
| Super Incharge | 14 | Broad farm operations |
| Incharge | 12 | Operational supervision |
| Supervisor | 7 | Assigned shed / operational entry |
| Accountant | 9 | Administrative + financial views; retains employee deactivate/reactivate |

The exact matrix lives in [`prisma/seed.ts`](prisma/seed.ts). DGM is assigned
every permission programmatically so it stays full-authority as new permissions
are added. Approvals (`approval:approve` / `approval:reject`) are DGM-only.

## Modules & endpoints

All `/api/employees`, `/api/farms`, and `/api/sheds` routes require
authentication plus the noted permission. `GET /api/health` is public.

### Employees (`/api/employees`)

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/` | `employee:view` | Paginated list (`page`, `limit`≤100, `status`, `designationId`, `search` by name) |
| GET | `/:id` | `employee:view` | Single employee |
| POST | `/` | `employee:create` | Create employee |
| PATCH | `/:id` | `employee:update` | Update mutable fields |
| PATCH | `/:id/deactivate` | `employee:deactivate` | Set status `INACTIVE` |
| PATCH | `/:id/reactivate` | `employee:reactivate` | Set status `ACTIVE` |
| POST | `/:id/user` | `user:create` | Provision a login for the employee |

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

### Farms (`/api/farms`) — read only

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/` | `farm:view` | List farms (optional `status` filter), includes company |
| GET | `/:id` | `farm:view` | Single farm |

### Sheds (`/api/sheds`) — read only

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/` | `shed:view` | List sheds (optional `farmId`, `status` filters), includes farm |
| GET | `/:id` | `shed:view` | Single shed |

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

## Implemented vs planned

**Implemented:** email/password login, phone+OTP login with multi-account
selection, cookie sessions with live revocation, RBAC, employee CRUD + lifecycle,
user provisioning, farm/shed reads, idempotent seed.

**Planned (not yet implemented):** attendance, production, batch, approval, and
report features. Their permissions are seeded so roles are ready, but no
endpoints exist yet. Farm/shed **writes** and full standalone user CRUD are not
implemented.

**Known limitations:** OTP challenges are never pruned; there is no automated
test suite yet; farm/shed list endpoints are unpaginated (small reference tables).
