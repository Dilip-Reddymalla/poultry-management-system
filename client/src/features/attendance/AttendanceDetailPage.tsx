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
import { AttendanceAvatar } from "./AttendanceDashboardPage.js";

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
                value: (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <AttendanceAvatar
                      photoUrl={record.person.photoUrl}
                      name={record.person.name}
                      type={record.person.type}
                      size={42}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{record.person.name}</div>
                      <span className="table__sub numeric">{record.person.code}</span>
                    </div>
                  </div>
                ),
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
                label: "Shed / Location",
                value: record.shed?.number ? (
                  <span className="numeric">
                    {record.shed.number.toLowerCase().includes("ac room")
                      ? "❄️ AC Room"
                      : record.shed.number.toLowerCase().startsWith("shed")
                      ? record.shed.number.replace("-", " ")
                      : `Shed ${record.shed.number}`}
                  </span>
                ) : (
                  <span className="muted">General / Staff</span>
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
              ...(record.verificationMode
                ? [
                    {
                      label: "Verification",
                      value: (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" as const }}>
                          <span
                            className="tag"
                            style={{
                              background: record.verificationMode === "FACE_AI" ? "#e8f0fe" : "var(--surface-sunk)",
                              color: record.verificationMode === "FACE_AI" ? "#1f4d8f" : "inherit",
                              fontWeight: 600,
                            }}
                          >
                            {record.verificationMode === "FACE_AI"
                              ? `📸 Face AI ${record.confidenceScore ? `(${Math.round(record.confidenceScore)}%)` : ""}`
                              : record.verificationMode}
                          </span>
                          {record.snapshotUrl && (
                            <a
                              href={record.snapshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="button button--ghost"
                              style={{ padding: "2px 8px", fontSize: "0.75rem", minHeight: "22px" }}
                            >
                              🔍 View Verification Snapshot ↗
                            </a>
                          )}
                        </div>
                      ),
                    },
                  ]
                : []),
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
