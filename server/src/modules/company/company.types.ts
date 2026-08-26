import type { FarmStatus } from "@prisma/client";

// A company is the top of the org tree below the System Admin. Only non-sensitive
// fields are exposed; farmCount lets the UI show reach without a second query.
export interface SafeCompany {
  id: string;
  name: string;
  code: string;
  farmCount: number;
}

export interface SafeCompanyFarm {
  id: string;
  code: string;
  name: string;
  status: FarmStatus;
}
