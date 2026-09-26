import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "./env.js";

let connectionString = env.DATABASE_URL;
// Remove any restrictive verify-full parameter that causes slow certificate negotiation on cloud providers
if (connectionString.includes("sslmode=verify-full")) {
  connectionString = connectionString.replace("sslmode=verify-full", "sslmode=no-verify");
}

const isSslDisabled = connectionString.includes("sslmode=disable") || connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: isSslDisabled ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  // Prevent unhandled error crashes when idle connections are pruned by cloud firewalls
  console.error("[PG Pool] Idle client connection pruned:", err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});