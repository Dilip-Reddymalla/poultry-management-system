import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client.js";
import {
  deleteEmployee,
  fetchDesignations,
  fetchEmployee,
  setEmployeeActive,
} from "../../api/resources.js";
import type { Designation, Employee } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { ConfirmDialog } from "../../components/Dialog.js";
import {
  Button,
  CardSkeleton,
  DetailList,
  ErrorState,
  Panel,
  StatusTag,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { formatDate } from "../../lib/display.js";
import { EmployeeFormDialog } from "./EmployeeFormDialog.js";
import { ProvisionUserDialog } from "./ProvisionUserDialog.js";
import { ChangeRoleDialog } from "./ChangeRoleDialog.js";

export function EmployeeDetailPage(): React.ReactElement {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const { notify } = useToast();

  const employee = useResource<Employee>(`employee:${id}`, () =>
    fetchEmployee(id),
  );

  const designations = useResource<Designation[]>("designations", () =>
    fetchDesignations(),
  );

  const [editing, setEditing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const record = employee.data;
  const active = record?.status === "ACTIVE";

  const ROLE_HIERARCHY: Record<string, number> = {
    "System Admin": 100,
    "Company Admin": 90,
    "DGM": 80,
    "Assistant Manager": 70,
    "Super Incharge": 65,
    "Incharge": 60,
    "Asst Incharge": 55,
    "Accountant": 50,
    "Accounts Assistant": 45,
    "Stores Executive": 45,
    "Senior Supervisor": 40,
    "Supervisor": 35,
    "AC Supervisor": 35,
    "Maintenance Supervisor": 35,
    "Grading Supervisor": 35,
    "Supervisor - Litter Maintenance": 35,
    "Security Supervisor": 35,
    "Asst Supervisor": 30,
    "AC Asst Supervisor": 30,
    "Asst Supervisor General": 30,
    "Asst Supervisor - Technical": 30,
    "Asst Supervisor - Electrical": 30,
    "Security Head Guard": 20,
    "Senior Driver": 18,
    "Security Guard": 15,
    "Driver": 15,
    "Worker": 10,
  };

  const canDelete = (() => {
    if (!can("employee:delete")) return false;
    if (!record) return false;
    if (user?.employeeId === record.id) return false;
    if (user?.isSystemAdmin) return true;
    const userRoles = user?.roles ?? [];
    const userRank = Math.max(...userRoles.map((r) => ROLE_HIERARCHY[r] ?? 0), 0);
    const targetRank = ROLE_HIERARCHY[record.designation.name] ?? 0;
    return userRank >= targetRank;
  })();

  const canToggle = active
    ? can("employee:deactivate")
    : can("employee:reactivate");

  async function handleDelete(): Promise<void> {
    if (!record) {
      return;
    }

    setDeleteBusy(true);

    try {
      await deleteEmployee(record.id);
      notify("success", `${record.name} deleted.`);
      navigate("/employees");
    } catch (caught) {
      notify(
        "error",
        caught instanceof ApiError ? caught.message : t("employees.failedToDelete"),
      );
      setDeleteBusy(false);
      setConfirmingDelete(false);
    }
  }

  async function handleToggleStatus(): Promise<void> {
    if (!record) {
      return;
    }

    setStatusBusy(true);

    try {
      const updated = await setEmployeeActive(record.id, !active);

      employee.replace(updated);
      notify(
        "success",
        active ? `${updated.name} deactivated.` : `${updated.name} reactivated.`,
      );
      setConfirmingStatus(false);
    } catch (caught) {
      notify(
        "error",
        caught instanceof ApiError ? caught.message : t("error.somethingWentWrong"),
      );
    } finally {
      setStatusBusy(false);
    }
  }

  if (employee.loading) {
    return (
      <div className="stack">
        <PageHeader
          title={t("employees.detail.title")}
          back={{ to: "/employees", label: t("employees.detail.allEmployees") }}
        />
        <Panel>
          <CardSkeleton />
        </Panel>
      </div>
    );
  }

  if (employee.error || !record) {
    return (
      <div className="stack">
        <PageHeader
          title={t("employees.detail.title")}
          back={{ to: "/employees", label: t("employees.detail.allEmployees") }}
        />
        <Panel>
          <ErrorState
            error={employee.error ?? new ApiError(404, "Employee not found.")}
            onRetry={employee.reload}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={record.designation.name}
        title={record.name}
        back={{ to: "/employees", label: t("employees.detail.allEmployees") }}
        actions={
          <>
            {can("attendance:view") ? (
              <Link
                className="button button--secondary"
                to={`/attendance?employeeId=${record.id}`}
              >
                {t("common.attendance")}
              </Link>
            ) : null}
            {can("employee:update") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                {t("common.edit")}
              </Button>
            ) : null}
            {canToggle ? (
              <Button
                variant={active ? "secondary" : "primary"}
                onClick={() => {
                  setConfirmingStatus(true);
                }}
              >
                {active ? t("common.deactivate") : t("common.reactivate")}
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmingDelete(true);
                }}
              >
                {t("common.delete")}
              </Button>
            ) : null}
          </>
        }
      />

      {record.promotedFromWorker ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "rgba(139, 92, 246, 0.08)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>⭐</span>
            <div>
              <span style={{ fontWeight: 600, color: "#6d28d9" }}>
                {t("employees.detail.promotedFromTitle", "Promoted from Farm Worker")}
              </span>
              <span style={{ color: "#6b7280", marginLeft: "8px", fontSize: "0.9rem" }}>
                ({record.promotedFromWorker.workerId})
              </span>
            </div>
          </div>
          <Link
            to={`/workers/${record.promotedFromWorker.id}`}
            className="button button--secondary"
            style={{ fontSize: "0.85rem", padding: "4px 10px" }}
          >
            {t("employees.detail.viewWorkerRecord", "View Historical Worker Record →")}
          </Link>
        </div>
      ) : null}

      <div className="split">
        <Panel title="Record">
          {record.photoUrl ? (
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <img
                src={record.photoUrl}
                alt={record.name}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid var(--primary, #6366f1)",
                }}
              />
            </div>
          ) : null}
          <DetailList
            items={[
              {
                label: t("employees.employeeID"),
                value: <span className="numeric">{record.employeeId}</span>,
              },
              { label: t("employees.designation"), value: record.designation.name },
              {
                label: t("common.farm"),
                value: `${record.farm.code} — ${record.farm.name}`,
              },
              {
                label: t("common.phone"),
                value: record.phone ? (
                  <span className="numeric">{record.phone}</span>
                ) : (
                  <span className="muted">{t("common.notRecorded")}</span>
                ),
              },
              {
                label: t("employees.joined"),
                value: (
                  <span className="numeric">
                    {formatDate(record.joiningDate)}
                  </span>
                ),
              },
              ...(record.promotedFromWorker
                ? [
                    {
                      label: t("employees.detail.careerOrigin", "Origin"),
                      value: (
                        <Link to={`/workers/${record.promotedFromWorker.id}`}>
                          {t("employees.detail.promotedFrom", "Promoted from")} {record.promotedFromWorker.workerId}
                        </Link>
                      ),
                    },
                  ]
                : []),
              { label: t("common.status"), value: <StatusTag status={record.status} /> },
            ]}
          />
        </Panel>

        <Panel
          title="App access"
          actions={
            !record.hasUser && can("user:create") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setProvisioning(true);
                }}
              >
                Create login
              </Button>
            ) : record.hasUser && can("user:update-role") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setChangingRole(true);
                }}
              >
                Change role
              </Button>
            ) : null
          }
        >
          {record.hasUser ? (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <p className="panel__text">
                This employee has a login and can sign in with their email or the phone number on the record.
              </p>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                {record.user?.email ? (
                  <div>
                    <span style={{ color: "var(--color-muted, #64748b)" }}>Email: </span>
                    <strong className="numeric">{record.user.email}</strong>
                  </div>
                ) : null}
                <div>
                  <span style={{ color: "var(--color-muted, #64748b)" }}>Assigned Role: </span>
                  <strong style={{ color: "var(--color-primary-700, #1d4ed8)" }}>
                    {record.user?.roles?.[0]?.name ?? "Configured"}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="panel__text">
              No login yet. Without one they cannot sign in to the app.
            </p>
          )}
        </Panel>
      </div>

      {editing ? (
        <EmployeeFormDialog
          employee={record}
          designations={designations.data ?? []}
          designationsError={designations.error}
          onClose={() => {
            setEditing(false);
          }}
          onSaved={(updated) => {
            employee.replace(updated);
            setEditing(false);
            notify("success", "Employee updated.");
          }}
        />
      ) : null}

      {provisioning ? (
        <ProvisionUserDialog
          employee={record}
          onClose={() => {
            setProvisioning(false);
          }}
          onProvisioned={() => {
            setProvisioning(false);
            notify("success", "Login created.");
            employee.reload();
          }}
        />
      ) : null}

      {changingRole ? (
        <ChangeRoleDialog
          employee={record}
          onClose={() => {
            setChangingRole(false);
          }}
          onSaved={(updated) => {
            employee.replace(updated);
            setChangingRole(false);
            notify("success", "Login role updated successfully.");
          }}
        />
      ) : null}

      {confirmingStatus ? (
        <ConfirmDialog
          title={active ? "Deactivate employee?" : "Reactivate employee?"}
          description={
            active
              ? `${record.name} stays on the register but is marked inactive and cannot sign in.`
              : `${record.name} goes back to active and can be assigned work again.`
          }
          confirmLabel={active ? t("common.deactivate") : t("common.reactivate")}
          confirmVariant={active ? "danger" : "primary"}
          busy={statusBusy}
          onConfirm={() => {
            void handleToggleStatus();
          }}
          onClose={() => {
            setConfirmingStatus(false);
          }}
        />
      ) : null}

      {confirmingDelete && record ? (
        <ConfirmDialog
          title={t("employees.deleteTitle", { name: record.name })}
          description={t("employees.deleteDescription")}
          confirmLabel={t("employees.deleteConfirmLabel")}
          confirmVariant="danger"
          busy={deleteBusy}
          onConfirm={() => {
            void handleDelete();
          }}
          onClose={() => {
            if (!deleteBusy) {
              setConfirmingDelete(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
