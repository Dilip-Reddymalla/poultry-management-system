import { useState } from "react";
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
import { AttendanceAvatar } from "../features/attendance/AttendanceAvatar.js";

type NavSection = "overview" | "attendance" | "manage" | "account";

interface NavItem {
  to: string;
  labelKey: string;
  /** Which group the item belongs to; groups are rendered under a heading. */
  section: NavSection;
  /** Permission that makes this item usable; undefined means always. */
  permission?: string;
  systemAdminOnly?: boolean;
  executiveOnly?: boolean;
  operationalOnly?: boolean;
  icon: (props: { className?: string }) => React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { section: "overview", to: "/dashboard", labelKey: "nav.dashboard", icon: DashboardIcon },

  { section: "manage", to: "/companies", labelKey: "nav.companies", permission: "company:view", icon: CompanyIcon },
  { section: "manage", to: "/farms", labelKey: "nav.farms", permission: "farm:view", icon: FarmIcon },
  { section: "manage", to: "/sheds", labelKey: "nav.sheds", permission: "shed:view", icon: ShedIcon },
  { section: "manage", to: "/employees", labelKey: "nav.employees", permission: "employee:view", icon: PeopleIcon },
  { section: "manage", to: "/workers", labelKey: "nav.workers", permission: "worker:view", icon: WorkerIcon },

  // Executive Attendance Report: For Company Admins & System Admin
  { section: "attendance", to: "/attendance/reports", labelKey: "nav.attendanceReport", permission: "report:view", executiveOnly: true, icon: DashboardIcon },
  // Operational Attendance Views: For Farm-level managers/supervisors
  { section: "attendance", to: "/attendance/dashboard", labelKey: "nav.attDashboard", permission: "attendance:view", operationalOnly: true, icon: DashboardIcon },
  { section: "attendance", to: "/attendance", labelKey: "nav.attendanceList", permission: "attendance:view", operationalOnly: true, icon: CalendarIcon },
  { section: "attendance", to: "/attendance/approvals", labelKey: "nav.attendanceApprovals", permission: "attendance:approve", operationalOnly: true, icon: CalendarIcon },
  { section: "attendance", to: "/attendance/face", labelKey: "nav.faceAttendance", permission: "attendance:create", operationalOnly: true, icon: PeopleIcon },

  { section: "account", to: "/audit-logs", labelKey: "nav.auditLogs", systemAdminOnly: true, icon: CalendarIcon },
  { section: "account", to: "/notifications", labelKey: "Notifications", icon: BellIcon },
  { section: "account", to: "/profile", labelKey: "nav.myProfile", icon: ProfileIcon },
];

const SECTION_ORDER: NavSection[] = ["overview", "attendance", "manage", "account"];

const SECTION_LABEL_KEY: Record<NavSection, string> = {
  overview: "nav.sectionMain",
  attendance: "nav.sectionAttendance",
  manage: "nav.sectionManage",
  account: "nav.sectionAccount",
};

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

  // Executive/system roles see the full "Manage" group; operational field roles
  // get it tucked away so the everyday items (Dashboard, Attendance, Account)
  // are what they see first.
  const [manageOpen, setManageOpen] = useState(isExecutive);

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
        {SECTION_ORDER.map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;

          const isManage = section === "manage";
          const collapsed = isManage && !manageOpen;

          return (
            <div className="sidebar__group" key={section}>
              {isManage ? (
                <button
                  type="button"
                  className="sidebar__section"
                  aria-expanded={!collapsed}
                  onClick={() => setManageOpen((open) => !open)}
                >
                  <span>{t(SECTION_LABEL_KEY[section])}</span>
                  <span className="sidebar__section-caret" aria-hidden="true">
                    {collapsed ? "▸" : "▾"}
                  </span>
                </button>
              ) : (
                <p className="sidebar__section">{t(SECTION_LABEL_KEY[section])}</p>
              )}

              {collapsed ? null : (
                <div className="sidebar__section-items">
                  {sectionItems.map((item) => (
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
                </div>
              )}
            </div>
          );
        })}

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

      <div className="sidebar__foot" style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <AttendanceAvatar
          photoUrl={user?.employee.photoUrl ?? null}
          name={user?.employee.name ?? ""}
          type="EMPLOYEE"
          size={36}
        />
        <div style={{ minWidth: 0 }}>
          <p className="sidebar__user" style={{ marginTop: 0 }}>{user?.employee.name}</p>
          <p className="sidebar__role">{user?.employee.designation.name}</p>
        </div>
      </div>
    </div>
  );
}
