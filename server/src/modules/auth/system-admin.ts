import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { deleteImageByUrl } from "../../services/cloudinary.service.js";
import type { SafeUser } from "./auth.types.js";

// The System Admin is not a database user. It authenticates against environment
// values and is represented in the JWT by this sentinel `sub`. It can never
// collide with a real user id, which is always a UUID.
export const SYSTEM_ADMIN_USER_ID = "system-admin";

// Label shown in the UI. It is not a seeded Role row — the System Admin has no
// UserRole and its authority is global by construction, not by permission list.
export const SYSTEM_ADMIN_ROLE = "System Admin";

export function isSystemAdminId(userId: string): boolean {
  return userId === SYSTEM_ADMIN_USER_ID;
}

// True only when the full env group is configured. Everything else in this file
// assumes the caller checked this first.
export function systemAdminEnabled(): boolean {
  return (
    env.SYSTEM_ADMIN_EMAIL !== undefined &&
    env.SYSTEM_ADMIN_PASSWORD !== undefined
  );
}

export function isSystemAdminEmail(email: string): boolean {
  if (!systemAdminEnabled()) {
    return false;
  }

  // Email is not a secret; a plain case-insensitive compare is fine here.
  return email.trim().toLowerCase() === env.SYSTEM_ADMIN_EMAIL!.toLowerCase();
}

// Constant-time password compare. Both sides are hashed to a fixed 32-byte digest
// first so timingSafeEqual never sees mismatched lengths (which would itself leak
// the length). The env password is never logged and never leaves this function.
export function verifySystemAdminPassword(password: string): boolean {
  if (!systemAdminEnabled()) {
    return false;
  }

  const provided = createHash("sha256").update(password, "utf8").digest();
  const expected = createHash("sha256")
    .update(env.SYSTEM_ADMIN_PASSWORD!, "utf8")
    .digest();

  return timingSafeEqual(provided, expected);
}

// The `system_admin_profiles` table is provisioned by a Prisma migration (see
// prisma/migrations/...add_system_admin_profiles). It must NOT be created at
// runtime: many managed Postgres providers (e.g. Neon) run the app with a role
// that cannot CREATE TABLE in the `public` schema. The runtime only reads and
// writes the table, which is already provisioned.

export async function getSystemAdminBiometrics(): Promise<{
  photoUrl: string | null;
  faceEmbedding: number[] | null;
}> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ photo_url: string | null; face_embedding: number[] | null }>
    >(
      `SELECT photo_url, face_embedding FROM system_admin_profiles WHERE id = $1`,
      SYSTEM_ADMIN_USER_ID,
    );
    const row = rows[0];
    return {
      photoUrl: row?.photo_url ?? null,
      faceEmbedding: Array.isArray(row?.face_embedding) ? row.face_embedding : null,
    };
  } catch {
    return { photoUrl: null, faceEmbedding: null };
  }
}

export async function updateSystemAdminBiometrics(
  photoUrl: string,
  faceEmbedding?: number[],
): Promise<void> {
  const existing = await getSystemAdminBiometrics();

  await prisma.$executeRawUnsafe(
    `INSERT INTO system_admin_profiles (id, photo_url, face_embedding, updated_at)
     VALUES ($1, $2, $3::float8[], NOW())
     ON CONFLICT (id) DO UPDATE SET
       photo_url = EXCLUDED.photo_url,
       face_embedding = COALESCE(EXCLUDED.face_embedding, system_admin_profiles.face_embedding),
       updated_at = NOW()`,
    SYSTEM_ADMIN_USER_ID,
    photoUrl,
    faceEmbedding ?? null,
  );

  if (existing.photoUrl && existing.photoUrl !== photoUrl) {
    void deleteImageByUrl(existing.photoUrl);
  }
}

// The System Admin has no employee/designation row, so it is presented with a
// synthetic but shape-compatible SafeUser. `permissions` is the full seeded set
// so the frontend enables every control; the backend authorizes it by the
// isSystemAdmin flag, never by this list.
export async function buildSystemAdminSafeUser(): Promise<SafeUser> {
  const [permissions, biometrics] = await Promise.all([
    prisma.permission.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    getSystemAdminBiometrics(),
  ]);

  return {
    id: SYSTEM_ADMIN_USER_ID,
    employeeId: "SYSTEM-ADMIN",
    email: env.SYSTEM_ADMIN_EMAIL!,
    isSystemAdmin: true,
    mustSetPassword: false,
    scope: {
      level: "GLOBAL",
      companyId: null,
      farmId: null,
    },
    company: null,
    employee: {
      id: SYSTEM_ADMIN_USER_ID,
      name: "System Administrator",
      photoUrl: biometrics.photoUrl,
      joiningDate: null,
      phone: null,
      designation: {
        id: SYSTEM_ADMIN_USER_ID,
        name: SYSTEM_ADMIN_ROLE,
      },
    },

    roles: [SYSTEM_ADMIN_ROLE],
    permissions: permissions.map((permission) => permission.name),
  };
}
