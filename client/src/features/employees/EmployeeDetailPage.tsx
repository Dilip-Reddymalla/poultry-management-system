import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../api/client.js";
import {
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

export function EmployeeDetailPage(): React.ReactElement {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const { notify } = useToast();

  const employee = useResource<Employee>(`employee:${id}`, () =>
    fetchEmployee(id),
  );

  const designations = useResource<Designation[]>("designations", () =>
    fetchDesignations(),
  );

  const [editing, setEditing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const record = employee.data;
  const active = record?.status === "ACTIVE";

  const canToggle = active
    ? can("employee:deactivate")
    : can("employee:reactivate");

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
        caught instanceof ApiError ? caught.message : "Something went wrong.",
      );
    } finally {
      setStatusBusy(false);
    }
  }

  if (employee.loading) {
    return (
      <div className="stack">
        <PageHeader
          title="Employee"
          back={{ to: "/employees", label: "All employees" }}
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
          title="Employee"
          back={{ to: "/employees", label: "All employees" }}
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
        back={{ to: "/employees", label: "All employees" }}
        actions={
          <>
            {can("attendance:view") ? (
              <Link
                className="button button--secondary"
                to={`/attendance?employeeId=${record.id}`}
              >
                Attendance
              </Link>
            ) : null}
            {can("employee:update") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            ) : null}
            {canToggle ? (
              <Button
                variant={active ? "danger" : "primary"}
                onClick={() => {
                  setConfirmingStatus(true);
                }}
              >
                {active ? "Deactivate" : "Reactivate"}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="split">
        <Panel title="Record">
          <DetailList
            items={[
              {
                label: "Employee ID",
                value: <span className="numeric">{record.employeeId}</span>,
              },
              { label: "Designation", value: record.designation.name },
              {
                label: "Farm",
                value: `${record.farm.code} — ${record.farm.name}`,
              },
              {
                label: "Phone",
                value: record.phone ? (
                  <span className="numeric">{record.phone}</span>
                ) : (
                  <span className="muted">Not recorded</span>
                ),
              },
              {
                label: "Joining date",
                value: (
                  <span className="numeric">
                    {formatDate(record.joiningDate)}
                  </span>
                ),
              },
              { label: "Status", value: <StatusTag status={record.status} /> },
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
            ) : null
          }
        >
          {record.hasUser ? (
            <p className="panel__text">
              This employee has a login and can sign in with their email or the
              phone number on the record.
            </p>
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

      {confirmingStatus ? (
        <ConfirmDialog
          title={active ? "Deactivate employee?" : "Reactivate employee?"}
          description={
            active
              ? `${record.name} stays on the register but is marked inactive and cannot sign in.`
              : `${record.name} goes back to active and can be assigned work again.`
          }
          confirmLabel={active ? "Deactivate" : "Reactivate"}
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
    </div>
  );
}
