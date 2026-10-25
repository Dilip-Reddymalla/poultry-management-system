-- AlterTable roles
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "companyId" UUID;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "farmId" UUID;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "rank" INTEGER NOT NULL DEFAULT 30;

-- Drop global unique constraint on role name if present, and create compound index
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_name_key";
DROP INDEX IF EXISTS "roles_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_companyId_farmId_key" ON "roles"("name", "companyId", "farmId");
CREATE INDEX IF NOT EXISTS "roles_companyId_idx" ON "roles"("companyId");
CREATE INDEX IF NOT EXISTS "roles_farmId_idx" ON "roles"("farmId");

-- Foreign key constraints for roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_companyId_fkey'
  ) THEN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_farmId_fkey'
  ) THEN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Mark pre-existing system roles
UPDATE "roles" SET "isSystem" = true WHERE "companyId" IS NULL AND "farmId" IS NULL;

-- CreateTable farm_role_settings
CREATE TABLE IF NOT EXISTS "farm_role_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farmId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_role_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "farm_role_settings_farmId_roleId_key" ON "farm_role_settings"("farmId", "roleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farm_role_settings_farmId_fkey'
  ) THEN
    ALTER TABLE "farm_role_settings" ADD CONSTRAINT "farm_role_settings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farm_role_settings_roleId_fkey'
  ) THEN
    ALTER TABLE "farm_role_settings" ADD CONSTRAINT "farm_role_settings_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable shift_timings
CREATE TABLE IF NOT EXISTS "shift_timings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID,
    "farmId" UUID,
    "shift" "Shift" NOT NULL,
    "label" TEXT NOT NULL,
    "startHour" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_timings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shift_timings_farmId_shift_key" ON "shift_timings"("farmId", "shift");
CREATE INDEX IF NOT EXISTS "shift_timings_companyId_idx" ON "shift_timings"("companyId");
CREATE INDEX IF NOT EXISTS "shift_timings_farmId_idx" ON "shift_timings"("farmId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_timings_companyId_fkey'
  ) THEN
    ALTER TABLE "shift_timings" ADD CONSTRAINT "shift_timings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_timings_farmId_fkey'
  ) THEN
    ALTER TABLE "shift_timings" ADD CONSTRAINT "shift_timings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
