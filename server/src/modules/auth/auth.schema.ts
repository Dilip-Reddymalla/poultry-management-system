import {z} from "zod";

const emailSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.email("Invalid email address"),
);

export const loginSchema = z.object({
    email: emailSchema,

    password: z
        .string()
        .min(1, "password is required"),
});

export type LoginInput =z.infer<typeof loginSchema>;