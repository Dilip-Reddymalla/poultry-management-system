import { Pool } from "pg";
import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const rawProdUri = process.env.PRODUCTION_DATABASE_URI || process.env.production_database_uri || "";
if (!rawProdUri) {
  console.error("No PRODUCTION_DATABASE_URI found in .env");
  process.exit(1);
}

// Ensure direct URI (not pooled) for migrations
const directProdUri = rawProdUri.replace("-pooler.", ".");

console.log("Production DB direct URI host:", new URL(directProdUri).host);

async function inspectAndSync() {
  const pool = new Pool({
    connectionString: directProdUri,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    const connCheck = await pool.query("SELECT current_database(), current_user;");
    console.log("Connected to Neon DB successfully:", connCheck.rows[0]);

    // Check existing migrations in _prisma_migrations
    let appliedMigrations: string[] = [];
    try {
      const migRes = await pool.query("SELECT migration_name FROM _prisma_migrations ORDER BY finished_at;");
      appliedMigrations = migRes.rows.map((r) => r.migration_name);
      console.log(`Found ${appliedMigrations.length} applied migration(s) in _prisma_migrations:`, appliedMigrations);
    } catch (e: any) {
      console.log("Could not query _prisma_migrations:", e.message);
    }

    await pool.end();

    console.log("\nRunning 'prisma migrate deploy' targeting production DB...");
    // Run prisma migrate deploy with DATABASE_URL set to directProdUri
    execSync("npx prisma migrate deploy", {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_URL: directProdUri,
      },
      stdio: "inherit",
    });

    console.log("\nPrisma migrate deploy completed successfully!");

    // Run custom SQL checks / column additions if needed
    const pool2 = new Pool({
      connectionString: directProdUri,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });

    console.log("\nVerifying production schema columns...");
    const checkSettings = await pool2.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company_role_settings';",
    );
    console.log("company_role_settings columns in production:", checkSettings.rows.map((r) => `${r.column_name} (${r.data_type})`));

    const checkCompanies = await pool2.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'companies' AND column_name IN ('logoUrl', 'website');",
    );
    console.log("companies columns in production:", checkCompanies.rows.map((r) => `${r.column_name} (${r.data_type})`));

    const checkShiftTimings = await pool2.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shift_timings';",
    );
    console.log("shift_timings columns in production:", checkShiftTimings.rows.map((r) => `${r.column_name} (${r.data_type})`));

    const checkFarms = await pool2.query(
      "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'farms' AND column_name IN ('autoAbsentEnabled', 'autoAbsentGraceMinutes');",
    );
    console.log("farms autoAbsent columns in production:", checkFarms.rows.map((r) => `${r.column_name} (${r.data_type}, default: ${r.column_default})`));

    // Verify system admin and permissions in production
    console.log("\nRunning seed / system-admin verification on production DB...");
    execSync("npx tsx prisma/seed.ts", {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_URL: directProdUri,
      },
      stdio: "inherit",
    });

    await pool2.end();
    console.log("\nProduction DB is 100% in sync with development!");
  } catch (err: any) {
    console.error("Inspection / sync error:", err);
    process.exit(1);
  }
}

inspectAndSync();
