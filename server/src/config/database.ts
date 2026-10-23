import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "./env.js";

// Determine active connection string:
// If USE_PRODUCTION_DB is enabled or NODE_ENV === "production" and a production URI is provided, use that;
// otherwise use DATABASE_URL.
let connectionString = env.DATABASE_URL;
const productionUri = env.PRODUCTION_DATABASE_URI || env.production_database_uri;

if ((env.USE_PRODUCTION_DB || env.NODE_ENV === "production") && productionUri) {
  connectionString = productionUri;
}

// Clean up any legacy or malformed SSL parameters if present
if (connectionString.includes("sslmode=no-verify")) {
  connectionString = connectionString.replace("sslmode=no-verify", "sslmode=require");
}

const isLocalhost =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("sslmode=disable");

// Configure SSL properly for Neon / Cloud Postgres:
// For local databases: SSL is disabled (false).
// For Neon / Cloud Postgres: SSL certificate verification against trusted root CAs is enforced by default
// (rejectUnauthorized: true) for secure transport encryption.
const sslConfig = isLocalhost
  ? false
  : {
      rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== false,
    };

const pool = new Pool({
  connectionString,
  max: 20,
  // For serverless databases like Neon, min: 0 prevents stale sockets when compute scales to zero.
  // pg-pool will open connections on demand without clogging during cold starts.
  min: 0,
  // Keep connections idle for up to 1 minute, avoiding Neon proxy / PgBouncer 5-minute disconnect errors.
  idleTimeoutMillis: 60000,
  // 60-second timeout accommodates Neon serverless cold-start wake-up times and connection spikes
  connectionTimeoutMillis: 60000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: sslConfig,
});

pool.on("error", (err) => {
  // Prevent unhandled error crashes when idle connections are pruned by cloud firewalls or serverless proxies
  console.error("[PG Pool] Client connection error / idle socket pruned:", err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});