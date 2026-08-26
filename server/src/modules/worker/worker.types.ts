import type { WorkerStatus } from "@prisma/client";

// A worker is an operational person with no login. Only non-sensitive fields are
// exposed; a worker never has a user/role, so none can appear here.
export interface SafeWorker {
  id: string;
  workerId: string;
  name: string;
  phone: string | null;
  status: WorkerStatus;
  farm: {
    id: string;
    code: string;
    name: string;
  };
}

export interface WorkerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
