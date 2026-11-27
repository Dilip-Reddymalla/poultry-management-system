import { NavLink } from "react-router-dom";

/** Big 3-way segmented toggle between Password, OTP, and Face login. */
export function AuthMethodTabs(): React.ReactElement {
  return (
    <nav className="segmented" aria-label="Sign-in method" style={{ marginBottom: "0.75rem" }}>
      <NavLink
        to="/login"
        className={({ isActive }) =>
          isActive ? "segmented__item segmented__item--active" : "segmented__item"
        }
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 44,
        }}
      >
        <span>🔑</span>
        <span>Password</span>
      </NavLink>
      <NavLink
        to="/otp-login"
        className={({ isActive }) =>
          isActive ? "segmented__item segmented__item--active" : "segmented__item"
        }
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 44,
        }}
      >
        <span>📱</span>
        <span>OTP</span>
      </NavLink>
      <NavLink
        to="/face-login"
        className={({ isActive }) =>
          isActive ? "segmented__item segmented__item--active" : "segmented__item"
        }
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 44,
        }}
      >
        <span>📷</span>
        <span>Face</span>
      </NavLink>
    </nav>
  );
}
