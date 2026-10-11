import 'dotenv/config';
import { prisma } from '../config/database.js';

async function main() {
  console.log('Running migration for system_error_logs table...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "system_error_logs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "requestId" TEXT UNIQUE,
      "statusCode" INTEGER NOT NULL DEFAULT 500,
      "errorName" TEXT NOT NULL,
      "errorMessage" TEXT NOT NULL,
      "stackTrace" TEXT,
      "method" TEXT NOT NULL,
      "path" TEXT NOT NULL,
      "queryParams" JSONB,
      "requestBody" JSONB,
      "userId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
      "userName" TEXT,
      "userEmail" TEXT,
      "userRole" TEXT,
      "companyName" TEXT,
      "farmName" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "resolvedAt" TIMESTAMP(3),
      "resolvedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "system_error_logs_createdAt_idx" ON "system_error_logs"("createdAt");
    CREATE INDEX IF NOT EXISTS "system_error_logs_userId_idx" ON "system_error_logs"("userId");
    CREATE INDEX IF NOT EXISTS "system_error_logs_errorName_idx" ON "system_error_logs"("errorName");
  `);

  console.log('✅ system_error_logs table created successfully!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
