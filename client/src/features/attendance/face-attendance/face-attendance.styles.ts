import type React from "react";

export function statusColor(status: string): string {
  if (status === "LIVE") return "#10b981";
  if (status === "SPOOF") return "#ef4444";
  return "#f59e0b";
}

export const styles = {
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 20px",
  } as React.CSSProperties,

  header: {
    marginBottom: 24,
  } as React.CSSProperties,

  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text-primary, #1a1a2e)",
    marginBottom: 4,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary, #6b7280)",
  } as React.CSSProperties,

  card: {
    background: "var(--surface, #fff)",
    borderRadius: 12,
    border: "1px solid var(--border, #e5e7eb)",
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  } as React.CSSProperties,

  controls: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap" as const,
    marginBottom: 20,
  } as React.CSSProperties,

  select: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border, #d1d5db)",
    fontSize: 14,
    background: "var(--surface, #fff)",
    minWidth: 160,
  } as React.CSSProperties,

  btn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  btnPrimary: {
    background: "var(--primary, #6366f1)",
    color: "#fff",
  } as React.CSSProperties,

  btnSuccess: {
    background: "#10b981",
    color: "#fff",
  } as React.CSSProperties,

  btnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,

  imageContainer: {
    position: "relative" as const,
    display: "inline-block",
    maxWidth: "100%",
  } as React.CSSProperties,

  previewImage: {
    maxWidth: "100%",
    maxHeight: 500,
    borderRadius: 8,
    display: "block",
    transform: "none",
    WebkitTransform: "none",
  } as React.CSSProperties,

  facesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 16,
    marginTop: 20,
  } as React.CSSProperties,

  faceCard: {
    background: "var(--surface, #fff)",
    borderRadius: 12,
    border: "1px solid var(--border, #e5e7eb)",
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  } as React.CSSProperties,

  badge: (color: string) =>
    ({
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 700,
      color: "#fff",
      background: color,
      marginRight: 8,
    }) as React.CSSProperties,

  candidateRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid var(--border, #f3f4f6)",
  } as React.CSSProperties,

  candidateAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover" as const,
    background: "#e5e7eb",
    flexShrink: 0,
  } as React.CSSProperties,

  summary: {
    padding: 16,
    borderRadius: 12,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    marginTop: 20,
  } as React.CSSProperties,

  error: {
    padding: 16,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    marginTop: 12,
  } as React.CSSProperties,

  warning: {
    padding: 12,
    borderRadius: 8,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#b45309",
    fontSize: 13,
    marginTop: 8,
  } as React.CSSProperties,

  spinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    border: "2px solid #fff",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
    marginRight: 8,
    verticalAlign: "middle",
  } as React.CSSProperties,
};
