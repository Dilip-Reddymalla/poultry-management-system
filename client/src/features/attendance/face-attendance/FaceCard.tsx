import { useState } from "react";
import type React from "react";
import type { ProcessedFace } from "../../../api/face-attendance.api.js";
import type { FaceSelection } from "./face-attendance.types.js";
import { styles, statusColor } from "./face-attendance.styles.js";

/* ------------------------------------------------------------------ */
/*  Person Avatar with Fallback                                        */
/* ------------------------------------------------------------------ */

export function PersonAvatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}): React.ReactElement {
  const [imgError, setImgError] = useState(false);
  const initials = name
    ? name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
    : "?";

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid #e0e7ff",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.38)),
        border: "2px solid #e0e7ff",
        flexShrink: 0,
        textTransform: "uppercase",
      }}
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Face Card                                                          */
/* ------------------------------------------------------------------ */

interface FaceCardProps {
  face: ProcessedFace;
  selection?: FaceSelection | undefined;
  onSelect: (
    faceIndex: number,
    candidateId: string,
    personType: "EMPLOYEE" | "WORKER",
  ) => void;
}

export function FaceCard({ face, selection, onSelect }: FaceCardProps): React.ReactElement {
  const isLive = face.status === "LIVE";
  const activeCandidate =
    face.candidates.find((c) => c.id === selection?.personId) ||
    (face.candidates[0] && face.candidates[0].similarity >= 0.4 ? face.candidates[0] : null);

  return (
    <div style={styles.faceCard}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          Face #{face.faceIndex}
        </span>
        <span style={styles.badge(statusColor(face.status))}>
          {face.status}
        </span>
      </div>

      {/* Prominent Recognized Person Hero Identity Badge */}
      {isLive && activeCandidate && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 12,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
            border: "1px solid #a7f3d0",
            marginBottom: 14,
            boxShadow: "0 1px 3px rgba(16, 185, 129, 0.1)",
          }}
        >
          <PersonAvatar src={activeCandidate.photoUrl} name={activeCandidate.name} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#065f46" }}>
                {activeCandidate.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: activeCandidate.similarity >= 0.6 ? "#10b981" : "#f59e0b",
                  color: "#fff",
                }}
              >
                {Math.round(activeCandidate.similarity * 100)}% Match
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#047857", marginTop: 2 }}>
              {activeCandidate.personCode} • {activeCandidate.personType}
            </div>
          </div>
        </div>
      )}

      {/* Unrecognized Face Banner */}
      {isLive && !activeCandidate && face.candidates.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fef3c7",
            border: "1px solid #fde68a",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#f59e0b",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ?
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>
              Unrecognized Face
            </div>
            <div style={{ fontSize: 12, color: "#b45309" }}>
              No matching person found in enrolled facial database
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        {face.qualityScore != null && (
          <span>
            Quality: <strong>{(face.qualityScore * 100).toFixed(0)}%</strong>
          </span>
        )}
        {face.livenessScore != null && (
          <span>
            Liveness: <strong>{(face.livenessScore * 100).toFixed(0)}%</strong>
          </span>
        )}
      </div>

      {/* Candidates */}
      {isLive && face.candidates.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Candidate Matches
          </div>
          {face.candidates.map((c) => {
            const pct = Math.round(c.similarity * 100);
            const isSelected = selection?.personId === c.id;

            return (
              <div
                key={c.id}
                style={{
                  ...styles.candidateRow,
                  cursor: "pointer",
                  background: isSelected
                    ? "rgba(99,102,241,0.08)"
                    : "transparent",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
                onClick={() =>
                  onSelect(face.faceIndex, c.id, c.personType)
                }
              >
                {/* Radio */}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: `2px solid ${isSelected ? "#6366f1" : "#d1d5db"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#6366f1",
                      }}
                    />
                  )}
                </div>

                {/* Avatar with fallback */}
                <PersonAvatar src={c.photoUrl} name={c.name} size={38} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {c.personCode} • {c.personType}
                  </div>
                </div>

                {/* Similarity */}
                <div style={{ textAlign: "right", minWidth: 50 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: pct >= 60 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444",
                    }}
                  >
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLive && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background:
              face.status === "SPOOF" ? "#fef2f2" : "#fefce8",
            fontSize: 13,
            color: face.status === "SPOOF" ? "#991b1b" : "#854d0e",
          }}
        >
          {face.status === "SPOOF"
            ? "🚫 Spoof detected — this face will not be matched"
            : "⚠️ Low quality image — please try a clearer photo"}
        </div>
      )}
    </div>
  );
}
