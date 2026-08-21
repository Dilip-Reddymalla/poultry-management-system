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
  Incharge, Incharge, Supervisor, Accountant).
- **Employee management** — create, read, update, deactivate/reactivate, plus
  paginated listing with filtering and search.
- **User provisioning** — issue a login account (with a role) for an employee.
- **Farm & shed reads** — read-only endpoints for farms and sheds.

Planned but not yet implemented: attendance, production, batch, approval, and
report features (their permissions are seeded so roles are ready, but no
endpoints exist yet), farm/shed writes, and full user CRUD.

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
   values (see `server/README.md` for the full variable reference):
   ```bash
   cd server && cp .env.example .env
   ```
4. **Apply migrations and seed** the database:
   ```bash
   npx prisma migrate dev
   npm run seed
   ```
5. **Run the dev servers** (in separate terminals):
   ```bash
   cd server && npm run dev
   cd client && npm run dev
   ```

The API listens on `http://localhost:5000` and the client dev server on
`http://localhost:5173`.

## Documentation

- Backend setup, environment variables, API endpoints, authentication,
  authorization, and the data model: [`server/README.md`](server/README.md)
- Frontend notes: [`client/README.md`](client/README.md)

## Notes

- Keep environment values in local `.env` files; never commit real secrets. The
  `.env.example` files contain placeholders only.
- The root `.env.example` supplies the Docker Compose Postgres credentials and a
  matching `DATABASE_URL`; the server reads its own `server/.env`.
