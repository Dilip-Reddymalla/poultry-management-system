import { z } from "zod";

const statusSchema = z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"]);

const shiftSchema = z.enum([
  "MORNING_SHIFT",
  "AFTERNOON_SHIFT",
  "NIGHT_SHIFT",
  "OVERTIME",
]);

// Calendar day with no time component. Accepts a YYYY-MM-DD string and pins it to
// UTC midnight so it lands on the intended day in the @db.Date column regardless
// of server timezone.
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const employeeIdSchema = z.uuid("Invalid employee ID");

const workerIdSchema = z.uuid("Invalid worker ID");

const shedIdSchema = z.uuid("Invalid shed ID");

const notesSchema = z
  .string()
  .trim()
  .min(1, "Notes must not be empty")
  .max(1000, "Notes must not exceed 1000 characters");

export const attendanceIdParamSchema = z.object({
  id: z.uuid("Invalid attendance ID"),
});

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(1000, "Limit must not exceed 1000")
    .default(20),
  // Exact day, or an inclusive from/to range. All optional.
  date: dateOnlySchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  // Narrows within the caller's scope; anything outside scope yields no rows.
  farmId: z.uuid("Invalid farm ID").optional(),
  shedId: shedIdSchema.optional(),
  employeeId: employeeIdSchema.optional(),
  workerId: workerIdSchema.optional(),
  status: statusSchema.optional(),
  shift: shiftSchema.optional(),
  search: z.string().trim().optional(),
  // Filter by who recorded the attendance (for the dashboard).
  recordedById: z.uuid("Invalid user ID").optional(),
});

// Exactly one of employeeId/workerId identifies the person. The farm is NOT
// accepted here — it is derived from the person on the server, so a caller can
// never attach a record to a farm the person does not belong to.
export const createAttendanceSchema = z
  .object({
    date: dateOnlySchema,
    employeeId: employeeIdSchema.optional(),
    workerId: workerIdSchema.optional(),
    shedId: shedIdSchema.optional(),
    shift: shiftSchema.default("MORNING_SHIFT"),
    status: statusSchema.default("PRESENT"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    notes: notesSchema.optional(),
  })
  .refine(
    (value) =>
      (value.employeeId === undefined) !== (value.workerId === undefined),
    {
      message: "Provide exactly one of employeeId or workerId",
      path: ["employeeId"],
    },
  );

// A correction changes only the mutable fields; the person, farm, date, shift
// and location are fixed at creation. Shift is immutable — wrong shift means
// delete and re-create.
export const updateAttendanceSchema = z
  .object({
    status: statusSchema,
    notes: notesSchema.nullable(),
  })
  .partial();

export const bulkCreateAttendanceSchema = z.object({
  records: z.array(createAttendanceSchema).min(1, "Must provide at least one record"),
});

// Query for the "already marked" dedup endpoint.
export const markedPersonIdsQuerySchema = z.object({
  date: dateOnlySchema,
  shift: shiftSchema,
  farmId: z.uuid("Invalid farm ID"),
});

// Query for the export endpoint.
export const exportAttendanceQuerySchema = z.object({
  date: dateOnlySchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  farmId: z.uuid("Invalid farm ID").optional(),
  shedId: shedIdSchema.optional(),
  scope: z.enum(["employees", "workers", "all"]).default("all"),
});

export type AttendanceIdParamInput = z.infer<typeof attendanceIdParamSchema>;

export type ListAttendanceQueryInput = z.infer<
  typeof listAttendanceQuerySchema
>;

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

export type BulkCreateAttendanceInput = z.infer<typeof bulkCreateAttendanceSchema>;

export type MarkedPersonIdsQueryInput = z.infer<typeof markedPersonIdsQuerySchema>;

export type ExportAttendanceQueryInput = z.infer<typeof exportAttendanceQuerySchema>;
