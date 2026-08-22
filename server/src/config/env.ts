import "dotenv/config";

import { z } from "zod";

const DEV_CLIENT_ORIGIN = "http://localhost:5173";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),

    PORT: z.coerce.number().int().positive(),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET must be at least 32 characters long"),

    HTTPSMS_API_KEY: z.string().min(1, "HTTPSMS_API_KEY is required"),

    HTTPSMS_FROM_PHONE: z.string().min(1, "HTTPSMS_FROM_PHONE is required"),

    // Origin of the frontend app, used for CORS. Optional in development where
    // the Vite dev server origin is well known; mandatory in production, since
    // credentialed CORS cannot use a wildcard and must not be guessed.
    CLIENT_ORIGIN: z.url("CLIENT_ORIGIN must be a valid URL").optional(),
  })
  .refine(
    (value) =>
      value.NODE_ENV !== "production" || value.CLIENT_ORIGIN !== undefined,
    {
      message: "CLIENT_ORIGIN is required when NODE_ENV=production",
      path: ["CLIENT_ORIGIN"],
    },
  );

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:");

  console.error(z.prettifyError(parsedEnv.error));

  process.exit(1);
}

export const env = parsedEnv.data;

// Resolved once so callers never re-implement the development fallback.
export const clientOrigin = env.CLIENT_ORIGIN ?? DEV_CLIENT_ORIGIN;
