import type { ShedStatus } from "@prisma/client";

export interface SafeShed {
  id: string;
  number: string;
  capacity: number;
  status: ShedStatus;
  farm: {
    id: string;
    code: string;
    name: string;
  };
}
