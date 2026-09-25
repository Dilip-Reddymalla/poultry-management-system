import type { Shift } from "../../api/types.js";
import { formatNumber } from "../../lib/display.js";
import { Panel } from "../../components/ui.js";
import { SHIFT_CONFIG, type ShedSummaryItem } from "./attendance-dashboard-types.js";

export function ShedWorkforceCards({
  shedSummaries,
  selectedShedId,
  onShedSelect,
  dashboardShift,
}: {
  shedSummaries: ShedSummaryItem[];
  selectedShedId: string;
  onShedSelect: (shedId: string) => void;
  dashboardShift: Shift | "";
}): React.ReactElement {
  return (
    <Panel
      title="Shed Workforce Allocation"
      eyebrow={dashboardShift ? `${SHIFT_CONFIG[dashboardShift].label} Shift Stations` : "All Stations"}
      actions={
        selectedShedId !== "" ? (
          <button
            type="button"
            className="button button--ghost"
            style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem" }}
            onClick={() => onShedSelect("")}
          >
            Clear Shed ✕
          </button>
        ) : null
      }
    >
      {shedSummaries.length === 0 ? (
        <div className="muted" style={{ textAlign: "center", padding: "2rem" }}>No sheds configured.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {shedSummaries.map((s) => {
            const isSelected = selectedShedId === s.shedId;
            const isWarning = s.shedId !== "unassigned" && s.present === 0 && s.total > 0;

            return (
              <div
                key={s.shedId}
                onClick={() => onShedSelect(isSelected ? "" : s.shedId)}
                style={{
                  padding: "0.75rem 0.6rem",
                  border: `1px solid ${isSelected ? "var(--moss)" : isWarning ? "var(--rust)" : "var(--line)"}`,
                  borderTop: `3px solid ${isSelected ? "var(--moss)" : isWarning ? "var(--rust)" : "var(--ink-soft)"}`,
                  borderRadius: "var(--radius)",
                  background: isSelected ? "var(--moss-soft)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                  textAlign: "center",
                  transition: "transform 100ms ease, border-color 150ms ease",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  {s.shedId === "unassigned"
                    ? "General / Staff"
                    : s.shedNumber.toLowerCase().includes("ac room")
                    ? "❄️ AC Room"
                    : s.shedNumber.toLowerCase().startsWith("shed")
                    ? s.shedNumber.replace("-", " ")
                    : `Shed ${s.shedNumber}`}
                </div>
                {s.capacity != null && s.capacity > 0 && (
                  <div className="muted" style={{ fontSize: "0.68rem" }}>
                    {formatNumber(s.capacity)} birds
                  </div>
                )}
                <div style={{ marginTop: "0.25rem", fontSize: "1.2rem", fontWeight: 700, color: s.present > 0 ? "var(--moss)" : s.total > 0 ? "var(--rust)" : "var(--ink-soft)" }}>
                  {s.present} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--ink-soft)" }}>on duty</span>
                </div>
                {s.absent > 0 && (
                  <div style={{ fontSize: "0.7rem", color: "var(--rust)" }}>
                    {s.absent} absent
                  </div>
                )}
                {s.total === 0 && (
                  <div className="muted" style={{ fontSize: "0.7rem" }}>
                    No records
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
