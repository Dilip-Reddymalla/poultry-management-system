/*
  Warnings:

  - Added the required column `farmId` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScopeLevel" AS ENUM ('FARM', 'COMPANY', 'GLOBAL');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE');

-- AlterTable
-- farmId is required in the schema but the table already holds rows, so add it in
-- a data-safe sequence instead of a bare NOT NULL column: add nullable, backfill
-- every existing employee to the seeded SR-1 farm (falling back to the oldest farm
-- if SR-1 was renamed), then enforce NOT NULL. No rows are dropped; the DB is never
-- reset. If a stray employee exists with no farm at all, SET NOT NULL fails loudly
-- rather than silently corrupting scope.
ALTER TABLE "employees" ADD COLUMN     "farmId" UUID;

UPDATE "employees"
SET "farmId" = COALESCE(
  (SELECT "id" FROM "farms" WHERE "code" = 'SR-1' ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT "id" FROM "farms" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "farmId" IS NULL;

ALTER TABLE "employees" ALTER COLUMN "farmId" SET NOT NULL;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "scopeLevel" "ScopeLevel" NOT NULL DEFAULT 'FARM';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustSetPassword" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "workers" (
    "id" UUID NOT NULL,
    "workerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "farmId" UUID NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "farmId" UUID NOT NULL,
    "employeeId" UUID,
    "workerId" UUID,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "notes" TEXT,
    "recordedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workers_workerId_key" ON "workers"("workerId");

-- CreateIndex
CREATE INDEX "workers_farmId_idx" ON "workers"("farmId");

-- CreateIndex
CREATE INDEX "attendances_farmId_date_idx" ON "attendances"("farmId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_date_employeeId_key" ON "attendances"("date", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_date_workerId_key" ON "attendances"("date", "workerId");

-- CreateIndex
CREATE INDEX "employees_farmId_idx" ON "employees"("farmId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
