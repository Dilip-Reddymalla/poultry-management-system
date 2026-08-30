import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/use-auth.js";
import {
  CalendarIcon,
  CompanyIcon,
  DashboardIcon,
  EggIcon,
  FarmIcon,
  PeopleIcon,
  ProfileIcon,
  ShedIcon,
  WorkerIcon,
} from "../components/icons.js";

interface NavItem {
  to: string;
  label: string;
  /** Permission that makes this section usable; undefined means always. */
  permission?: string;
  systemAdminOnly?: boolean;
  icon: (props: { className?: string }) => React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: DashboardIcon },
  {
    to: "/companies",
    label: "Companies",
    permission: "company:view",
    icon: CompanyIcon,
  },
  { to: "/farms", label: "Farms", permission: "farm:view", icon: FarmIcon },
  { to: "/sheds", label: "Sheds", permission: "shed:view", icon: ShedIcon },
  {
    to: "/employees",
    label: "Employees",
    permission: "employee:view",
    icon: PeopleIcon,
  },
  {
    to: "/workers",
    label: "Workers",
    permission: "worker:view",
    icon: WorkerIcon,
  },
  {
    to: "/attendance/dashboard",
    label: "Att. Dashboard",
    permission: "attendance:view",
    icon: DashboardIcon,
  },
  {
    to: "/attendance",
    label: "Attendance List",
    permission: "attendance:view",
    icon: CalendarIcon,
  },
  {
    to: "/attendance/face",
    label: "Face Attendance",
    permission: "attendance:create",
    icon: PeopleIcon,
  },
  {
    to: "/audit-logs",
    label: "Audit Logs",
    systemAdminOnly: true,
    icon: CalendarIcon,
  },
  { to: "/profile", label: "My profile", icon: ProfileIcon },
];

export function Sidebar({
  onNavigate,
}: {
  onNavigate: () => void;
}): React.ReactElement {
  const { user, can } = useAuth();

  // A section the user cannot read is not shown. The API enforces the same rule.
  const items = NAV_ITEMS.filter((item) => {
    if (item.systemAdminOnly && !user?.isSystemAdmin) return false;
    return item.permission === undefined || can(item.permission);
  });

  return (
    <div className="sidebar">
      <div className="sidebar__brand">
        <EggIcon className="sidebar__mark" />
        <span>
          Poultry<strong>Ops</strong>
        </span>
      </div>

      <nav className="sidebar__nav" aria-label="Sections">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "navlink navlink--active" : "navlink"
            }
            onClick={onNavigate}
          >
            <item.icon className="navlink__icon" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__foot">
        <p className="eyebrow">Signed in as</p>
        <p className="sidebar__user">{user?.employee.name}</p>
        <p className="sidebar__role">{user?.employee.designation.name}</p>
      </div>
    </div>
  );
}
