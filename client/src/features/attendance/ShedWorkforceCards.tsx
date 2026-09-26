import type { Shift } from "../../api/types.js";
import { formatNumber } from "../../lib/display.js";
import { Panel } from "../../components/ui.js";
import { SHIFT_CONFIG, type ShedSummaryItem } from "./attendance-dashboard-types.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

export function ShedWorkforceCards({
  shedSummaries,
  selectedShedId,
  onShedSelect,
  dashboardShift,
  isMobile: isMobileProp,
}: {
  shedSummaries: ShedSummaryItem[];
  selectedShedId: string;
  onShedSelect: (shedId: string) => void;
  dashboardShift: Shift | "";
  isMobile?: boolean;
}): React.ReactElement {
  const isMobile = isMobileProp ?? useIsMobile();

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
        <div className="muted" style={{ textAlign: "center", padding: isMobile ? "1rem" : "2rem" }}>No sheds configured.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(135px, 1fr))",
            gap: isMobile ? "0.5rem" : "0.75rem",
          }}
        >
          {shedSummaries.map((s) => {
            const isSelected = selectedShedId === s.shedId;
            const isWarning = s.shedId !== "unassigned" && s.present === 0 && s.total > 0;
            const shedTitle =
              s.shedId === "unassigned"
                ? "General / Staff"
                : s.shedNumber.toLowerCase().includes("ac room")
                ? "❄️ AC Room"
                : s.shedNumber.toLowerCase().startsWith("shed")
                ? s.shedNumber.replace("-", " ")
                : `Shed ${s.shedNumber}`;

            return (
              <div
                key={s.shedId}
                onClick={() => onShedSelect(isSelected ? "" : s.shedId)}
                style={{
                  padding: isMobile ? "0.5rem 0.5rem" : "0.75rem 0.6rem",
                  border: `1px solid ${isSelected ? "var(--moss)" : isWarning ? "var(--rust)" : "var(--line)"}`,
                  borderLeft: isMobile ? `4px solid ${isSelected ? "var(--moss)" : isWarning ? "var(--rust)" : "var(--line-strong)"}` : undefined,
                  borderTop: !isMobile ? `3px solid ${isSelected ? "var(--moss)" : isWarning ? "var(--rust)" : "var(--ink-soft)"}` : undefined,
                  borderRadius: "var(--radius)",
                  background: isSelected ? "var(--moss-soft)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "0.15rem" : "0.25rem",
                  textAlign: isMobile ? "left" : "center",
                  boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                  transition: "transform 100ms ease, border-color 150ms ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: isMobile ? "0.82rem" : "0.9rem", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shedTitle}
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: "0.62rem", background: "var(--moss)", color: "#fff", padding: "1px 4px", borderRadius: "4px" }}>
                      Active
                    </span>
                  )}
                </div>
                {s.capacity != null && s.capacity > 0 && (
                  <div className="muted" style={{ fontSize: "0.65rem" }}>
                    {formatNumber(s.capacity)} birds
                  </div>
                )}
                <div style={{ marginTop: "0.15rem", fontSize: isMobile ? "1.05rem" : "1.2rem", fontWeight: 700, color: s.present > 0 ? "var(--moss)" : s.total > 0 ? "var(--rust)" : "var(--ink-soft)" }}>
                  {s.present} <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--ink-soft)" }}>on duty</span>
                </div>
                {s.absent > 0 && (
                  <div style={{ fontSize: "0.68rem", color: "var(--rust)", fontWeight: 600 }}>
                    {s.absent} absent
                  </div>
                )}
                {s.total === 0 && (
                  <div className="muted" style={{ fontSize: "0.68rem" }}>
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
