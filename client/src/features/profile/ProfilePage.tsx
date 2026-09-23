import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/use-auth.js";
import { EmptyState, Panel } from "../../components/ui.js";
import { AttendancePage } from "../attendance/AttendancePage.js";
import { ProfileHeroCard } from "./ProfileHeroCard.js";
import { ProfileAttendanceStats } from "./ProfileAttendanceStats.js";
import { ProfilePermissionsPanel } from "./ProfilePermissionsPanel.js";
import { ProfileDocumentsPanel } from "./ProfileDocumentsPanel.js";
import { ChangePasswordDialog } from "./ChangePasswordDialog.js";

export function ProfilePage(): React.ReactElement {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);

  if (!user) {
    return (
      <div className="stack">
        <Panel>
          <EmptyState
            title={t("profile.noSession.title")}
            description={t("profile.noSession.description")}
          />
        </Panel>
      </div>
    );
  }

  const canViewAttendance = can("attendance:view");

  return (
    <div className="ph-page">
      {/* ── Hero card ─────────────────────────────────────────── */}
      <ProfileHeroCard
        user={user}
        onChangePassword={() => setChangingPassword(true)}
      />

      {/* ── Attendance analytics (gated on permission) ─────── */}
      {canViewAttendance && user.employee?.id ? (
        <section className="ph-section">
          <div className="ph-section__header">
            <h2 className="ph-section__title">{t("profile.attendanceAnalyticsTitle")}</h2>
            <p className="ph-section__sub">{t("profile.attendanceAnalyticsSub")}</p>
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
            employeeName={user.employee?.name ?? t("attendance.employee")}
          />
        </div>
      </div>

      {/* ── Full attendance history table ─────────────────── */}
      {user.employee?.id ? (
        <section className="ph-section">
          <div className="ph-section__header">
            <h2 className="ph-section__title">{t("profile.attendanceHistoryTitle")}</h2>
            <p className="ph-section__sub">{t("profile.attendanceHistorySub")}</p>
          </div>
          <AttendancePage employeeId={user.employee.id} />
        </section>
      ) : null}

      {changingPassword ? (
        <ChangePasswordDialog
          onClose={() => setChangingPassword(false)}
        />
      ) : null}
    </div>
  );
}
