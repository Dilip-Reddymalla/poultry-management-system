import type { EmployeeStatus } from "@prisma/client";

export interface SafeEmployee {
  id: string;
  employeeId: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  joiningDate: Date | null;
  status: EmployeeStatus;
  designation: {
    id: string;
    name: string;
  };
  hasUser: boolean;
}

export interface EmployeePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
