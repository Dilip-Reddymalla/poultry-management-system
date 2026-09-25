import { useState } from "react";

export function AttendanceAvatar({
  photoUrl,
  name,
  type,
  size = 36,
  onPreview,
}: {
  photoUrl?: string | null | undefined;
  name: string;
  type?: "EMPLOYEE" | "WORKER" | undefined;
  size?: number | undefined;
  onPreview?: (() => void) | undefined;
}): React.ReactElement {
  const [imgError, setImgError] = useState(false);
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        onClick={(e) => {
          if (onPreview) {
            e.stopPropagation();
            onPreview();
          }
        }}
        title={onPreview ? `Click to view ${name}'s photo` : name}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid var(--line)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          flexShrink: 0,
          display: "block",
          cursor: onPreview ? "pointer" : "default",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (onPreview) {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
          }
        }}
        onMouseLeave={(e) => {
          if (onPreview) {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
          }
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: type === "EMPLOYEE" ? "var(--ink)" : "var(--moss)",
        color: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 32 ? "0.75rem" : "0.85rem",
        fontWeight: 700,
        flexShrink: 0,
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
