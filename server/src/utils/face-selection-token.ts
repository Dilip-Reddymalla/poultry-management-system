import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export interface FaceSelectionCandidatePayload {
  kind: "EMPLOYEE" | "SYSTEM_ADMIN";
  id: string;
}

export interface FaceSelectionTokenPayload {
  sub: string;
  purpose: "face_selection";
  candidates: FaceSelectionCandidatePayload[];
}

const FACE_SELECTION_TOKEN_EXPIRES_IN = "5m";

/**
 * Short-lived, single-purpose token that lets the client finish a face login
 * when the matched face belongs to more than one account. It only binds the
 * candidate account ids -- never the face snapshot/embedding -- so a valid
 * token cannot be used to log into an account that was not in the original
 * strong match set.
 */
export function generateFaceSelectionToken(
  candidates: FaceSelectionCandidatePayload[],
): string {
  const payload: FaceSelectionTokenPayload = {
    sub: "face-selection",
    purpose: "face_selection",
    candidates,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: FACE_SELECTION_TOKEN_EXPIRES_IN,
  });
}

export function verifyFaceSelectionToken(token: string): FaceSelectionTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (decoded as any).sub !== "face-selection" ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (decoded as any).purpose !== "face_selection" ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !Array.isArray((decoded as any).candidates) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !(decoded as any).candidates.every(
      (c: FaceSelectionCandidatePayload) =>
        typeof c === "object" &&
        c !== null &&
        (c.kind === "EMPLOYEE" || c.kind === "SYSTEM_ADMIN") &&
        typeof c.id === "string",
    )
  ) {
    throw new Error("Invalid face selection token");
  }

  const payload = decoded as unknown as FaceSelectionTokenPayload;
  return {
    sub: payload.sub,
    purpose: payload.purpose,
    candidates: payload.candidates,
  };
}
