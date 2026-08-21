import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),

  PORT: z.coerce.number().int().positive(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),

  HTTPSMS_API_KEY: z.string().min(1, "HTTPSMS_API_KEY is required"),

  HTTPSMS_FROM_PHONE: z.string().min(1, "HTTPSMS_FROM_PHONE is required"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:");

  console.error(z.prettifyError(parsedEnv.error));

  process.exit(1);
}

export const env = parsedEnv.data;
