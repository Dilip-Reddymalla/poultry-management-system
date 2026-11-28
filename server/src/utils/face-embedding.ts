import { prisma } from "../config/database.js";

type FaceTable = "employees" | "workers";

/**
 * Store a 512-D face embedding on a row via raw SQL. Prisma cannot write
 * pgvector columns natively, so we try the `vector` type first and fall back to
 * `float8[]` on deployments without the pgvector extension.
 *
 * `table` is a closed union, not user input — safe to interpolate.
 */
export async function writeFaceEmbedding(
  table: FaceTable,
  id: string,
  embedding: number[],
): Promise<void> {
  try {
    const vectorLiteral = `[${embedding.join(",")}]`;
    await prisma.$queryRawUnsafe(
      `UPDATE ${table} SET face_embedding = $1::vector WHERE id = $2`,
      vectorLiteral,
      id,
    );
  } catch {
    await prisma.$queryRawUnsafe(
      `UPDATE ${table} SET face_embedding = $1::float8[] WHERE id = $2`,
      embedding,
      id,
    );
  }
}
