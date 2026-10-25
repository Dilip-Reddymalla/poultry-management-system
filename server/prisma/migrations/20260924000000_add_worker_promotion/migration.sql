-- AlterEnum
ALTER TYPE "WorkerStatus" ADD VALUE IF NOT EXISTS 'PROMOTED';

-- AlterTable
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "promotedToEmployeeId" UUID;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "promotedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workers_promotedToEmployeeId_key" ON "workers"("promotedToEmployeeId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workers_promotedToEmployeeId_fkey'
    ) THEN
        ALTER TABLE "workers" 
        ADD CONSTRAINT "workers_promotedToEmployeeId_fkey" 
        FOREIGN KEY ("promotedToEmployeeId") REFERENCES "employees"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
