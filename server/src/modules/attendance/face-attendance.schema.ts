import { z } from "zod";

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const shiftSchema = z.enum([
  "MORNING_SHIFT",
  "AFTERNOON_SHIFT",
  "NIGHT_SHIFT",
  "OVERTIME",
]);

const statusSchema = z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"]);

// Schema for the process-frame request (form-data with image + metadata).
// The image file is handled by multer, so only the metadata fields appear here.
export const processFrameSchema = z.object({
  farmId: z.uuid("Invalid farm ID"),
});

// A single face attendance record submitted after the operator confirms identity.
const faceAttendanceRecordSchema = z.object({
  // Exactly one of these identifies the person.
  employeeId: z.uuid("Invalid employee ID").optional(),
  workerId: z.uuid("Invalid worker ID").optional(),
  shedId: z.uuid("Invalid shed ID").optional(),
  date: dateOnlySchema,
  shift: shiftSchema.default("MORNING_SHIFT"),
  status: statusSchema.default("PRESENT"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  livenessScore: z.number().min(0).max(1).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  snapshotUrl: z.string().url().optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine(
  (value) =>
    (value.employeeId === undefined) !== (value.workerId === undefined),
  {
    message: "Provide exactly one of employeeId or workerId",
    path: ["employeeId"],
  },
);

export const bulkMarkFaceAttendanceSchema = z.object({
  records: z
    .array(faceAttendanceRecordSchema)
    .min(1, "Must provide at least one attendance record"),
});

export type ProcessFrameInput = z.infer<typeof processFrameSchema>;

export type FaceAttendanceRecord = z.infer<typeof faceAttendanceRecordSchema>;

export type BulkMarkFaceAttendanceInput = z.infer<
  typeof bulkMarkFaceAttendanceSchema
>;
