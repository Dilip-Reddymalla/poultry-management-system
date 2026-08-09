# Poultry Management System

A full-stack poultry farm management application with a React frontend and an Express + Prisma backend.

## Project structure

- client: Vite + React + TypeScript frontend
- server: Express + TypeScript API with Prisma and PostgreSQL
- docs: project documentation and notes

## Features

- Company, farm, and shed management
- Employee and user management
- Role and permission handling
- PostgreSQL-backed data storage through Prisma

## Getting started

1. Install dependencies for both apps:
   - `cd client && npm install`
   - `cd server && npm install`
2. Start PostgreSQL using Docker Compose:
   - `docker compose up -d`
3. Create a local environment file in the server folder based on `.env.example`.
4. Run Prisma migrations:
   - `cd server && npx prisma migrate dev`
5. Start the development servers:
   - `cd client && npm run dev`
   - `cd server && npm run dev`

## Notes

- The backend uses Prisma with PostgreSQL.
- Environment variables should be stored in local `.env` files and kept out of version control.
