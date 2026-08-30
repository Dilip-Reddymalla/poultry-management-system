import { Navigate, Route, Routes } from "react-router-dom";

import { AttendanceDashboardPage } from "./features/attendance/AttendanceDashboardPage.js";
import { AttendanceDetailPage } from "./features/attendance/AttendanceDetailPage.js";
import { AttendancePage } from "./features/attendance/AttendancePage.js";
import { FaceAttendancePage } from "./features/attendance/FaceAttendancePage.js";
import { AuditLogsPage } from "./features/audit/AuditLogsPage.js";
import { LoginPage } from "./features/auth/LoginPage.js";
import { OtpLoginPage } from "./features/auth/OtpLoginPage.js";
import { SetPasswordPage } from "./features/auth/SetPasswordPage.js";
import { CompaniesPage } from "./features/companies/CompaniesPage.js";
import { CompanyDetailPage } from "./features/companies/CompanyDetailPage.js";
import { DashboardPage } from "./features/dashboard/DashboardPage.js";
import { EmployeeDetailPage } from "./features/employees/EmployeeDetailPage.js";
import { EmployeesPage } from "./features/employees/EmployeesPage.js";
import { FarmDetailPage } from "./features/farms/FarmDetailPage.js";
import { FarmsPage } from "./features/farms/FarmsPage.js";
import { ProfilePage } from "./features/profile/ProfilePage.js";
import { ShedDetailPage } from "./features/sheds/ShedDetailPage.js";
import { ShedsPage } from "./features/sheds/ShedsPage.js";
import { WorkerDetailPage } from "./features/workers/WorkerDetailPage.js";
import { WorkersPage } from "./features/workers/WorkersPage.js";
import { AppLayout } from "./layout/AppLayout.js";
import { NotFoundPage } from "./routes/NotFoundPage.js";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequirePasswordPending,
  RequirePasswordSet,
  RequirePermission,
} from "./routes/guards.js";

/**
 * The hierarchy the backend serves: companies own farms, farms own sheds,
 * employees, workers and attendance. Every screen behind a permission gate; the
 * backend enforces scope on top of that.
 */
export default function App(): React.ReactElement {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/otp-login" element={<OtpLoginPage />} />
      </Route>

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
              path="/attendance/dashboard"
              element={
                <RequirePermission permission="attendance:view">
                  <AttendanceDashboardPage />
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
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
