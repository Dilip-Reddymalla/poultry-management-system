import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/use-auth.js";
import {
  BellIcon,
  CalendarIcon,
  CompanyIcon,
  DashboardIcon,
  EggIcon,
  FarmIcon,
  InstallIcon,
  PeopleIcon,
  ProfileIcon,
  ShedIcon,
  WorkerIcon,
} from "../components/icons.js";
import { isStandalone } from "../pwa/useInstallPrompt.js";

interface NavItem {
  to: string;
  labelKey: string;
  /** Permission that makes this section usable; undefined means always. */
  permission?: string;
  systemAdminOnly?: boolean;
  executiveOnly?: boolean;
  operationalOnly?: boolean;
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
  // Executive Attendance Report: For Company Admins & System Admin
  {
    to: "/attendance/reports",
    labelKey: "nav.attendanceReport",
    permission: "report:view",
    executiveOnly: true,
    icon: DashboardIcon,
  },
  // Operational Attendance Views: For Farm-level managers/supervisors
  {
    to: "/attendance/dashboard",
    labelKey: "nav.attDashboard",
    permission: "attendance:view",
    operationalOnly: true,
    icon: DashboardIcon,
  },
  {
    to: "/attendance",
    labelKey: "nav.attendanceList",
    permission: "attendance:view",
    operationalOnly: true,
    icon: CalendarIcon,
  },
  {
    to: "/attendance/approvals",
    labelKey: "nav.attendanceApprovals",
    permission: "attendance:approve",
    operationalOnly: true,
    icon: CalendarIcon,
  },
  {
    to: "/attendance/face",
    labelKey: "nav.faceAttendance",
    permission: "attendance:create",
    operationalOnly: true,
    icon: PeopleIcon,
  },
  {
    to: "/audit-logs",
    labelKey: "nav.auditLogs",
    systemAdminOnly: true,
    icon: CalendarIcon,
  },
  {
    to: "/notifications",
    labelKey: "Notifications",
    icon: BellIcon,
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

  const isExecutive = Boolean(user?.isSystemAdmin || user?.scope.level === "COMPANY" || user?.role === "Company Admin");

  // A section the user cannot read is not shown. The API enforces the same rule.
  const items = NAV_ITEMS.filter((item) => {
    if (item.systemAdminOnly && !user?.isSystemAdmin) return false;
    if (item.executiveOnly && !isExecutive) return false;
    if (item.operationalOnly && isExecutive) return false;
    return item.permission === undefined || can(item.permission);
  });

  const companyLogo = user?.company?.logoUrl;
  const companyName = user?.company?.name;

  return (
    <div className="sidebar">
      <div className="sidebar__brand">
        {companyLogo ? (
          <div className="sidebar__mark-badge">
            <img
              src={companyLogo}
              alt={companyName ?? "Company logo"}
              className="sidebar__mark-img"
            />
          </div>
        ) : (
          <EggIcon className="sidebar__mark" />
        )}
        <span className="sidebar__brand-name" title={companyName ?? "PoultryOps"}>
          {companyName ? (
            companyName
          ) : (
            <>
              Poultry<strong>Ops</strong>
            </>
          )}
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

        {!isStandalone() && (
          <NavLink
            to="/install"
            className={({ isActive }) =>
              isActive ? "navlink navlink--active" : "navlink"
            }
            onClick={onNavigate}
          >
            <InstallIcon className="navlink__icon" />
            {t("pwa.installApp")}
          </NavLink>
        )}
      </nav>

      <div className="sidebar__foot">
        <p className="eyebrow">{t("common.signedInAs")}</p>
        <p className="sidebar__user">{user?.employee.name}</p>
        <p className="sidebar__role">{user?.employee.designation.name}</p>
      </div>
    </div>
  );
}
