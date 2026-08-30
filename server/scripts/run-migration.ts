import { prisma } from "../src/config/database.js";

async function main() {
  console.log("Applying database column migrations...");

  // 1. photoUrl / photo_url on workers
  await prisma.$executeRawUnsafe(`ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;`);
  console.log("✓ Added workers.photoUrl and workers.photo_url columns.");

  // 2. photoUrl / photo_url on employees
  await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;`);
  console.log("✓ Added employees.photoUrl and employees.photo_url columns.");

  // 3. face-AI attendance fields
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "verification_mode" VARCHAR(20) DEFAULT 'MANUAL';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "verificationMode" VARCHAR(20) DEFAULT 'MANUAL';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "liveness_score" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "livenessScore" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "quality_score" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "qualityScore" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "snapshot_url" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "snapshotUrl" TEXT;`);
  console.log("✓ Added attendances face-AI verification columns.");

  // 4. Try creating pgvector extension
  let hasVector = false;
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    hasVector = true;
    console.log("✓ pgvector extension enabled.");
  } catch (err: any) {
    console.log("Notice: pgvector extension not available in local Postgres container (" + err.message + "). Falling back to float8[] vector columns.");
  }

  // 5. Add face_embedding / faceEmbedding column as vector(512) or float8[]
  const vectorType = hasVector ? "vector(512)" : "DOUBLE PRECISION[]";

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "face_embedding" ${vectorType};`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "faceEmbedding" ${vectorType};`);
    console.log(`✓ Added workers.face_embedding column as ${vectorType}.`);
  } catch (err: any) {
    console.log("workers.face_embedding note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "face_embedding" ${vectorType};`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "faceEmbedding" ${vectorType};`);
    console.log(`✓ Added employees.face_embedding column as ${vectorType}.`);
  } catch (err: any) {
    console.log("employees.face_embedding note:", err.message);
  }

  console.log("Migration finished successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
