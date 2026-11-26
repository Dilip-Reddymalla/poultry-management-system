-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "syncRef" VARCHAR(128);

-- CreateIndex
CREATE INDEX "attendances_syncRef_idx" ON "attendances"("syncRef");
