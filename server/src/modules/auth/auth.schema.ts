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

export type SelectPhoneUserInput = z.infer<
  typeof selectPhoneUserSchema
>;

export type LoginInput = z.infer<typeof loginSchema>;

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;