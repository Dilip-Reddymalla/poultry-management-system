import { prisma } from "../../config/database.js";
import { verifyPassword } from "../../utils/password.js";
import { generateAccessToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/app-error.js";

import type { LoginInput } from "./auth.schema.js";
import type { SafeUser, PhoneLoginUser, UserAuthorization } from "./auth.types.js";
import {
  generatePhoneSelectionToken,
  verifyPhoneSelectionToken,
} from "../../utils/phone-selection-token.js";
import { otpProvider } from "./otp/otp-provider.instance.js";
import { sendSms } from "../../utils/httpsms.js";

type VerifyPhoneOtpResult =
  | {
      requiresUserSelection: false;
      token: string;
      user: SafeUser;
    }
  | {
      requiresUserSelection: true;
      selectionToken: string;
      users: PhoneLoginUser[];
    };

export async function login(
  input: LoginInput,
): Promise<{ token: string; user: SafeUser }> {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    include: {
      employee: {
        include: {
          designation: true,
        },
      },
      roles: {
        include: {
          role: true,
        },
      },
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

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = generateAccessToken(user.id);

  const safeUser: SafeUser = {
    id: user.id,
    employeeId: user.employee.employeeId,
    email: user.email,
    employee: {
      name: user.employee.name,
      designation: user.employee.designation.name,
    },
    roles: user.roles.map((userRole) => userRole.role.name),
  };

  return {
    token: token,
    user: safeUser,
  };
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      employee: {
        include: {
          designation: true,
        },
      },
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user || !user.isActive || user.employee.status !== "ACTIVE") {
    throw new AppError("Authentication required", 401);
  }

  const safeUser: SafeUser = {
    id: user.id,
    employeeId: user.employee.employeeId,
    email: user.email,
    employee: {
      name: user.employee.name,
      designation: user.employee.designation.name,
    },
    roles: user.roles.map((userRole) => userRole.role.name),
  };

  return safeUser;
}

export async function getUserAuthorization(
  userId: string,
): Promise<UserAuthorization> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      isActive: true,
      employee: {
        select: {
          status: true,
        },
      },
      roles: {
        select: {
          role: {
            select: {
              name: true,
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
    },
  });

  if (!user || !user.isActive || user.employee.status !== "ACTIVE") {
    throw new AppError("Authentication required", 401);
  }

  const permissions = new Set<string>();

  for (const userRole of user.roles) {
    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.name);
    }
  }

  return {
    roles: user.roles.map((userRole) => userRole.role.name),
    permissions: Array.from(permissions),
  };
}

import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
} from "../../utils/otp.js";

import { normalizePhone } from "../../utils/phone.js";

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

  const fullUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    include: {
      employee: {
        include: {
          designation: true,
        },
      },
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!fullUser) {
    throw new AppError("Invalid account selection", 400);
  }

  const safeUser: SafeUser = {
    id: fullUser.id,
    employeeId: fullUser.employee.employeeId,
    email: fullUser.email,
    employee: {
      name: fullUser.employee.name,
      designation: fullUser.employee.designation.name,
    },
    roles: fullUser.roles.map((userRole) => userRole.role.name),
  };

  return {
    requiresUserSelection: false,
    token,
    user: safeUser,
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
    include: {
      designation: true,
      user: true,
    },
  });

  return employees.map((employee) => ({
    id: employee.user!.id,
    employeeId: employee.employeeId,
    name: employee.name,
    designation: employee.designation.name,
  }));
}

export async function selectPhoneUser(
  selectionToken: string,
  userId: string,
): Promise<{ token: string; user: SafeUser }> {
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
    include: {
      employee: {
        include: {
          designation: true,
        },
      },
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError("Invalid account selection", 400);
  }

  const token = generateAccessToken(user.id);

  const safeUser: SafeUser = {
    id: user.id,
    employeeId: user.employee.employeeId,
    email: user.email,
    employee: {
      name: user.employee.name,
      designation: user.employee.designation.name,
    },
    roles: user.roles.map((userRole) => userRole.role.name),
  };

  return {
    token,
    user: safeUser,
  };
}
