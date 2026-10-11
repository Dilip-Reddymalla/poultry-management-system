import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("Valid push subscription endpoint URL is required"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
  userAgent: z.string().optional(),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().min(1, "Endpoint is required"),
});

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  category: z
    .enum(["IP_FALLBACK_AUDIT", "SERVER_500_ERROR", "ATTENDANCE_APPROVAL", "SYSTEM_ALERT"])
    .optional(),
  unreadOnly: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
