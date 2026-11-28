-- Enforce a unique syncRef so concurrent offline replays cannot create duplicate
-- attendance rows. De-duplicate any existing rows first (keeping the earliest)
-- so the unique index can be created without failing on legacy data.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "syncRef" ORDER BY "createdAt", id) AS rn
  FROM "attendances"
  WHERE "syncRef" IS NOT NULL
)
DELETE FROM "attendances" a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "attendances_syncRef_key" ON "attendances"("syncRef");
