-- Normalize photo + embedding columns to the canonical names the application
-- reads and writes:
--     * "photoUrl"        TEXT
--     * "face_embedding"  vector(512)
--
-- Legacy duplicate columns created by earlier schema incarnations ("photo_url",
-- "faceEmbedding") exist on both employees and workers. Move any data over to
-- the canonical columns and drop the duplicates so there is a single source of
-- truth. This mirrors what the Prisma model and services use.

DO $$
BEGIN
  -- ---- employees ----
  ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
  UPDATE "employees"
     SET "photoUrl" = "photo_url"
   WHERE "photoUrl" IS NULL AND "photo_url" IS NOT NULL;
  ALTER TABLE "employees" DROP COLUMN IF EXISTS "photo_url";

  ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "face_embedding" vector(512);
  UPDATE "employees"
     SET "face_embedding" = "faceEmbedding"
   WHERE "face_embedding" IS NULL AND "faceEmbedding" IS NOT NULL;
  ALTER TABLE "employees" DROP COLUMN IF EXISTS "faceEmbedding";

  -- ---- workers ----
  ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
  UPDATE "workers"
     SET "photoUrl" = "photo_url"
   WHERE "photoUrl" IS NULL AND "photo_url" IS NOT NULL;
  ALTER TABLE "workers" DROP COLUMN IF EXISTS "photo_url";

  ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "face_embedding" vector(512);
  UPDATE "workers"
     SET "face_embedding" = "faceEmbedding"
   WHERE "face_embedding" IS NULL AND "faceEmbedding" IS NOT NULL;
  ALTER TABLE "workers" DROP COLUMN IF EXISTS "faceEmbedding";
END $$;
