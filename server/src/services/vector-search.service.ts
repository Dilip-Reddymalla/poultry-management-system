import { prisma } from "../config/database.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CandidateMatch {
  id: string;
  /** "EMPLOYEE" or "WORKER" */
  personType: "EMPLOYEE" | "WORKER";
  /** employeeId or workerId display code */
  personCode: string;
  name: string;
  photoUrl: string | null;
  farmId: string;
  /** Cosine similarity score (0–1). */
  similarity: number;
}

// Default similarity threshold — a candidate must score at or above this.
const DEFAULT_THRESHOLD = 0.40;

// Default maximum number of candidates to return per face.
const DEFAULT_LIMIT = 5;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search both `employees` and `workers` tables for faces similar to the given
 * 512-D embedding using pgvector (or JS fallback if pgvector extension is absent).
 */
export async function searchByEmbedding(
  embedding: number[],
  options: {
    threshold?: number;
    limit?: number;
    farmId?: string;
  } = {},
): Promise<CandidateMatch[]> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const limit = options.limit ?? DEFAULT_LIMIT;

  // Check if pgvector extension is available in Postgres
  let hasPgVector = false;
  try {
    const ext = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
    );
    hasPgVector = ext.length > 0;
  } catch {
    hasPgVector = false;
  }

  if (hasPgVector) {
    const vectorLiteral = `[${embedding.join(",")}]`;

    const employeeQuery = `
      SELECT
        e.id,
        'EMPLOYEE' AS "personType",
        e."employeeId" AS "personCode",
        e.name,
        e."photoUrl" AS "photoUrl",
        e."farmId" AS "farmId",
        1 - (e.face_embedding <=> $1::vector) AS similarity
      FROM employees e
      WHERE e.face_embedding IS NOT NULL
        AND e.status = 'ACTIVE'
        AND 1 - (e.face_embedding <=> $1::vector) >= $2
        ${options.farmId ? `AND e."farmId" = $4` : ""}
      ORDER BY similarity DESC
      LIMIT $3
    `;

    const workerQuery = `
      SELECT
        w.id,
        'WORKER' AS "personType",
        w."workerId" AS "personCode",
        w.name,
        w.photo_url AS "photoUrl",
        w."farmId" AS "farmId",
        1 - (w.face_embedding <=> $1::vector) AS similarity
      FROM workers w
      WHERE w.face_embedding IS NOT NULL
        AND w.status = 'ACTIVE'
        AND 1 - (w.face_embedding <=> $1::vector) >= $2
        ${options.farmId ? `AND w."farmId" = $4` : ""}
      ORDER BY similarity DESC
      LIMIT $3
    `;

    const params: unknown[] = options.farmId
      ? [vectorLiteral, threshold, limit, options.farmId]
      : [vectorLiteral, threshold, limit];

    const [employeeResults, workerResults] = await Promise.all([
      prisma.$queryRawUnsafe<CandidateMatch[]>(employeeQuery, ...params),
      prisma.$queryRawUnsafe<CandidateMatch[]>(workerQuery, ...params),
    ]);

    return [...employeeResults, ...workerResults]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // Fallback for local Postgres containers without pgvector extension
  const employeeRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, 'EMPLOYEE' AS "personType", "employeeId" AS "personCode", name, "photoUrl", "farmId", face_embedding FROM employees WHERE face_embedding IS NOT NULL AND status = 'ACTIVE' ${
      options.farmId ? `AND "farmId" = '${options.farmId}'` : ""
    }`,
  );

  const workerRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, 'WORKER' AS "personType", "workerId" AS "personCode", name, photo_url AS "photoUrl", "farmId", face_embedding FROM workers WHERE face_embedding IS NOT NULL AND status = 'ACTIVE' ${
      options.farmId ? `AND "farmId" = '${options.farmId}'` : ""
    }`,
  );

  const candidates: CandidateMatch[] = [];

  for (const row of [...employeeRows, ...workerRows]) {
    if (!row.face_embedding) continue;
    const dbVector: number[] = Array.isArray(row.face_embedding)
      ? row.face_embedding
      : JSON.parse(row.face_embedding);
    const sim = cosineSimilarity(embedding, dbVector);
    if (sim >= threshold) {
      candidates.push({
        id: row.id,
        personType: row.personType,
        personCode: row.personCode,
        name: row.name,
        photoUrl: row.photoUrl,
        farmId: row.farmId,
        similarity: sim,
      });
    }
  }

  return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}
