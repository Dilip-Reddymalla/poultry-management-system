import {randomInt} from "node:crypto";
import argon2 from "argon2"

const OTP_LENGTH = 6;

export function generateOtp(): string{
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH;

    return randomInt(min,max).toString();
}

export async function hashOtp(otp:string): Promise<string>{
    return argon2.hash(otp);
}

export async function verifyOtp(otp:string, otpHash:string): Promise<boolean>{
    return argon2.verify(otpHash,otp);
}

export const OTP_EXPIRY_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

// Consumed/expired challenges are kept this long before cleanup removes them, so
// a short grace period remains for troubleshooting a failed login.
export const OTP_RETENTION_MS = 24 * 60 * 60 * 1000;

