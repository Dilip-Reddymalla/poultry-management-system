export interface OtpProvider {
  sendOtp(phone: string, otp: string): Promise<void>;
}