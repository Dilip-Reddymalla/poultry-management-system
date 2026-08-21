-- DropIndex
DROP INDEX "otp_challenges_phone_idx";

-- CreateIndex
CREATE INDEX "employees_desiginationId_idx" ON "employees"("desiginationId");

-- CreateIndex
CREATE INDEX "employees_phone_idx" ON "employees"("phone");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_createdAt_idx" ON "otp_challenges"("phone", "createdAt");
