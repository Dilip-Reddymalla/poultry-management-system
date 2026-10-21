export const ROLE_HIERARCHY: Record<string, number> = {
  // Global / Executive
  "System Admin": 100,
  "CEO": 95,
  "Company Admin": 90,
  "GM": 85,
  "DGM": 80,
  "Assistant Manager": 70,

  // Incharge Level
  "Super Incharge": 65,
  "Incharge": 60,
  "Asst Incharge": 55,

  // Finance & Administration
  "Accountant": 50,
  "Accounts Assistant": 45,
  "Stores Executive": 45,

  // Supervisory Level
  "Senior Supervisor": 40,
  "Supervisor": 35,
  "AC Supervisor": 35,
  "Maintenance Supervisor": 35,
  "Grading Supervisor": 35,
  "Supervisor - Litter Maintenance": 35,
  "Security Supervisor": 35,

  // Assistant Supervisors
  "Asst Supervisor": 30,
  "AC Asst Supervisor": 30,
  "Asst Supervisor General": 30,
  "Asst Supervisor - Technical": 30,
  "Asst Supervisor - Electrical": 30,

  // Security & Logistics Staff
  "Security Head Guard": 20,
  "Senior Driver": 18,
  "Security Guard": 15,
  "Driver": 15,

  // Workers
  "Worker": 10,
};

export function getActorRank(user: { isSystemAdmin?: boolean; roles?: string[]; role?: string } | null): number {
  if (!user) return 0;
  if (user.isSystemAdmin) return 100;
  const roles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
  return Math.max(...roles.map((r) => ROLE_HIERARCHY[r] ?? 0), 0);
}
