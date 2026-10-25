-- AlterTable farms
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "autoAbsentEnabled" BOOLEAN NOT NULL DEFAULT true;
