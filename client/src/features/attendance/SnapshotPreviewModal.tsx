import type { SnapshotPreviewData } from "./attendance-dashboard-types.js";

export function SnapshotPreviewModal({
  preview,
  onClose,
}: {
  preview: SnapshotPreviewData | null;
  onClose: () => void;
}): React.ReactElement | null {
  if (!preview) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          padding: "1.5rem",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "var(--shadow-md)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 id="snapshot-modal-title" style={{ fontSize: "1.1rem", margin: 0 }}>
            {preview.title ?? (preview.score != null ? "Face Verification Snapshot" : "Profile Photo")}
          </h3>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            style={{ padding: "0.2rem 0.5rem", minHeight: "28px" }}
          >
            ✕
          </button>
        </div>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <img
            src={preview.url}
            alt={`Face snapshot of ${preview.name}`}
            style={{
              width: "100%",
              maxHeight: "320px",
              objectFit: "cover",
              borderRadius: "var(--radius)",
              border: "2px solid var(--line)",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
          <span><strong>Person:</strong> {preview.name}</span>
          {preview.score != null && (
            <span style={{ color: "var(--moss)", fontWeight: 600 }}>
              Confidence: {Math.round(preview.score)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
