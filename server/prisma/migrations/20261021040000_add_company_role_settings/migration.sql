-- CreateTable company_role_settings
CREATE TABLE IF NOT EXISTS "company_role_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_role_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "company_role_settings" ADD COLUMN IF NOT EXISTS "customRank" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "company_role_settings_companyId_roleId_key" ON "company_role_settings"("companyId", "roleId");
CREATE INDEX IF NOT EXISTS "company_role_settings_companyId_idx" ON "company_role_settings"("companyId");
CREATE INDEX IF NOT EXISTS "company_role_settings_roleId_idx" ON "company_role_settings"("roleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_role_settings_companyId_fkey'
  ) THEN
    ALTER TABLE "company_role_settings" ADD CONSTRAINT "company_role_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_role_settings_roleId_fkey'
  ) THEN
    ALTER TABLE "company_role_settings" ADD CONSTRAINT "company_role_settings_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
