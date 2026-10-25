-- AlterTable: add website column to companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "website" TEXT;

-- Update existing role ranks to establish true hierarchy
UPDATE "roles" SET "rank" = 90 WHERE "name" = 'Company Admin';
UPDATE "roles" SET "rank" = 80 WHERE "name" = 'DGM';
UPDATE "roles" SET "rank" = 70 WHERE "name" = 'Assistant Manager';
UPDATE "roles" SET "rank" = 65 WHERE "name" = 'Super Incharge';
UPDATE "roles" SET "rank" = 60 WHERE "name" = 'Incharge';
UPDATE "roles" SET "rank" = 55 WHERE "name" = 'Asst Incharge';
UPDATE "roles" SET "rank" = 50 WHERE "name" = 'Accountant';
UPDATE "roles" SET "rank" = 45 WHERE "name" IN ('Accounts Assistant', 'Stores Executive');
UPDATE "roles" SET "rank" = 40 WHERE "name" = 'Senior Supervisor';
UPDATE "roles" SET "rank" = 35 WHERE "name" IN ('Supervisor', 'AC Supervisor', 'Maintenance Supervisor', 'Grading Supervisor', 'Supervisor - Litter Maintenance', 'Security Supervisor');
UPDATE "roles" SET "rank" = 30 WHERE "name" IN ('Asst Supervisor', 'AC Asst Supervisor', 'Asst Supervisor General', 'Asst Supervisor - Technical', 'Asst Supervisor - Electrical');
UPDATE "roles" SET "rank" = 20 WHERE "name" = 'Security Head Guard';
UPDATE "roles" SET "rank" = 18 WHERE "name" = 'Senior Driver';
UPDATE "roles" SET "rank" = 15 WHERE "name" IN ('Security Guard', 'Driver');

-- Insert CEO and GM designations if missing
INSERT INTO "designations" ("id", "name", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'CEO', NOW(), NOW()),
  (gen_random_uuid(), 'GM', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Insert CEO and GM system roles if missing
INSERT INTO "roles" ("id", "name", "description", "scopeLevel", "isSystem", "isActive", "rank", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'CEO', 'Chief Executive Officer with comprehensive company oversight', 'COMPANY', true, true, 95, NOW(), NOW()),
  (gen_random_uuid(), 'GM', 'General Manager overseeing farm operations and administration', 'COMPANY', true, true, 85, NOW(), NOW())
ON CONFLICT ("name", "companyId", "farmId") DO NOTHING;

-- Assign all Company Admin permissions to CEO and GM
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, rp."permissionId"
FROM "roles" r
JOIN "roles" ca ON ca.name = 'Company Admin' AND ca."isSystem" = true
JOIN "role_permissions" rp ON rp."roleId" = ca.id
WHERE r.name IN ('CEO', 'GM') AND r."isSystem" = true
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
