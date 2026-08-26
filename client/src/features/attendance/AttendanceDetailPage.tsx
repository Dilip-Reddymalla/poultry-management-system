import { useState } from "react";
import { useParams } from "react-router-dom";

import { ApiError } from "../../api/client.js";
import { approveAttendance, fetchAttendanceRecord } from "../../api/resources.js";
import type { Attendance } from "../../api/types.js";
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
import { formatDate, statusLabel } from "../../lib/display.js";
import { AttendanceCorrectionDialog } from "./AttendanceCorrectionDialog.js";

export function AttendanceDetailPage(): React.ReactElement {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const { notify } = useToast();

  const attendance = useResource<Attendance>(`attendance:${id}`, () =>
    fetchAttendanceRecord(id),
  );

  const [correcting, setCorrecting] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);

  const record = attendance.data;

  async function handleApprove(): Promise<void> {
    if (!record) {
      return;
    }

    setApproveBusy(true);

    try {
      const updated = await approveAttendance(record.id);

      attendance.replace(updated);
      notify("success", "Attendance approved.");
      setConfirmingApprove(false);
    } catch (caught) {
      notify(
        "error",
        caught instanceof ApiError ? caught.message : "Something went wrong.",
      );
    } finally {
      setApproveBusy(false);
    }
  }

  if (attendance.loading) {
    return (
      <div className="stack">
        <PageHeader
          title="Attendance"
          back={{ to: "/attendance", label: "All attendance" }}
        />
        <Panel>
          <CardSkeleton />
        </Panel>
      </div>
    );
  }

  if (attendance.error || !record) {
    return (
      <div className="stack">
        <PageHeader
          title="Attendance"
          back={{ to: "/attendance", label: "All attendance" }}
        />
        <Panel>
          <ErrorState
            error={attendance.error ?? new ApiError(404, "Record not found.")}
            onRetry={attendance.reload}
          />
        </Panel>
      </div>
    );
  }

  const approved = record.approvedAt !== null;
  // Approval is a review of what is on file, so it only makes sense once and
  // only when the record is not already approved.
  const canApprove = can("attendance:approve") && !approved;

  return (
    <div className="stack">
      <PageHeader
        eyebrow={record.person.type === "EMPLOYEE" ? "Employee" : "Worker"}
        title={record.person.name}
        description={`${formatDate(record.date)} · ${record.farm.code} — ${record.farm.name}`}
        back={{ to: "/attendance", label: "All attendance" }}
        actions={
          <>
            {can("attendance:update") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setCorrecting(true);
                }}
              >
                Correct
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmingApprove(true);
                }}
              >
                Approve
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
                label: "Person",
                value: `${record.person.name} · ${record.person.code}`,
              },
              {
                label: "Type",
                value: record.person.type === "EMPLOYEE" ? "Employee" : "Worker",
              },
              {
                label: "Farm",
                value: `${record.farm.code} — ${record.farm.name}`,
              },
              {
                label: "Shed",
                value: record.shed?.number ? (
                  <span className="numeric">Shed {record.shed.number}</span>
                ) : (
                  <span className="muted">None / General</span>
                ),
              },
              {
                label: "Date",
                value: <span className="numeric">{formatDate(record.date)}</span>,
              },
              { label: "Status", value: <StatusTag status={record.status} /> },
              {
                label: "Shift",
                value: (
                  <span className="numeric">{statusLabel(record.shift)}</span>
                ),
              },
              {
                label: "Location (GPS)",
                value:
                  record.latitude != null && record.longitude != null ? (
                    <span className="numeric">
                      {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
                    </span>
                  ) : (
                    <span className="muted">Not recorded</span>
                  ),
              },
              {
                label: "Notes",
                value: record.notes ? (
                  record.notes
                ) : (
                  <span className="muted">None</span>
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="Review">
          <DetailList
            items={[
              {
                label: "Recorded by",
                value: record.recordedBy ? (
                  record.recordedBy.name
                ) : (
                  <span className="muted">System Admin</span>
                ),
              },
              {
                label: "Approval",
                value: approved ? (
                  "Approved"
                ) : (
                  <span className="muted">Pending</span>
                ),
              },
              {
                label: "Approved by",
                value: record.approvedBy ? (
                  record.approvedBy.name
                ) : (
                  <span className="muted">—</span>
                ),
              },
              {
                label: "Approved at",
                value: record.approvedAt ? (
                  <span className="numeric">{formatDate(record.approvedAt)}</span>
                ) : (
                  <span className="muted">—</span>
                ),
              },
            ]}
          />
          <p className="panel__text" style={{ marginTop: "var(--space-4)" }}>
            {approved
              ? "This record is approved. A correction reopens it for review."
              : "Correcting the times or status keeps this pending until a manager approves it."}
          </p>
        </Panel>
      </div>

      {correcting ? (
        <AttendanceCorrectionDialog
          record={record}
          onClose={() => {
            setCorrecting(false);
          }}
          onSaved={(updated) => {
            attendance.replace(updated);
            setCorrecting(false);
            notify("success", "Attendance corrected.");
          }}
        />
      ) : null}

      {confirmingApprove ? (
        <ConfirmDialog
          title="Approve attendance?"
          description={`Marks ${record.person.name}'s record for ${formatDate(record.date)} as reviewed and final. A later correction reopens it.`}
          confirmLabel="Approve"
          confirmVariant="primary"
          busy={approveBusy}
          onConfirm={() => {
            void handleApprove();
          }}
          onClose={() => {
            setConfirmingApprove(false);
          }}
        />
      ) : null}
    </div>
  );
}
