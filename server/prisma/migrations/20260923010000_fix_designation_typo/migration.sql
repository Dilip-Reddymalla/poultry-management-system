-- Rename table desgination to designations
ALTER TABLE IF EXISTS "desgination" RENAME TO "designations";

-- Rename foreign key column desiginationId to designationId in employees table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'desiginationId'
    ) THEN
        ALTER TABLE "employees" RENAME COLUMN "desiginationId" TO "designationId";
    END IF;
END $$;

-- Rename index
ALTER INDEX IF EXISTS "employees_desiginationId_idx" RENAME TO "employees_designationId_idx";
