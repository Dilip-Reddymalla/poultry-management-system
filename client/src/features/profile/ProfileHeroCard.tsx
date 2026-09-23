import { useTranslation } from "react-i18next";
import type { SessionUser } from "../../api/types.js";
import { initials } from "../../lib/display.js";

const SCOPE_LABEL: Record<string, string> = {
  FARM: "Farm",
  COMPANY: "Company",
  GLOBAL: "Global",
};

interface Props {
  user: SessionUser;
  onChangePassword?: () => void;
}

export function ProfileHeroCard({ user, onChangePassword }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { employee, email, employeeId, scope, roles } = user;

  return (
    <div className="ph-hero">
      {/* Background gradient decoration */}
      <div className="ph-hero__bg" aria-hidden="true" />

      <div className="ph-hero__inner">
        {/* Avatar */}
        <div className="ph-hero__avatar-wrap">
          {employee.photoUrl ? (
            <img
              className="ph-hero__photo"
              src={employee.photoUrl}
              alt={employee.name}
            />
          ) : (
            <span className="ph-hero__initials" aria-hidden="true">
              {initials(employee.name)}
            </span>
          )}
          {/* Online / active indicator */}
          <span className="ph-hero__status-dot" title={t("common.active")} />
        </div>

        {/* Identity */}
        <div className="ph-hero__identity">
          <h1 className="ph-hero__name">{employee.name}</h1>
          <p className="ph-hero__designation">{employee.designation.name}</p>

          {/* Role pills */}
          {roles.length > 0 && (
            <div className="ph-hero__roles">
              {roles.map((r) => (
                <span key={r} className="ph-hero__role-pill">
                  {r.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side meta */}
        <div className="ph-hero__meta">
          <span className={`ph-hero__scope-badge ph-hero__scope-badge--${scope.level.toLowerCase()}`}>
            {t("profile.scopeLabel", { scope: SCOPE_LABEL[scope.level] ?? scope.level })}
          </span>


          <dl className="ph-hero__detail-list">
            <div className="ph-hero__detail">
              <dt>{t("profile.employeeID")}</dt>
              <dd className="numeric">{employeeId ?? "—"}</dd>
            </div>
            <div className="ph-hero__detail">
              <dt>{t("profile.email")}</dt>
              <dd>{email}</dd>
            </div>
            {employee.phone && (
              <div className="ph-hero__detail">
                <dt>{t("profile.phone")}</dt>
                <dd>{employee.phone}</dd>
              </div>
            )}
            {employee.joiningDate && (
              <div className="ph-hero__detail">
                <dt>{t("profile.joined")}</dt>
                <dd>
                  {new Date(employee.joiningDate).toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
            )}
          </dl>

          {!user.isSystemAdmin && onChangePassword && (
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="button button--secondary"
                onClick={onChangePassword}
                style={{
                  fontSize: "0.85rem",
                  padding: "0.4rem 0.85rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {t("profile.changePassword")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
