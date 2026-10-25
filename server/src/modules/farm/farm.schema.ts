import { z } from "zod";

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const codeSchema = z.string().trim().min(1, "Farm code is required");

const nameSchema = z.string().trim().min(1, "Farm name is required");

export const farmIdParamSchema = z.object({
  id: z.uuid("Invalid farm ID"),
});

export const listFarmsQuerySchema = z.object({
  status: statusSchema.optional(),
  companyId: z.uuid("Invalid company ID").optional(),
});

const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);
const geofenceRadiusSchema = z.number().min(50).max(50000).default(1000);

export const createFarmSchema = z.object({
  companyId: z.uuid("Invalid company ID"),
  code: codeSchema,
  name: nameSchema,
  latitude: latitudeSchema.nullable().optional(),
  longitude: longitudeSchema.nullable().optional(),
  geofenceRadius: geofenceRadiusSchema.optional(),
  autoAbsentEnabled: z.boolean().optional(),
  autoAbsentGraceMinutes: z.number().int().min(0).max(360).optional(),
});

// The owning company is fixed at creation and status is owned by the
// deactivate/reactivate endpoints, so neither is updatable here.
export const updateFarmSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    latitude: latitudeSchema.nullable().optional(),
    longitude: longitudeSchema.nullable().optional(),
    geofenceRadius: geofenceRadiusSchema.optional(),
    autoAbsentEnabled: z.boolean().optional(),
    autoAbsentGraceMinutes: z.number().int().min(0).max(360).optional(),
  })
  .partial();

export type FarmIdParamInput = z.infer<typeof farmIdParamSchema>;

export type ListFarmsQueryInput = z.infer<typeof listFarmsQuerySchema>;

export type CreateFarmInput = z.infer<typeof createFarmSchema>;

export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
