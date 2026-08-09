# Server API

This package contains the backend API for the poultry management system.

## Tech stack

- Node.js + TypeScript
- Express
- Prisma ORM
- PostgreSQL

## Scripts

- `npm run dev` - start the API in watch mode
- `npm run build` - compile TypeScript to the dist folder
- `npm run start` - run the built server
- `npm run typecheck` - verify types without emitting files

## Development setup

1. Install dependencies with `npm install`.
2. Create a local `.env` file using the example values from the project root.
3. Start PostgreSQL with Docker Compose.
4. Run `npx prisma migrate dev` to apply schema changes.
5. Start the API with `npm run dev`.

## Notes

- Prisma schema changes should be made in `prisma/schema.prisma`.
- Keep local environment values in `.env` and do not commit secrets.
