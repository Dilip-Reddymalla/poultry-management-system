-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add face_embedding column to employees table
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "face_embedding" vector(512);

-- Add photo_url and face_embedding columns to workers table
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "face_embedding" vector(512);

-- Add face-AI verification fields to attendances table
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "verification_mode" VARCHAR(20) DEFAULT 'MANUAL';
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "liveness_score" DOUBLE PRECISION;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "quality_score" DOUBLE PRECISION;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "snapshot_url" TEXT;

-- HNSW indexes for fast vector cosine similarity search
CREATE INDEX IF NOT EXISTS "employee_face_embedding_idx"
ON "employees" USING hnsw ("face_embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "worker_face_embedding_idx"
ON "workers" USING hnsw ("face_embedding" vector_cosine_ops);
