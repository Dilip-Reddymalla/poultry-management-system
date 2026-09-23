import type { OtpProvider } from "./otp-provider.js";
import { logger } from "../../../config/logger.js";

export class DevOtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info(
      { phone, otp },
      `[DEV OTP] Generated OTP for ${phone}: ${otp}`,
    );
  }
}