export interface Designation {
  id: string;
  name: string;
}

export interface Role {
  id: string;
  name: string;
}

export type ManageableShedStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
export const MANAGEABLE_SHED_STATUSES: ManageableShedStatus[] = ["AVAILABLE", "OCCUPIED", "MAINTENANCE"];
