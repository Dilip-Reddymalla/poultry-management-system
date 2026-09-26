import { Link } from "react-router-dom";
import type { Attendance, Shed, Shift } from "../../api/types.js";
import { statusLabel, formatDate } from "../../lib/display.js";
import { EmptyState, Panel, StatusTag, Button } from "../../components/ui.js";
import { AttendanceAvatar } from "./AttendanceAvatar.js";
import { SHIFT_CONFIG, type SnapshotPreviewData } from "./attendance-dashboard-types.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

export function AttendanceRosterTable({
  records,
  allRecords,
  shedList,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  selectedShedId,
  onShedChange,
  dashboardShift,
  onShiftChange,
  onResetAllFilters,
  loading,
  date,
  canApprove,
  approvingId,
  onApproveSingle,
  onSnapshotPreview,
  isMobile: isMobileProp,
}: {
  records: Attendance[];
  allRecords: Attendance[];
  shedList: Shed[];
  activeTab: "ALL" | "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "FACE_AI" | "PENDING";
  onTabChange: (tab: "ALL" | "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "FACE_AI" | "PENDING") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedShedId: string;
  onShedChange: (shedId: string) => void;
  dashboardShift: Shift | "";
  onShiftChange: (shift: Shift | "") => void;
  onResetAllFilters: () => void;
  loading: boolean;
  date: string;
  canApprove: boolean;
  approvingId: string | null;
  onApproveSingle: (recordId: string) => void;
  onSnapshotPreview: (preview: SnapshotPreviewData) => void;
  isMobile?: boolean;
}): React.ReactElement {
  const isMobile = isMobileProp ?? useIsMobile();

  return (
    <Panel bleed>
      {/* Table Filters & Tab Row */}
      <div style={{ padding: isMobile ? "0.5rem 0.75rem" : "0.75rem 1.25rem", borderBottom: "1px solid var(--line)", background: "var(--surface-sunk)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: isMobile ? "0.5rem" : "1rem" }}>
          {/* Status Filter Tabs */}
          <div
            style={{
              display: "flex",
              gap: "0.25rem",
              overflowX: "auto",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              width: isMobile ? "100%" : "auto",
              paddingBottom: "2px",
            }}
          >
            <button
              type="button"
              className={`button ${activeTab === "ALL" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "26px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              onClick={() => onTabChange("ALL")}
            >
              All ({records.length})
            </button>
            <button
              type="button"
              className={`button ${activeTab === "PRESENT" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "26px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              onClick={() => onTabChange("PRESENT")}
            >
              🟢 Present ({allRecords.filter((r) => r.status === "PRESENT").length})
            </button>
            <button
              type="button"
              className={`button ${activeTab === "HALF_DAY" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "26px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              onClick={() => onTabChange("HALF_DAY")}
            >
              🟠 Half-Day ({allRecords.filter((r) => r.status === "HALF_DAY").length})
            </button>
            <button
              type="button"
              className={`button ${activeTab === "ABSENT" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "26px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              onClick={() => onTabChange("ABSENT")}
            >
              🔴 Absent ({allRecords.filter((r) => r.status === "ABSENT").length})
            </button>
            <button
              type="button"
              className={`button ${activeTab === "LEAVE" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "26px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              onClick={() => onTabChange("LEAVE")}
            >
              ⚪ Leave ({allRecords.filter((r) => r.status === "LEAVE").length})
            </button>
            <button
              type="button"
              className={`button ${activeTab === "FACE_AI" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "26px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              onClick={() => onTabChange("FACE_AI")}
            >
              🤖 Face AI ({allRecords.filter((r) => r.verificationMode === "FACE_AI").length})
            </button>
            <button
              type="button"
              className={`button ${activeTab === "PENDING" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "26px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              onClick={() => onTabChange("PENDING")}
            >
              ✍️ Pending ({allRecords.filter((r) => !r.approvedAt).length})
            </button>
          </div>

          {/* Quick Search */}
          <div style={{ minWidth: isMobile ? "100%" : "220px", flex: isMobile ? "1 1 100%" : "0 1 280px" }}>
            <input
              type="text"
              className="input"
              placeholder="Search by name, code, notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ padding: "0.35rem 0.65rem", fontSize: "0.82rem", width: "100%" }}
            />
          </div>
        </div>

        {/* Active Context Filter Indicators */}
        {(selectedShedId || dashboardShift) && (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem", fontSize: "0.8rem", flexWrap: "wrap" }}>
            <span className="muted">Filtered by:</span>
            {selectedShedId && (
              <span className="tag" style={{ background: "var(--paper)", fontSize: "0.75rem" }}>
                Shed: {selectedShedId === "unassigned"
                  ? "General / Staff"
                  : (() => {
                      const num = shedList.find((s) => s.id === selectedShedId)?.number;
                      if (!num) return selectedShedId;
                      if (num.toLowerCase().includes("ac room")) return "❄️ AC Room";
                      return num.toLowerCase().startsWith("shed") ? num.replace("-", " ") : `Shed ${num}`;
                    })()}
                <button
                  type="button"
                  onClick={() => onShedChange("")}
                  style={{ border: "none", background: "transparent", cursor: "pointer", marginLeft: "4px" }}
                >
                  ✕
                </button>
              </span>
            )}
            {dashboardShift && (
              <span className="tag" style={{ background: "var(--paper)", fontSize: "0.75rem", borderColor: SHIFT_CONFIG[dashboardShift].color }}>
                Shift: {SHIFT_CONFIG[dashboardShift].icon} {statusLabel(dashboardShift)}
                <button
                  type="button"
                  onClick={() => onShiftChange("")}
                  style={{ border: "none", background: "transparent", cursor: "pointer", marginLeft: "4px" }}
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              className="button button--ghost"
              style={{ padding: "1px 6px", fontSize: "0.75rem", minHeight: "20px" }}
              onClick={onResetAllFilters}
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Table Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-soft)" }}>
          Loading attendance records...
        </div>
      ) : records.length === 0 ? (
        <div className="panel__pad">
          <EmptyState
            title="No matching attendance records"
            description={`No records found for ${formatDate(date)} with the selected filters.`}
            action={
              <Button variant="secondary" onClick={onResetAllFilters}>
                Clear Filters
              </Button>
            }
          />
        </div>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem" }}>
          {records.map((record) => {
            const isPending = !record.approvedAt;
            const isFaceAi = record.verificationMode === "FACE_AI";
            const statusBorderColor =
              record.status === "PRESENT"
                ? "var(--moss)"
                : record.status === "ABSENT"
                ? "var(--rust)"
                : record.status === "HALF_DAY"
                ? "var(--clay)"
                : "var(--ink-faint)";

            return (
              <div
                key={record.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderLeft: `4px solid ${statusBorderColor}`,
                  borderRadius: "var(--radius)",
                  padding: "0.55rem 0.65rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Header row: Person & Status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                    <AttendanceAvatar
                      photoUrl={record.person.photoUrl}
                      name={record.person.name}
                      type={record.person.type}
                      size={32}
                      onPreview={
                        record.person.photoUrl
                          ? () =>
                              onSnapshotPreview({
                                url: record.person.photoUrl!,
                                name: record.person.name,
                                title: `${record.person.type === "EMPLOYEE" ? "Employee" : "Worker"} Profile Photo`,
                              })
                          : undefined
                      }
                    />
                    <div style={{ minWidth: 0 }}>
                      <Link
                        className="table__link"
                        to={`/attendance/${record.id}`}
                        style={{ fontWeight: 700, fontSize: "0.85rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {record.person.name}
                      </Link>
                      <div className="table__sub numeric" style={{ fontSize: "0.7rem" }}>
                        {record.person.type === "EMPLOYEE" ? "👔 Employee" : "🚜 Worker"} · {record.person.code}
                      </div>
                    </div>
                  </div>
                  <StatusTag status={record.status} />
                </div>

                {/* Meta row: Station & Shift & Time */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
                  {record.shed?.number ? (
                    <span className="tag" style={{ background: "var(--surface-sunk)", fontWeight: 600, fontSize: "0.7rem", padding: "1px 5px" }}>
                      {record.shed.number.toLowerCase().includes("ac room")
                        ? "❄️ AC Room"
                        : record.shed.number.toLowerCase().startsWith("shed")
                        ? record.shed.number.replace("-", " ")
                        : `Shed ${record.shed.number}`}
                    </span>
                  ) : (
                    <span className="tag" style={{ background: "var(--surface-sunk)", fontSize: "0.7rem", padding: "1px 5px" }}>
                      General / Staff
                    </span>
                  )}

                  <span className="tag" style={{ background: "var(--surface-sunk)", borderColor: SHIFT_CONFIG[record.shift]?.color, fontSize: "0.7rem", padding: "1px 5px" }}>
                    {SHIFT_CONFIG[record.shift]?.icon} {statusLabel(record.shift)}
                  </span>

                  {record.createdAt && (
                    <span className="muted" style={{ fontSize: "0.7rem", marginLeft: "auto" }}>
                      🕒 {new Date(record.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                {/* Footer row: Verification & Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.25rem", borderTop: "1px dashed var(--line)", fontSize: "0.72rem", gap: "0.4rem" }}>
                  <div>
                    {isFaceAi ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span
                          className="tag"
                          style={{
                            background: "#e8f0fe",
                            borderColor: "#c2d7ff",
                            color: "#1f4d8f",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            padding: "1px 4px",
                          }}
                        >
                          📸 {record.confidenceScore ? `${Math.round(record.confidenceScore)}%` : "Face AI"}
                        </span>
                        {record.snapshotUrl && (
                          <button
                            type="button"
                            className="button button--ghost"
                            style={{ padding: "0 3px", fontSize: "0.65rem", minHeight: "18px" }}
                            onClick={() =>
                              onSnapshotPreview({
                                url: record.snapshotUrl!,
                                name: record.person.name,
                                score: record.confidenceScore,
                              })
                            }
                          >
                            Photo
                          </button>
                        )}
                      </div>
                    ) : record.latitude != null && record.longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none", color: "var(--ink-soft)" }}
                      >
                        📍 GPS ↗
                      </a>
                    ) : (
                      <span className="muted" style={{ fontSize: "0.68rem" }}>✍️ Manual</span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    {isPending ? (
                      canApprove ? (
                        <button
                          type="button"
                          className="button button--secondary"
                          style={{
                            padding: "0.15rem 0.4rem",
                            fontSize: "0.7rem",
                            minHeight: "22px",
                            borderColor: "var(--clay)",
                            color: "var(--clay)",
                          }}
                          disabled={approvingId === record.id}
                          onClick={() => onApproveSingle(record.id)}
                        >
                          {approvingId === record.id ? "..." : "✓ Approve"}
                        </button>
                      ) : (
                        <span className="tag" style={{ background: "var(--clay-soft)", color: "var(--clay)", fontSize: "0.68rem", padding: "1px 4px" }}>
                          Pending
                        </span>
                      )
                    ) : (
                      <span className="tag" style={{ background: "var(--moss-soft)", color: "var(--moss)", fontSize: "0.68rem", padding: "1px 4px" }}>
                        ✓ Approved
                      </span>
                    )}

                    <Link
                      to={`/attendance/${record.id}`}
                      className="button button--ghost"
                      style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", minHeight: "22px" }}
                    >
                      Details ↗
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Person & Role</th>
                <th scope="col">Station / Shed</th>
                <th scope="col">Shift</th>
                <th scope="col">Status</th>
                <th scope="col">Verification Method</th>
                <th scope="col">Recorded Time & By</th>
                <th scope="col">Approval</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isPending = !record.approvedAt;
                const isFaceAi = record.verificationMode === "FACE_AI";

                return (
                  <tr key={record.id}>
                    {/* Person */}
                    <td data-label="Person">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <AttendanceAvatar
                          photoUrl={record.person.photoUrl}
                          name={record.person.name}
                          type={record.person.type}
                          size={36}
                          onPreview={
                            record.person.photoUrl
                              ? () =>
                                  onSnapshotPreview({
                                    url: record.person.photoUrl!,
                                    name: record.person.name,
                                    title: `${record.person.type === "EMPLOYEE" ? "Employee" : "Worker"} Profile Photo`,
                                  })
                              : undefined
                          }
                        />
                        <div>
                          <Link className="table__link" to={`/attendance/${record.id}`}>
                            {record.person.name}
                          </Link>
                          <span className="table__sub numeric">
                            {record.person.type === "EMPLOYEE" ? "👔 Employee" : "🚜 Worker"} · {record.person.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Station / Shed */}
                    <td data-label="Shed">
                      {record.shed?.number ? (
                        <span className="tag" style={{ background: "var(--surface-sunk)", fontWeight: 600 }}>
                          {record.shed.number.toLowerCase().includes("ac room")
                            ? "❄️ AC Room"
                            : record.shed.number.toLowerCase().startsWith("shed")
                            ? record.shed.number.replace("-", " ")
                            : `Shed ${record.shed.number}`}
                        </span>
                      ) : (
                        <span className="muted">General / Staff</span>
                      )}
                    </td>

                    {/* Shift */}
                    <td data-label="Shift">
                      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                        {statusLabel(record.shift)}
                      </span>
                    </td>

                    {/* Status */}
                    <td data-label="Status">
                      <StatusTag status={record.status} />
                    </td>

                    {/* Verification Method */}
                    <td data-label="Verification">
                      {isFaceAi ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <span
                            className="tag"
                            style={{
                              background: "#e8f0fe",
                              borderColor: "#c2d7ff",
                              color: "#1f4d8f",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            📸 Face AI {record.confidenceScore ? `(${Math.round(record.confidenceScore)}%)` : ""}
                          </span>
                          {record.snapshotUrl && (
                            <button
                              type="button"
                              className="button button--ghost"
                              style={{ padding: "1px 4px", fontSize: "0.7rem", minHeight: "20px" }}
                              onClick={() =>
                                onSnapshotPreview({
                                  url: record.snapshotUrl!,
                                  name: record.person.name,
                                  score: record.confidenceScore,
                                })
                              }
                              title="View Face Snapshot"
                            >
                              🔍 Photo
                            </button>
                          )}
                        </div>
                      ) : record.latitude != null && record.longitude != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.8rem", textDecoration: "none", color: "var(--ink-soft)" }}
                          title={`GPS Coordinates: ${record.latitude}, ${record.longitude}`}
                        >
                          📍 GPS Location ↗
                        </a>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.8rem" }}>✍️ Manual Entry</span>
                      )}
                    </td>

                    {/* Time & Recorded By */}
                    <td data-label="Recorded By">
                      <div style={{ fontSize: "0.85rem" }}>
                        {record.createdAt
                          ? new Date(record.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </div>
                      {record.recordedBy?.name && (
                        <span className="table__sub">by {record.recordedBy.name}</span>
                      )}
                    </td>

                    {/* Approval Status */}
                    <td data-label="Approval">
                      {isPending ? (
                        canApprove ? (
                          <button
                            type="button"
                            className="button button--secondary"
                            style={{
                              padding: "0.2rem 0.55rem",
                              fontSize: "0.75rem",
                              minHeight: "26px",
                              borderColor: "var(--clay)",
                              color: "var(--clay)",
                            }}
                            disabled={approvingId === record.id}
                            onClick={() => onApproveSingle(record.id)}
                          >
                            {approvingId === record.id ? "Approving..." : "✓ Approve"}
                          </button>
                        ) : (
                          <span className="tag" style={{ background: "var(--clay-soft)", color: "var(--clay)" }}>
                            Pending
                          </span>
                        )
                      ) : (
                        <span
                          className="tag"
                          style={{ background: "var(--moss-soft)", color: "var(--moss)" }}
                          title={record.approvedBy?.name ? `Approved by ${record.approvedBy.name}` : undefined}
                        >
                          ✓ Approved
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      <Link
                        to={`/attendance/${record.id}`}
                        className="button button--ghost"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem", minHeight: "26px" }}
                      >
                        Details ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
