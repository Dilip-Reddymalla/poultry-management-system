import type { Shed } from "../api/types.js";
import { formatNumber, statusLabel, statusTone } from "../lib/display.js";

/**
 * The signature view: a farm is a numbered row of sheds, so draw it that way.
 * Each cell is one shed, tinted by status, with its capacity underneath.
 */
export function ShedStrip({
  sheds,
  onSelect,
}: {
  sheds: Shed[];
  onSelect?: (shed: Shed) => void;
}): React.ReactElement {
  return (
    <ul className="strip">
      {sheds.map((shed) => {
        const content = (
          <>
            <span className="strip__number numeric">{shed.number}</span>
            <span className="strip__capacity numeric">
              {formatNumber(shed.capacity ?? 0)}
            </span>
            <span className="visually-hidden">
              Shed {shed.number}, {statusLabel(shed.status)},{" "}
              {formatNumber(shed.capacity ?? 0)} birds
            </span>
          </>
        );

        const className = `strip__cell strip__cell--${statusTone(shed.status)}`;

        return (
          <li key={shed.id}>
            {onSelect ? (
              <button
                type="button"
                className={className}
                title={`Shed ${shed.number} · ${statusLabel(shed.status)}`}
                onClick={() => {
                  onSelect(shed);
                }}
              >
                {content}
              </button>
            ) : (
              <span
                className={className}
                title={`Shed ${shed.number} · ${statusLabel(shed.status)}`}
              >
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ShedLegend(): React.ReactElement {
  const entries = [
    { tone: "running", label: "Available" },
    { tone: "busy", label: "Occupied" },
    { tone: "attention", label: "Maintenance" },
    { tone: "idle", label: "Inactive" },
  ];

  return (
    <ul className="legend">
      {entries.map((entry) => (
        <li className="legend__item" key={entry.tone}>
          <span className={`legend__swatch legend__swatch--${entry.tone}`} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
