import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** Big 3-way segmented toggle between Password, OTP, and Face login. */
export function AuthMethodTabs(): React.ReactElement {
  const { t } = useTranslation();

  const tabs = [
    { to: "/login", icon: "🔑", label: t("auth.methodTabs.password") },
    { to: "/otp-login", icon: "📱", label: t("auth.methodTabs.otp") },
    { to: "/face-login", icon: "📷", label: t("auth.methodTabs.face") },
  ];

  const tabStyle = {
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  } as const;

  return (
    <nav className="segmented" aria-label={t("auth.methodTabs.ariaLabel")} style={{ marginBottom: "0.75rem" }}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            isActive ? "segmented__item segmented__item--active" : "segmented__item"
          }
          style={tabStyle}
        >
          <span aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
