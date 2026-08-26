-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "shedId" UUID;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shedId_fkey" FOREIGN KEY ("shedId") REFERENCES "sheds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
