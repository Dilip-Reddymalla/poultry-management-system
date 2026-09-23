import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
  labelKey: string;
  /** Permission that makes this section usable; undefined means always. */
  permission?: string;
  systemAdminOnly?: boolean;
  icon: (props: { className?: string }) => React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: DashboardIcon },
  {
    to: "/companies",
    labelKey: "nav.companies",
    permission: "company:view",
    icon: CompanyIcon,
  },
  { to: "/farms", labelKey: "nav.farms", permission: "farm:view", icon: FarmIcon },
  { to: "/sheds", labelKey: "nav.sheds", permission: "shed:view", icon: ShedIcon },
  {
    to: "/employees",
    labelKey: "nav.employees",
    permission: "employee:view",
    icon: PeopleIcon,
  },
  {
    to: "/workers",
    labelKey: "nav.workers",
    permission: "worker:view",
    icon: WorkerIcon,
  },
  {
    to: "/attendance/dashboard",
    labelKey: "nav.attDashboard",
    permission: "attendance:view",
    icon: DashboardIcon,
  },
  {
    to: "/attendance",
    labelKey: "nav.attendanceList",
    permission: "attendance:view",
    icon: CalendarIcon,
  },
  {
    to: "/attendance/face",
    labelKey: "nav.faceAttendance",
    permission: "attendance:create",
    icon: PeopleIcon,
  },
  {
    to: "/audit-logs",
    labelKey: "nav.auditLogs",
    systemAdminOnly: true,
    icon: CalendarIcon,
  },
  { to: "/profile", labelKey: "nav.myProfile", icon: ProfileIcon },
];

export function Sidebar({
  onNavigate,
}: {
  onNavigate: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
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

      <nav className="sidebar__nav" aria-label={t("nav.sections")}>
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
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__foot">
        <p className="eyebrow">{t("common.signedInAs")}</p>
        <p className="sidebar__user">{user?.employee.name}</p>
        <p className="sidebar__role">{user?.employee.designation.name}</p>
      </div>
    </div>
  );
}
