import { sendSms } from "../../../utils/httpsms.js";
import type { OtpProvider } from "./otp-provider.js";
import { logger } from "../../../config/logger.js";

export class HttpsmsOtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info({ phone }, "Sending OTP via httpsms");
    await sendSms({
      to: phone,
      message: `Your Poultry Management System OTP is ${otp}. It expires in 5 minutes.`,
    });
  }
}