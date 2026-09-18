/**
 * In-Memory Demo Embedding Store
 *
 * Stores face vector embeddings temporarily for interactive demo testing.
 * - Stored strictly in memory with a 10-minute Time-To-Live (TTL).
 * - NEVER saved to PostgreSQL, pgvector, or Cloudinary.
 * - Raw embeddings are NEVER transmitted back to the browser.
 * - Auto-purged every 60 seconds.
 */

export interface DemoEmbeddingEntry {
  id: string;
  label: string;
  embedding: number[];
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

class DemoEmbeddingStore {
  private sessions = new Map<string, DemoEmbeddingEntry[]>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  private startCleanupTimer() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.purgeExpired();
    }, CLEANUP_INTERVAL_MS);
    // Don't prevent Node process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Save an embedding under a specific session ID (e.g. anonymous visitor IP or user ID).
   */
  public saveEmbedding(
    sessionId: string,
    label: string,
    embedding: number[]
  ): { id: string; label: string; expiresAt: number } {
    const now = Date.now();
    const entry: DemoEmbeddingEntry = {
      id: `demo_${Math.random().toString(36).substring(2, 9)}`,
      label: label.trim().substring(0, 40) || `Test Subject #${Date.now().toString().slice(-4)}`,
      embedding,
      createdAt: now,
      expiresAt: now + TTL_MS,
    };

    const current = this.sessions.get(sessionId) || [];
    // Keep max 10 demo faces per session to prevent memory bloat
    const updated = [...current.filter((e) => e.expiresAt > now), entry].slice(-10);
    this.sessions.set(sessionId, updated);

    return {
      id: entry.id,
      label: entry.label,
      expiresAt: entry.expiresAt,
    };
  }

  /**
   * Return metadata (no vectors) for active enrolled demo faces in this session.
   */
  public listSessionFaces(sessionId: string): Array<{ id: string; label: string; expiresAt: number }> {
    const now = Date.now();
    const entries = this.sessions.get(sessionId) || [];
    return entries
      .filter((e) => e.expiresAt > now)
      .map((e) => ({
        id: e.id,
        label: e.label,
        expiresAt: e.expiresAt,
      }));
  }

  /**
   * Search for closest matches among this session's enrolled demo embeddings.
   * Computes cosine similarity between targetEmbedding and enrolled vectors.
   */
  public findMatches(
    sessionId: string,
    targetEmbedding: number[],
    threshold = 0.45
  ): Array<{ id: string; label: string; similarity: number }> {
    const now = Date.now();
    const entries = (this.sessions.get(sessionId) || []).filter((e) => e.expiresAt > now);
    const matches: Array<{ id: string; label: string; similarity: number }> = [];

    for (const entry of entries) {
      const similarity = cosineSimilarity(targetEmbedding, entry.embedding);
      if (similarity >= threshold) {
        matches.push({
          id: entry.id,
          label: entry.label,
          similarity: Number(similarity.toFixed(4)),
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Clear all demo entries for a session
   */
  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Purge all expired entries across all sessions
   */
  public purgeExpired(): void {
    const now = Date.now();
    for (const [sessionId, entries] of this.sessions.entries()) {
      const active = entries.filter((e) => e.expiresAt > now);
      if (active.length === 0) {
        this.sessions.delete(sessionId);
      } else {
        this.sessions.set(sessionId, active);
      }
    }
  }

  public getStats(): { activeSessions: number; totalEmbeddings: number } {
    const now = Date.now();
    let total = 0;
    let activeSessions = 0;
    for (const entries of this.sessions.values()) {
      const activeCount = entries.filter((e) => e.expiresAt > now).length;
      if (activeCount > 0) {
        activeSessions++;
        total += activeCount;
      }
    }
    return { activeSessions, totalEmbeddings: total };
  }
}

/**
 * Calculate Cosine Similarity between two numeric vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const demoEmbeddingStore = new DemoEmbeddingStore();
