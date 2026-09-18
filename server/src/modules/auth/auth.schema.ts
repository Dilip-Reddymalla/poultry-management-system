import { z } from "zod";

export const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.email("Invalid email address"),
);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password is required"),
});

export const requestOtpSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required"),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "OTP must be a 6-digit number"),
});

export const selectPhoneUserSchema = z.object({
  selectionToken: z
    .string()
    .min(1, "Selection token is required"),

  userId: z.uuid("Invalid user ID"),
});

// First-login password setup. Same minimum as employee provisioning used before
// it went passwordless, so the strength floor is unchanged.
export const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export type SelectPhoneUserInput = z.infer<
  typeof selectPhoneUserSchema
>;

export const phoneLoginSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required"),
  password: z.string().min(1, "Password is required"),
});

export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;

export type LoginInput = z.infer<typeof loginSchema>;

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required"),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "OTP must be a 6-digit number"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
  email: emailSchema.optional(),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;