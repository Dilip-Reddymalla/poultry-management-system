import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export interface PhoneSelectionTokenPayload {
  sub: string;
  purpose: "phone_selection";
  phone: string;
  userIds: string[];
}

const PHONE_SELECTION_TOKEN_EXPIRES_IN = "5m";

export function generatePhoneSelectionToken(
  phone: string,
  userIds: string[],
): string {
  const payload: PhoneSelectionTokenPayload = {
    sub: "phone-selection",
    purpose: "phone_selection",
    phone,
    userIds,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: PHONE_SELECTION_TOKEN_EXPIRES_IN,
  });
}

export function verifyPhoneSelectionToken(
  token: string,
): PhoneSelectionTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "string" ||
    decoded.sub !== "phone-selection" ||
    decoded.purpose !== "phone_selection" ||
    typeof decoded.phone !== "string" ||
    !Array.isArray(decoded.userIds) ||
    !decoded.userIds.every(
      (userId: string): userId is string => typeof userId === "string",
    )
  ) {
    throw new Error("Invalid phone selection token");
  }

  return {
    sub: decoded.sub,
    purpose: decoded.purpose,
    phone: decoded.phone,
    userIds: decoded.userIds,
  };
}