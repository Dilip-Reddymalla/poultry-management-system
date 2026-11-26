import { z } from "zod";

/**
 * A single offline-attendance item submitted by a device for server-side
 * reconciliation. `data` is the raw record payload for the given `kind`; the
 * server validates it through the normal attendance services.
 */
export const SyncAttendanceItemSchema = z.object({
  itemId: z.string().min(1).max(128),
  kind: z.enum(["single", "face"]),
  data: z.record(z.string(), z.unknown()),
});

export const SyncAttendanceInputSchema = z.object({
  items: z.array(SyncAttendanceItemSchema).min(1).max(500),
});

export type SyncAttendanceItem = z.infer<typeof SyncAttendanceItemSchema>;
export type SyncAttendanceInput = z.infer<typeof SyncAttendanceInputSchema>;
