import type { FarmStatus } from "@prisma/client";

export interface SafeFarm {
  id: string;
  code: string;
  name: string;
  status: FarmStatus;
  company: {
    id: string;
    name: string;
    code: string;
  };
}
