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

    // The single global System Admin. It is intentionally NOT a seeded user row:
    // it lives only in the environment so it can never be listed, edited or
    // deleted as a company employee, and never has a passwordHash in the database.
    // The three values are a group — either all set (System Admin enabled) or all
    // absent (disabled). The password is read only to authenticate and is never
    // logged or persisted.
    SYSTEM_ADMIN_EMAIL: z
      .email("SYSTEM_ADMIN_EMAIL must be a valid email")
      .optional(),
    SYSTEM_ADMIN_PHONE: z.string().trim().min(1).optional(),
    SYSTEM_ADMIN_PASSWORD: z
      .string()
      .min(12, "SYSTEM_ADMIN_PASSWORD must be at least 12 characters long")
      .optional(),
  })
  .refine(
    (value) =>
      value.NODE_ENV !== "production" || value.CLIENT_ORIGIN !== undefined,
    {
      message: "CLIENT_ORIGIN is required when NODE_ENV=production",
      path: ["CLIENT_ORIGIN"],
    },
  )
  .refine(
    (value) => {
      // All three System Admin values must be supplied together; a partial set is
      // a misconfiguration that would silently disable the admin.
      const provided = [
        value.SYSTEM_ADMIN_EMAIL,
        value.SYSTEM_ADMIN_PHONE,
        value.SYSTEM_ADMIN_PASSWORD,
      ].filter((entry) => entry !== undefined).length;

      return provided === 0 || provided === 3;
    },
    {
      message:
        "SYSTEM_ADMIN_EMAIL, SYSTEM_ADMIN_PHONE and SYSTEM_ADMIN_PASSWORD must all be set together",
      path: ["SYSTEM_ADMIN_EMAIL"],
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
