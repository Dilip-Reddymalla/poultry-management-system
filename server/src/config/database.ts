import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "./env.js";

let connectionString = env.DATABASE_URL;
if (connectionString.includes("sslmode=require")) {
  connectionString = connectionString.replace("sslmode=require", "sslmode=verify-full");
} else if (connectionString.includes("sslmode=prefer")) {
  connectionString = connectionString.replace("sslmode=prefer", "sslmode=verify-full");
} else if (connectionString.includes("sslmode=verify-ca")) {
  connectionString = connectionString.replace("sslmode=verify-ca", "sslmode=verify-full");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});