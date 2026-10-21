import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

import { AppLayout } from "./layout/AppLayout.js";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequirePasswordPending,
  RequirePasswordSet,
  RequirePermission,
} from "./routes/guards.js";

// Lazy-loaded routes for optimal on-demand chunking and stylesheet loading
const AttendanceDashboardPage = lazy(() =>
  import("./features/attendance/AttendanceDashboardPage.js").then((m) => ({ default: m.AttendanceDashboardPage }))
);
const AttendanceReportPage = lazy(() =>
  import("./features/attendance/CompanyAttendanceReportPage.js").then((m) => ({ default: m.AttendanceReportPage }))
);
const AttendanceApprovalsPage = lazy(() =>
  import("./features/attendance/AttendanceApprovalsPage.js").then((m) => ({ default: m.AttendanceApprovalsPage }))
);
const AttendanceDetailPage = lazy(() =>
  import("./features/attendance/AttendanceDetailPage.js").then((m) => ({ default: m.AttendanceDetailPage }))
);
const AttendancePage = lazy(() =>
  import("./features/attendance/AttendancePage.js").then((m) => ({ default: m.AttendancePage }))
);
const FaceAttendancePage = lazy(() =>
  import("./features/attendance/FaceAttendancePage.js").then((m) => ({ default: m.FaceAttendancePage }))
);
const AnalyticsPage = lazy(() =>
  import("./features/analytics/AnalyticsPage.js").then((m) => ({ default: m.AnalyticsPage }))
);
const FaceAiDemoPage = lazy(() =>
  import("./features/face-ai/FaceAiDemoPage.js").then((m) => ({ default: m.FaceAiDemoPage }))
);
const AboutPage = lazy(() =>
  import("./features/about/AboutPage.js").then((m) => ({ default: m.AboutPage }))
);
const AuditLogsPage = lazy(() =>
  import("./features/audit/AuditLogsPage.js").then((m) => ({ default: m.AuditLogsPage }))
);
const NotificationsDashboardPage = lazy(() =>
  import("./features/notifications/NotificationsDashboardPage.js").then((m) => ({
    default: m.NotificationsDashboardPage,
  }))
);
const LoginPage = lazy(() =>
  import("./features/auth/LoginPage.js").then((m) => ({ default: m.LoginPage }))
);
const OtpLoginPage = lazy(() =>
  import("./features/auth/OtpLoginPage.js").then((m) => ({ default: m.OtpLoginPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("./features/auth/ForgotPasswordPage.js").then((m) => ({ default: m.ForgotPasswordPage }))
);
const SetPasswordPage = lazy(() =>
  import("./features/auth/SetPasswordPage.js").then((m) => ({ default: m.SetPasswordPage }))
);
const CompaniesPage = lazy(() =>
  import("./features/companies/CompaniesPage.js").then((m) => ({ default: m.CompaniesPage }))
);
const CompanyDetailPage = lazy(() =>
  import("./features/companies/CompanyDetailPage.js").then((m) => ({ default: m.CompanyDetailPage }))
);
const DashboardPage = lazy(() =>
  import("./features/dashboard/DashboardPage.js").then((m) => ({ default: m.DashboardPage }))
);
const EmployeeDetailPage = lazy(() =>
  import("./features/employees/EmployeeDetailPage.js").then((m) => ({ default: m.EmployeeDetailPage }))
);
const EmployeesPage = lazy(() =>
  import("./features/employees/EmployeesPage.js").then((m) => ({ default: m.EmployeesPage }))
);
const FarmDetailPage = lazy(() =>
  import("./features/farms/FarmDetailPage.js").then((m) => ({ default: m.FarmDetailPage }))
);
const FarmsPage = lazy(() =>
  import("./features/farms/FarmsPage.js").then((m) => ({ default: m.FarmsPage }))
);
const ProfilePage = lazy(() =>
  import("./features/profile/ProfilePage.js").then((m) => ({ default: m.ProfilePage }))
);
const ShedDetailPage = lazy(() =>
  import("./features/sheds/ShedDetailPage.js").then((m) => ({ default: m.ShedDetailPage }))
);
const ShedsPage = lazy(() =>
  import("./features/sheds/ShedsPage.js").then((m) => ({ default: m.ShedsPage }))
);
const WorkerDetailPage = lazy(() =>
  import("./features/workers/WorkerDetailPage.js").then((m) => ({ default: m.WorkerDetailPage }))
);
const WorkersPage = lazy(() =>
  import("./features/workers/WorkersPage.js").then((m) => ({ default: m.WorkersPage }))
);
const NotFoundPage = lazy(() =>
  import("./routes/NotFoundPage.js").then((m) => ({ default: m.NotFoundPage }))
);

function RouteLoadingFallback(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "180px",
        padding: "2rem",
      }}
    >
      <div
        className="skeleton"
        style={{
          width: "120px",
          height: "16px",
          borderRadius: "4px",
        }}
      />
    </div>
  );
}

/**
 * The hierarchy the backend serves: companies own farms, farms own sheds,
 * employees, workers and attendance. Every screen behind a permission gate; the
 * backend enforces scope on top of that.
 */
export default function App(): React.ReactElement {
  return (
    <>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/otp-login" element={<OtpLoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Publicly accessible analytics, Face AI interactive demo, and project about page */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/face-ai-demo" element={<FaceAiDemoPage />} />

          <Route element={<ProtectedRoute />}>
            {/* Set-password stands alone, full screen: a provisioned account owes a
              password before it may reach any app route, and this screen is the
              only place it is let in. */}
            <Route element={<RequirePasswordPending />}>
              <Route path="/set-password" element={<SetPasswordPage />} />
            </Route>

            {/* Everything else is blocked until that password is set. */}
            <Route element={<RequirePasswordSet />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                <Route
                  path="/companies"
                  element={
                    <RequirePermission permission="company:view">
                      <CompaniesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/companies/:id"
                  element={
                    <RequirePermission permission="company:view">
                      <CompanyDetailPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/farms"
                  element={
                    <RequirePermission permission="farm:view">
                      <FarmsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/farms/:id"
                  element={
                    <RequirePermission permission="farm:view">
                      <FarmDetailPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/sheds"
                  element={
                    <RequirePermission permission="shed:view">
                      <ShedsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/sheds/:id"
                  element={
                    <RequirePermission permission="shed:view">
                      <ShedDetailPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/employees"
                  element={
                    <RequirePermission permission="employee:view">
                      <EmployeesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/employees/:id"
                  element={
                    <RequirePermission permission="employee:view">
                      <EmployeeDetailPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/workers"
                  element={
                    <RequirePermission permission="worker:view">
                      <WorkersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/workers/:id"
                  element={
                    <RequirePermission permission="worker:view">
                      <WorkerDetailPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/attendance/reports"
                  element={
                    <RequirePermission permission="report:view">
                      <AttendanceReportPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/attendance/dashboard"
                  element={
                    <RequirePermission permission="attendance:view">
                      <AttendanceDashboardPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/attendance/approvals"
                  element={
                    <RequirePermission permission="attendance:approve">
                      <AttendanceApprovalsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <RequirePermission permission="attendance:view">
                      <AttendancePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/attendance/face"
                  element={
                    <RequirePermission permission="attendance:create">
                      <FaceAttendancePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/attendance/:id"
                  element={
                    <RequirePermission permission="attendance:view">
                      <AttendanceDetailPage />
                    </RequirePermission>
                  }
                />

                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/notifications" element={<NotificationsDashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Analytics />
    </>
  );
}
