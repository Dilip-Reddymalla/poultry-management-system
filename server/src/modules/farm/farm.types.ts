import type { FarmStatus } from "@prisma/client";

export interface SafeFarm {
  id: string;
  code: string;
  name: string;
  status: FarmStatus;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadius?: number | null;
  company: {
    id: string;
    name: string;
    code: string;
  };
}
