import { useAuth } from "../../auth/use-auth.js";
import { EmptyState, Panel } from "../../components/ui.js";
import { AttendancePage } from "../attendance/AttendancePage.js";
import { ProfileHeroCard } from "./ProfileHeroCard.js";
import { ProfileAttendanceStats } from "./ProfileAttendanceStats.js";
import { ProfilePermissionsPanel } from "./ProfilePermissionsPanel.js";
import { ProfileDocumentsPanel } from "./ProfileDocumentsPanel.js";

export function ProfilePage(): React.ReactElement {
  const { user, can } = useAuth();

  if (!user) {
    return (
      <div className="stack">
        <Panel>
          <EmptyState
            title="No session"
            description="Sign in again to see your profile."
          />
        </Panel>
      </div>
    );
  }

  const canViewAttendance = can("attendance:view");

  return (
    <div className="ph-page">
      {/* ── Hero card ─────────────────────────────────────────── */}
      <ProfileHeroCard user={user} />

      {/* ── Attendance analytics (gated on permission) ─────── */}
      {canViewAttendance && user.employee?.id ? (
        <section className="ph-section">
          <div className="ph-section__header">
            <h2 className="ph-section__title">Attendance Analytics</h2>
            <p className="ph-section__sub">Your last 30 days at a glance</p>
          </div>
          <ProfileAttendanceStats employeeId={user.employee.id} />
        </section>
      ) : null}

      {/* ── Bottom two-column grid ─────────────────────────── */}
      <div className="ph-bottom-grid">
        <div className="ph-bottom-grid__left">
          <ProfilePermissionsPanel permissions={user.permissions} />
        </div>
        <div className="ph-bottom-grid__right">
          <ProfileDocumentsPanel
            photoUrl={user.employee?.photoUrl ?? null}
            employeeName={user.employee?.name ?? "Employee"}
          />
        </div>
      </div>

      {/* ── Full attendance history table ─────────────────── */}
      {user.employee?.id ? (
        <section className="ph-section">
          <div className="ph-section__header">
            <h2 className="ph-section__title">Attendance History</h2>
            <p className="ph-section__sub">Full record of your attendance entries</p>
          </div>
          <AttendancePage employeeId={user.employee.id} />
        </section>
      ) : null}
    </div>
  );
}
