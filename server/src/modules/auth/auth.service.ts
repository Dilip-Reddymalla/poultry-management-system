import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { generateAccessToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/app-error.js";
import { analyzeProfilePhoto, faceAiCircuitBreaker } from "../../services/face-ai.service.js";
import { cosineSimilarity, searchByEmbedding } from "../../services/vector-search.service.js";

import type { ChangePasswordInput, LoginInput, PhoneLoginInput, ResetPasswordInput } from "./auth.schema.js";
import type { FaceLoginAccount, SafeUser, PhoneLoginUser } from "./auth.types.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { broadestScopeLevel, invalidateScopeCache } from "./scope.js";
import {
  SYSTEM_ADMIN_USER_ID,
  buildSystemAdminSafeUser,
  getSystemAdminBiometrics,
  systemAdminEnabled,
  isSystemAdminEmail,
  isSystemAdminId,
  verifySystemAdminPassword,
} from "./system-admin.js";
import {
  generatePhoneSelectionToken,
  verifyPhoneSelectionToken,
} from "../../utils/phone-selection-token.js";
import { generateFaceSelectionToken, verifyFaceSelectionToken } from "../../utils/face-selection-token.js";
import { otpProvider } from "./otp/otp-provider.instance.js";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RETENTION_MS,
} from "../../utils/otp.js";
import { normalizePhone } from "../../utils/phone.js";
import {
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../../utils/refresh-token.js";
import { getRequestUserAgent, parseUserAgent } from "../../middlewares/request-context.js";

export type VerifyPhoneOtpResult =
  | {
      requiresUserSelection: false;
      token: string;
      refreshToken: string;
      user: SafeUser;
    }
  | {
      requiresUserSelection: true;
      selectionToken: string;
      users: PhoneLoginUser[];
    };

export async function createAndStoreRefreshToken(options: {
  userId?: string;
  isSystemAdmin?: boolean;
}): Promise<string> {
  const { token, tokenHash, expiresAt } = generateRefreshToken(options);
  const deviceName = parseUserAgent(getRequestUserAgent());

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      ...(options.userId ? { userId: options.userId } : {}),
      systemAdmin: options.isSystemAdmin === true,
      ...(deviceName ? { deviceName } : {}),
      expiresAt,
    },
  });
  return token;
}

// Every path that returns a session user reads exactly these fields, so the
// shape of a SafeUser cannot drift between login, OTP login and /me. Selecting
// (never including) also guarantees passwordHash can not leak by accident.
const sessionUserSelect = {
  id: true,
  email: true,
  isActive: true,
  mustSetPassword: true,
  employee: {
    select: {
      id: true,
      employeeId: true,
      name: true,
      status: true,
      farmId: true,
      photoUrl: true,
      joiningDate: true,
      phone: true,
      farm: {
        select: {
          companyId: true,
          company: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
            },
          },
        },
      },
      designation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  roles: {
    select: {
      role: {
        select: {
          name: true,
          scopeLevel: true,
          permissions: {
            select: {
              permission: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

type SessionUserRecord = Prisma.UserGetPayload<{
  select: typeof sessionUserSelect;
}>;

// Roles are exposed as labels; permissions are the flattened, de-duplicated set
// the frontend uses to gate UI. Both come from the database, never from the JWT.
// scope mirrors the caller's organizational reach (see scope.ts) for the UI.
function toSafeUser(user: SessionUserRecord): SafeUser {
  const permissions = new Set<string>();

  for (const userRole of user.roles) {
    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.name);
    }
  }

  const level = broadestScopeLevel(
    user.roles.map((userRole) => userRole.role.scopeLevel),
  );

  return {
    id: user.id,
    employeeId: user.employee.employeeId,
    email: user.email,
    isSystemAdmin: false,
    mustSetPassword: user.mustSetPassword,
    scope: {
      level,
      companyId: user.employee.farm.companyId,
      farmId: user.employee.farmId,
    },
    company: user.employee.farm?.company
      ? {
          id: user.employee.farm.company.id,
          name: user.employee.farm.company.name,
          code: user.employee.farm.company.code,
          logoUrl: user.employee.farm.company.logoUrl ?? null,
        }
      : null,
    employee: {
      id: user.employee.id,
      name: user.employee.name,
      photoUrl: (user.employee.photoUrl ?? null) as string | null,
      joiningDate: (user.employee.joiningDate != null ? user.employee.joiningDate.toISOString().split("T")[0] : null) as string | null,
      phone: (user.employee.phone ?? null) as string | null,
      designation: {
        id: user.employee.designation.id,
        name: user.employee.designation.name,
      },
    },
    roles: user.roles.map((userRole) => userRole.role.name),
    permissions: Array.from(permissions).sort(),
  };
}

export async function login(
  input: LoginInput,
): Promise<{ token: string; refreshToken: string; user: SafeUser }> {
  // The System Admin authenticates against the environment, never the database.
  // It is checked first and by email so a company user can never shadow it.
  if (isSystemAdminEmail(input.email)) {
    if (!verifySystemAdminPassword(input.password)) {
      throw new AppError("Invalid email or password", 401);
    }

    const refreshToken = await createAndStoreRefreshToken({ isSystemAdmin: true });

    return {
      token: generateAccessToken(SYSTEM_ADMIN_USER_ID),
      refreshToken,
      user: await buildSystemAdminSafeUser(),
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    select: {
      ...sessionUserSelect,
      passwordHash: true,
    },
  });
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }
  if (!user.isActive) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.employee.status !== "ACTIVE") {
    throw new AppError("Invalid email or password", 401);
  }

  // A provisioned account has no password until first-login setup completes, so
  // password login is impossible until then. This also prevents bypassing the
  // set-password step by calling /login directly.
  if (user.passwordHash === null) {
    throw new AppError("Invalid email or password", 401);
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = generateAccessToken(user.id);
  const refreshToken = await createAndStoreRefreshToken({ userId: user.id });

  return {
    token,
    refreshToken,
    user: toSafeUser(user),
  };
}

// Sweet-spot biometric thresholds: stricter than attendance (0.40) to prevent
// false logins, while tolerating real-world farm/webcam lighting.
const FACE_LOGIN_MIN_SIMILARITY = 0.62;
const FACE_LOGIN_MIN_MARGIN = 0.08;

interface FaceLoginCandidate {
  kind: "EMPLOYEE" | "SYSTEM_ADMIN";
  id: string;
  similarity: number;
}

export type FaceLoginResult =
  | {
      requiresUserSelection: false;
      token: string;
      refreshToken: string;
      user: SafeUser;
      similarity: number;
    }
  | {
      requiresUserSelection: true;
      selectionToken: string;
      accounts: FaceLoginAccount[];
    };

export async function loginWithFace(
  imageBuffer: Buffer,
  filename: string,
): Promise<FaceLoginResult> {
  if (faceAiCircuitBreaker.isOpen()) {
    throw new AppError(
      "Face AI service is temporarily unavailable. Please use password or OTP login.",
      503,
    );
  }

  const enrollResult = await analyzeProfilePhoto(imageBuffer, filename);
  const face = enrollResult.selected_face;

  if (!face) {
    throw new AppError(
      enrollResult.selection_reason || "No clear face detected. Please look directly at the camera.",
      400,
    );
  }

  if (!face.quality.usable) {
    const reasons = face.quality.reasons.join(", ");
    throw new AppError(
      `Face not clear enough: ${reasons || "please improve lighting and hold steady"}`,
      400,
    );
  }

  if (!face.liveness || face.liveness.decision !== "LIVE") {
    throw new AppError("Liveness check failed. Please use a live camera photo.", 401);
  }

  if (!face.embedding) {
    throw new AppError("Could not extract face features. Please try again.", 400);
  }

  const [matches, sysAdminBiometrics] = await Promise.all([
    searchByEmbedding(face.embedding, {
      threshold: 0.4,
      limit: 5,
    }),
    systemAdminEnabled() ? getSystemAdminBiometrics() : Promise.resolve(null),
  ]);

  const allCandidates: FaceLoginCandidate[] = matches
    .filter((m) => m.personType === "EMPLOYEE")
    .map((m) => ({ kind: "EMPLOYEE", id: m.id, similarity: m.similarity }));

  if (sysAdminBiometrics?.faceEmbedding) {
    const sysSim = cosineSimilarity(face.embedding, sysAdminBiometrics.faceEmbedding);
    if (sysSim >= 0.4) {
      allCandidates.push({ kind: "SYSTEM_ADMIN", id: SYSTEM_ADMIN_USER_ID, similarity: sysSim });
    }
  }

  allCandidates.sort((a, b) => b.similarity - a.similarity);

  // Only strong matches may log in or be offered as account choices. A person
  // with several login accounts will show up here as several strong matches, so
  // we never silently pick one -- we ask which account to open.
  const candidates = allCandidates.filter((c) => c.similarity >= FACE_LOGIN_MIN_SIMILARITY);
  const topMatch = candidates[0];
  const secondMatch = candidates[1];

  if (!topMatch) {
    const best = allCandidates[0];
    if (best) {
      const pct = Math.round(best.similarity * 100);
      const reqPct = Math.round(FACE_LOGIN_MIN_SIMILARITY * 100);
      throw new AppError(
        `Face confidence too low (${pct}% — need ${reqPct}%+). Move to better lighting or sign in with password.`,
        401,
      );
    }
    throw new AppError(
      "Face not recognized. Update your profile photo first or sign in with password.",
      401,
    );
  }

  const ambiguous = Boolean(
    secondMatch && topMatch.similarity - secondMatch.similarity < FACE_LOGIN_MIN_MARGIN,
  );

  if (ambiguous) {
    const accounts = await buildFaceAccounts(candidates);

    // Only offer a chooser when more than one account is actually actionable.
    // A "matches multiple accounts" warning with a single usable account would
    // be confusing (and worse, sometimes even zero usable accounts).
    if (accounts.length > 1) {
      const selectionToken = generateFaceSelectionToken(
        accounts.map((a) => ({ kind: a.kind, id: a.id })),
      );
      return {
        requiresUserSelection: true,
        selectionToken,
        accounts,
      };
    }

    // Exactly one resolvable account -> sign into it directly.
    const onlyAccount = accounts[0];
    if (onlyAccount) {
      const session = await issueTokensForAccount(onlyAccount);
      return {
        requiresUserSelection: false,
        ...session,
        similarity: topMatch.similarity,
      };
    }

    // No resolvable account: fall through to the single-match auto-login below.
  }

  if (topMatch.kind === "SYSTEM_ADMIN") {
    const refreshToken = await createAndStoreRefreshToken({ isSystemAdmin: true });
    return {
      requiresUserSelection: false,
      token: generateAccessToken(SYSTEM_ADMIN_USER_ID),
      refreshToken,
      user: await buildSystemAdminSafeUser(),
      similarity: topMatch.similarity,
    };
  }

  // Defensive: a malformed/empty employee id must never reach a Prisma query,
  // which would 500 with a validation error instead of a clean rejection.
  if (typeof topMatch.id !== "string" || topMatch.id.length === 0) {
    throw new AppError("No active login account linked to this face.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { employeeId: topMatch.id },
    select: sessionUserSelect,
  });

  if (!user || !user.isActive || user.employee.status !== "ACTIVE") {
    throw new AppError("No active login account linked to this face.", 401);
  }

  const token = generateAccessToken(user.id);
  const refreshToken = await createAndStoreRefreshToken({ userId: user.id });

  return {
    requiresUserSelection: false,
    token,
    refreshToken,
    user: toSafeUser(user),
    similarity: topMatch.similarity,
  };
}

interface FaceAccountEntry extends FaceLoginAccount {
  similarity: number;
}

// eslint-disable-next-line no-useless-escape
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function buildFaceAccounts(candidates: FaceLoginCandidate[]): Promise<FaceAccountEntry[]> {
  const employeeCandidates = candidates.filter((c) => c.kind === "EMPLOYEE");
  const adminCandidates = candidates.filter((c) => c.kind === "SYSTEM_ADMIN");

  const safeEmployeeCandidates = employeeCandidates.filter((c) => UUID_RE.test(c.id));
  const employees = safeEmployeeCandidates.length
    ? await prisma.employee.findMany({
        where: { id: { in: safeEmployeeCandidates.map((c) => c.id) } },
        select: {
          id: true,
          employeeId: true,
          name: true,
          designation: { select: { id: true, name: true } },
          user: { select: { id: true } },
        },
      })
    : [];

  const byEmployeeId = new Map(employees.map((e) => [e.id, e]));
  const entries: FaceAccountEntry[] = [];

  for (const c of employeeCandidates) {
    const employee = byEmployeeId.get(c.id);
    if (!employee?.user) continue;
    entries.push({
      kind: "EMPLOYEE",
      id: employee.user.id,
      name: employee.name,
      employeeId: employee.employeeId,
      designation: employee.designation,
      similarity: c.similarity,
    });
  }

  for (const c of adminCandidates) {
    entries.push({
      kind: "SYSTEM_ADMIN",
      id: SYSTEM_ADMIN_USER_ID,
      name: "System Administrator",
      employeeId: null,
      designation: { id: SYSTEM_ADMIN_USER_ID, name: "System Administrator" },
      similarity: c.similarity,
    });
  }

  return entries.sort((a, b) => b.similarity - a.similarity);
}

async function issueTokensForAccount(
  account: Pick<FaceLoginAccount, "kind" | "id">,
): Promise<{ token: string; refreshToken: string; user: SafeUser }> {
  if (account.kind === "SYSTEM_ADMIN") {
    const refreshToken = await createAndStoreRefreshToken({ isSystemAdmin: true });
    return {
      token: generateAccessToken(SYSTEM_ADMIN_USER_ID),
      refreshToken,
      user: await buildSystemAdminSafeUser(),
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: account.id,
      isActive: true,
      employee: { is: { status: "ACTIVE" } },
    },
    select: sessionUserSelect,
  });

  if (!user) {
    throw new AppError("Invalid account selection", 400);
  }

  const token = generateAccessToken(user.id);
  const refreshToken = await createAndStoreRefreshToken({ userId: user.id });

  return {
    token,
    refreshToken,
    user: toSafeUser(user),
  };
}

export async function selectFaceUser(
  selectionToken: string,
  accountId: string,
): Promise<{ token: string; refreshToken: string; user: SafeUser }> {
  const selection = verifyFaceSelectionToken(selectionToken);
  const chosen = selection.candidates.find((c) => c.id === accountId);

  if (!chosen) {
    throw new AppError("Invalid account selection", 400);
  }

  return issueTokensForAccount(chosen);
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  if (isSystemAdminId(userId)) {
    return buildSystemAdminSafeUser();
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: sessionUserSelect,
  });

  if (!user || !user.isActive || user.employee.status !== "ACTIVE") {
    throw new AppError("Authentication required", 401);
  }

  return toSafeUser(user);
}

// First-login password setup. The account signed in by OTP (so requireAuth
// passed) and is in the mustSetPassword state; this is the only way to leave it.
// The token is rotated so the new session is unrestricted immediately.
export async function setPassword(
  userId: string,
  password: string,
): Promise<{ token: string; refreshToken: string; user: SafeUser }> {
  if (isSystemAdminId(userId)) {
    // The System Admin password lives in the environment and is never set here.
    throw new AppError("Password setup is not available for this account", 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      mustSetPassword: true,
      employee: { select: { status: true } },
    },
  });

  if (!user || !user.isActive || user.employee.status !== "ACTIVE") {
    throw new AppError("Authentication required", 401);
  }

  if (!user.mustSetPassword) {
    // Password is already set; this endpoint only serves the first-login state.
    throw new AppError("Password has already been set", 409);
  }

  const passwordHash = await hashPassword(password);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustSetPassword: false,
    },
    select: sessionUserSelect,
  });

  invalidateScopeCache(updated.id);

  const refreshToken = await createAndStoreRefreshToken({ userId: updated.id });

  return {
    token: generateAccessToken(updated.id),
    refreshToken,
    user: toSafeUser(updated),
  };
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ token: string; refreshToken: string; user: SafeUser }> {
  if (isSystemAdminId(userId)) {
    throw new AppError("System Admin password lives in the environment and cannot be changed here", 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
      employee: { select: { name: true, status: true } },
    },
  });

  if (!user || !user.isActive || user.employee.status !== "ACTIVE") {
    throw new AppError("Authentication required", 401);
  }

  if (user.passwordHash) {
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError("Incorrect current password", 400);
    }
  }

  const newHash = await hashPassword(input.newPassword);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustSetPassword: false,
    },
    select: sessionUserSelect,
  });

  // Invalidate any other existing refresh tokens on password change
  await revokeAllUserRefreshTokens(user.id);
  invalidateScopeCache(user.id);

  void recordAuditLog({
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    summary: `User ${user.email} changed their password`,
  });

  const refreshToken = await createAndStoreRefreshToken({ userId: updated.id });

  return {
    token: generateAccessToken(updated.id),
    refreshToken,
    user: toSafeUser(updated),
  };
}

export async function resetPasswordWithOtp(
  input: ResetPasswordInput,
): Promise<{ message: string }> {
  const normalizedPhone = normalizePhone(input.phone);

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      phone: normalizedPhone,
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!challenge) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError("OTP attempt limit exceeded", 429);
  }

  const validOtp = await verifyOtp(input.otp, challenge.otpHash);

  if (!validOtp) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: { increment: 1 },
      },
    });

    throw new AppError("Invalid or expired OTP", 400);
  }

  // Consume challenge
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  // Find user accounts associated with this phone
  const employees = await prisma.employee.findMany({
    where: {
      phone: normalizedPhone,
      status: "ACTIVE",
      user: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (employees.length === 0) {
    throw new AppError("No active account found for this phone number", 404);
  }

  let targetUser: { id: string; email: string; name: string } | null = null;

  if (employees.length === 1) {
    const emp = employees[0]!;
    targetUser = {
      id: emp.user!.id,
      email: emp.user!.email,
      name: emp.name,
    };
  } else {
    // Multiple employees share this phone number: require email to identify which account to reset
    if (!input.email) {
      throw new AppError(
        "Multiple accounts found for this phone. Please provide your work email address as well.",
        400,
      );
    }

    const matched = employees.find(
      (e) => e.user?.email.toLowerCase() === input.email?.trim().toLowerCase(),
    );

    if (!matched || !matched.user) {
      throw new AppError("No matching account found for this phone and email combination", 404);
    }

    targetUser = {
      id: matched.user.id,
      email: matched.user.email,
      name: matched.name,
    };
  }

  const newHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      passwordHash: newHash,
      mustSetPassword: false,
    },
  });

  // Revoke all existing refresh tokens and invalidate cached permissions upon password reset
  await revokeAllUserRefreshTokens(targetUser.id);
  invalidateScopeCache(targetUser.id);

  void recordAuditLog({
    action: "UPDATE",
    entity: "User",
    entityId: targetUser.id,
    summary: `Password reset via OTP for user ${targetUser.email} (${targetUser.name})`,
  });

  return {
    message: "Password reset successfully. You can now sign in with your new password.",
  };
}

export async function requestOtp(
  phone: string,
): Promise<{ phone: string }> {
  const normalizedPhone = normalizePhone(phone);

  const latestChallenge = await prisma.otpChallenge.findFirst({
    where: {
      phone: normalizedPhone,
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (latestChallenge) {
    const cooldownExpiresAt =
      latestChallenge.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS;

    if (Date.now() < cooldownExpiresAt) {
      throw new AppError("OTP resend cooldown active", 429);
    }

    await prisma.otpChallenge.update({
      where: {
        id: latestChallenge.id,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  const otp = generateOtp();

  const otpHash = await hashOtp(otp);

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MS,
  );

  await otpProvider.sendOtp(normalizedPhone, otp);

  await prisma.otpChallenge.create({
    data: {
      phone: normalizedPhone,
      otpHash,
      expiresAt,
    },
  });

  return {
    phone: normalizedPhone,
  };
}

export async function verifyPhoneOtp(
  phone: string,
  otp: string,
): Promise<VerifyPhoneOtpResult> {
  const normalizedPhone = normalizePhone(phone);

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      phone: normalizedPhone,
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!challenge) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError("OTP attempt limit exceeded", 429);
  }

  const validOtp = await verifyOtp(otp, challenge.otpHash);

  if (!validOtp) {
    await prisma.otpChallenge.update({
      where: {
        id: challenge.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new AppError("Invalid or expired OTP", 400);
  }

  await prisma.otpChallenge.update({
    where: {
      id: challenge.id,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  const users = await findUsersByPhone(normalizedPhone);

  if (users.length === 0) {
    throw new AppError("No active account found for this phone number", 404);
  }

  if (users.length > 1) {
    const selectionToken = generatePhoneSelectionToken(
      normalizedPhone,
      users.map((user) => user.id),
    );

    return {
      requiresUserSelection: true,
      selectionToken,
      users,
    };
  }

  const user = users[0];

  if (!user) {
    throw new AppError("No active account found for this phone number", 404);
  }

  const token = generateAccessToken(user.id);
  const refreshToken = await createAndStoreRefreshToken({ userId: user.id });

  const fullUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    select: sessionUserSelect,
  });

  if (!fullUser) {
    throw new AppError("Invalid account selection", 400);
  }

  return {
    requiresUserSelection: false,
    token,
    refreshToken,
    user: toSafeUser(fullUser),
  };
}

export async function findUsersByPhone(
  phone: string,
): Promise<PhoneLoginUser[]> {
  const normalizedPhone = normalizePhone(phone);

  const employees = await prisma.employee.findMany({
    where: {
      phone: normalizedPhone,
      status: "ACTIVE",
      user: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      employeeId: true,
      name: true,
      designation: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  return employees.map((employee) => ({
    id: employee.user!.id,
    employeeId: employee.employeeId,
    name: employee.name,
    designation: {
      id: employee.designation.id,
      name: employee.designation.name,
    },
  }));
}

export async function selectPhoneUser(
  selectionToken: string,
  userId: string,
): Promise<{ token: string; refreshToken: string; user: SafeUser }> {
  const selection = verifyPhoneSelectionToken(selectionToken);

  if (!selection.userIds.includes(userId)) {
    throw new AppError("Invalid account selection", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      employee: {
        is: {
          phone: selection.phone,
          status: "ACTIVE",
        },
      },
    },
    select: sessionUserSelect,
  });

  if (!user) {
    throw new AppError("Invalid account selection", 400);
  }

  const token = generateAccessToken(user.id);
  const refreshToken = await createAndStoreRefreshToken({ userId: user.id });

  return {
    token,
    refreshToken,
    user: toSafeUser(user),
  };
}

export async function loginWithPhone(
  input: PhoneLoginInput,
): Promise<VerifyPhoneOtpResult> {
  const normalizedPhone = normalizePhone(input.phone);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      passwordHash: {
        not: null,
      },
      employee: {
        is: {
          phone: normalizedPhone,
          status: "ACTIVE",
        },
      },
    },
    select: {
      ...sessionUserSelect,
      passwordHash: true,
    },
  });

  if (users.length === 0) {
    throw new AppError("Invalid phone number or password", 401);
  }

  const validUsers: SessionUserRecord[] = [];
  for (const user of users) {
    if (user.passwordHash) {
      const isValid = await verifyPassword(input.password, user.passwordHash);
      if (isValid) {
        validUsers.push(user);
      }
    }
  }

  if (validUsers.length === 0) {
    throw new AppError("Invalid phone number or password", 401);
  }

  if (validUsers.length > 1) {
    const selectionToken = generatePhoneSelectionToken(
      normalizedPhone,
      validUsers.map((u) => u.id),
    );

    return {
      requiresUserSelection: true,
      selectionToken,
      users: validUsers.map((u) => ({
        id: u.id,
        employeeId: u.employee.employeeId,
        name: u.employee.name,
        designation: {
          id: u.employee.designation.id,
          name: u.employee.designation.name,
        },
      })),
    };
  }

  const user = validUsers[0]!;
  const token = generateAccessToken(user.id);
  const refreshToken = await createAndStoreRefreshToken({ userId: user.id });

  return {
    requiresUserSelection: false,
    token,
    refreshToken,
    user: toSafeUser(user),
  };
}

// Retention cleanup for the otp_challenges table, which otherwise grows without
// bound. Safe to run repeatedly and concurrently: it only matches challenges that
// are already consumed or already expired, so an active challenge is never
// deleted. Intended to be executed periodically (see `npm run otp:cleanup`).
export async function purgeExpiredOtpChallenges(): Promise<{ deleted: number }> {
  const now = new Date();

  const cutoff = new Date(now.getTime() - OTP_RETENTION_MS);

  const result = await prisma.otpChallenge.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
      OR: [
        {
          consumedAt: {
            not: null,
          },
        },
        {
          expiresAt: {
            lte: now,
          },
        },
      ],
    },
  });

  return {
    deleted: result.count,
  };
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
): Promise<{ token: string; refreshToken: string; user: SafeUser }> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const tokenHash = hashToken(rawRefreshToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: sessionUserSelect,
      },
    },
  });

  if (!existingToken) {
    throw new AppError("Invalid refresh token", 401);
  }

  // Automatic reuse detection: If a revoked token is used, check if it falls within the rotation grace period.
  // A 30-second window allows for network latency, retries, and concurrent tab requests without false-positive lockouts.
  const ROTATION_GRACE_PERIOD_MS = 30_000;
  if (existingToken.revokedAt !== null) {
    const elapsedSinceRevocation = Date.now() - existingToken.revokedAt.getTime();
    if (elapsedSinceRevocation > ROTATION_GRACE_PERIOD_MS) {
      // Past grace period: This specific token has been consumed and retired.
      // Do not perform a global blanket wipe of other active devices (e.g. phone vs laptop),
      // but ensure this stale token is rejected so only the current device logs out.
    }
    throw new AppError("Refresh token revoked. Please log in again.", 401);
  }

  if (existingToken.expiresAt.getTime() <= Date.now()) {
    throw new AppError("Refresh token expired. Please log in again.", 401);
  }

  // Check account status for standard user
  if (!existingToken.systemAdmin) {
    if (
      !existingToken.user ||
      !existingToken.user.isActive ||
      existingToken.user.employee.status !== "ACTIVE"
    ) {
      throw new AppError("User account is inactive", 401);
    }
  }

  // Revoke the old refresh token
  await prisma.refreshToken.update({
    where: { id: existingToken.id },
    data: { revokedAt: new Date() },
  });

  // Issue new access token + new refresh token
  if (existingToken.systemAdmin) {
    const token = generateAccessToken(SYSTEM_ADMIN_USER_ID);
    const newRefreshToken = await createAndStoreRefreshToken({ isSystemAdmin: true });
    const user = await buildSystemAdminSafeUser();
    return { token, refreshToken: newRefreshToken, user };
  } else {
    const token = generateAccessToken(existingToken.userId!);
    const newRefreshToken = await createAndStoreRefreshToken({
      userId: existingToken.userId!,
    });
    return {
      token,
      refreshToken: newRefreshToken,
      user: toSafeUser(existingToken.user!),
    };
  }
}

export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  try {
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Non-blocking
  }
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  if (isSystemAdminId(userId)) {
    await prisma.refreshToken.updateMany({
      where: { systemAdmin: true, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } else {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export async function purgeExpiredRefreshTokens(): Promise<{ deleted: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lte: now } },
        { revokedAt: { lte: cutoff } },
      ],
    },
  });

  return { deleted: result.count };
}

export async function listActiveSessions(userId: string) {
  const isSystemAdmin = isSystemAdminId(userId);
  const tokens = await prisma.refreshToken.findMany({
    where: isSystemAdmin
      ? { systemAdmin: true, revokedAt: null, expiresAt: { gt: new Date() } }
      : { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      deviceName: true,
    },
  });

  return tokens.map((t) => ({
    id: t.id,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    deviceName: t.deviceName ?? "Unknown device",
  }));
}

export async function revokeSession(userId: string, tokenId: string): Promise<void> {
  const isSystemAdmin = isSystemAdminId(userId);
  const token = await prisma.refreshToken.findFirst({
    where: isSystemAdmin ? { id: tokenId, systemAdmin: true } : { id: tokenId, userId },
  });

  if (!token) {
    throw new AppError("Session not found", 404);
  }

  await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
}

