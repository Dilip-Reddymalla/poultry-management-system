import type { OtpProvider } from "./otp-provider.js";

export class DevOtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    console.log(
      `[DEV OTP] ${phone}: ${otp}`,
    );
  }
}