-- CreateTable
CREATE TABLE IF NOT EXISTS "system_admin_profiles" (
    "id" TEXT NOT NULL,
    "photo_url" TEXT,
    "face_embedding" DOUBLE PRECISION[],
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_admin_profiles_pkey" PRIMARY KEY ("id")
);

-- The application may run as a role that lacks CREATE on the `public` schema
-- (e.g. Neon). Grant access on this table so whichever role the app connects
-- with can read and write it, regardless of which role owns it.
GRANT ALL ON TABLE "system_admin_profiles" TO PUBLIC;
