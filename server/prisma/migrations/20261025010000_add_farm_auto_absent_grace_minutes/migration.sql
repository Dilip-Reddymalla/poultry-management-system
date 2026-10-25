-- AlterTable farms
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "autoAbsentGraceMinutes" INTEGER NOT NULL DEFAULT 5;
