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