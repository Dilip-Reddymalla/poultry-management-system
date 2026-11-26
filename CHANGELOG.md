# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- **Offline-first PWA**
  - IndexedDB offline queue for attendance (single, bulk, and face) with automatic replay on reconnect.
  - Read caching of successful GET responses so previously-viewed data renders without a connection.
  - Server-side `/api/v1/sync/attendance` endpoint that systematically ingests offline updates from multiple devices.
  - Idempotency via a client-generated `syncRef` per record to prevent duplicate retries across devices.
- **Security hardening**
  - `securityHeaders` middleware: HSTS, Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
  - Guard against accidentally using the production (Neon) database during local development (`ALLOW_PRODUCTION_DB` escape hatch).
  - Optional Sentry error reporting (server + client), DSN-gated.
- **Audit compliance**
  - Audit log export now supports CSV in addition to Excel (`.xlsx`).
- **CI**
  - GitHub Actions workflow: client/server typecheck, lint, server integration tests (Postgres + pgvector), Face AI pytest, dependency audits.

### Fixed
- Public analytics reported hardcoded-zero workforce counts; now computed from real employee/worker data. Removed fabricated latency/compliance numbers.
- Deprecated Pydantic `Field(example=…)` usage → `json_schema_extra` (and fixed a missing class closing brace).
- `AuditLogsPage` declaration-ordering bug (`setSearchInput` used before declaration).
- Dead assignment in `FaceAiDemoPage` (`blobToAnalyze`).
- Flaky Face-AI health test now asserts the stable contract rather than exact transient counters.
- React Hooks violations: unconditional hook calls (`?? useHook()` pattern) and an early-return-before-hooks in attendance pages.

### Refactored
- Split the client `api/resources.ts` monolith into cohesive per-domain API modules (companies, farms, sheds, employees, workers, attendance, audit, analytics, reference, face-ai) with a thin re-export barrel.
- Extracted unhandled-error coordination from the Express error middleware into `services/unhandled-error.service.ts`.
- Upgraded dependencies (Prisma 7.10.1, zod, uuid override) and aligned `allowScripts`.
