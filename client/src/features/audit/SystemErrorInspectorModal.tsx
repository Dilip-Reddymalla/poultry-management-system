import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  User,
  MapPin,
  Globe,
  Clock,
  Terminal,
  Copy,
  Check,
  CheckCircle,
} from "lucide-react";
import { type SystemErrorItem, resolveSystemError } from "../../api/system-errors.js";
import { Button } from "../../components/ui.js";

interface SystemErrorInspectorModalProps {
  errorItem: SystemErrorItem | null;
  onClose: () => void;
  onResolved?: (updated: SystemErrorItem) => void;
}

export function SystemErrorInspectorModal({
  errorItem,
  onClose,
  onResolved,
}: SystemErrorInspectorModalProps): React.ReactElement | null {
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [resolving, setResolving] = useState(false);

  if (!errorItem) return null;

  const handleCopyTrace = () => {
    if (!errorItem.stackTrace) return;
    void navigator.clipboard.writeText(errorItem.stackTrace);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const handleCopyJson = () => {
    void navigator.clipboard.writeText(JSON.stringify(errorItem, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await resolveSystemError(errorItem.id);
      if (onResolved && res.data) {
        onResolved(res.data);
      }
    } catch {
      // ignore
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface, #ffffff)",
          color: "var(--ink, #0f172a)",
          borderRadius: "1rem",
          maxWidth: "850px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          border: "1px solid var(--line, #e2e8f0)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(239, 68, 68, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "0.5rem",
                background: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "0.25rem",
                    background: "#ef4444",
                    color: "#ffffff",
                    letterSpacing: "0.05em",
                  }}
                >
                  HTTP {errorItem.statusCode}
                </span>
                <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                  {errorItem.errorName}
                </span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-soft, #64748b)" }}>
                {errorItem.method} {errorItem.path}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "0.375rem",
              color: "var(--ink-soft, #64748b)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "1.5rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Error Message Box */}
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "0.5rem",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#b91c1c",
              fontWeight: 600,
              fontSize: "0.92rem",
              wordBreak: "break-word",
            }}
          >
            {errorItem.errorMessage}
          </div>

          {/* Grid: Who Caused It & Location / Network Context */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Culprit / Initiator */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--surface-sunken, #f8fafc)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--ink-soft, #64748b)",
                  marginBottom: "0.75rem",
                }}
              >
                <User size={14} /> Initiated By (Culprit Context)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.86rem" }}>
                <div>
                  <span style={{ color: "var(--ink-soft, #64748b)" }}>User: </span>
                  <strong>{errorItem.userName || (errorItem.userId ? "Authenticated User" : "Anonymous / Unauthenticated")}</strong>
                </div>
                {errorItem.userEmail && (
                  <div>
                    <span style={{ color: "var(--ink-soft, #64748b)" }}>Email: </span>
                    <code>{errorItem.userEmail}</code>
                  </div>
                )}
                <div>
                  <span style={{ color: "var(--ink-soft, #64748b)" }}>Role: </span>
                  <span
                    style={{
                      background: "rgba(37, 99, 235, 0.12)",
                      color: "#2563eb",
                      padding: "0.1rem 0.45rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                    }}
                  >
                    {errorItem.userRole || "GUEST / UNASSIGNED"}
                  </span>
                </div>
                {errorItem.userId && (
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-soft, #64748b)" }}>
                    User ID: <code>{errorItem.userId}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Location & Network */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--surface-sunken, #f8fafc)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--ink-soft, #64748b)",
                  marginBottom: "0.75rem",
                }}
              >
                <MapPin size={14} /> Farm Location & Network
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.86rem" }}>
                <div>
                  <span style={{ color: "var(--ink-soft, #64748b)" }}>Company: </span>
                  <span>{errorItem.companyName || "Global / System"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--ink-soft, #64748b)" }}>Farm: </span>
                  <span>{errorItem.farmName || "System Scope"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--ink-soft, #64748b)" }}>Client IP: </span>
                  <code>{errorItem.ipAddress || "Unknown"}</code>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={13} style={{ color: "var(--ink-soft)" }} />
                  <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                    {new Date(errorItem.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Request Metadata */}
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--line, #e2e8f0)",
              background: "var(--surface-sunken, #f8fafc)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--ink-soft, #64748b)",
                marginBottom: "0.5rem",
              }}
            >
              <Globe size={14} /> Request Correlation & Parameters
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.84rem" }}>
              {errorItem.requestId && (
                <div>
                  <span style={{ color: "var(--ink-soft)" }}>Request ID: </span>
                  <code>#{errorItem.requestId}</code>
                </div>
              )}
              {errorItem.userAgent && (
                <div style={{ maxWidth: "100%", wordBreak: "break-all" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Device / User-Agent: </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{errorItem.userAgent}</span>
                </div>
              )}
            </div>

            {/* Query parameters (if any) */}
            {errorItem.queryParams && Object.keys(errorItem.queryParams).length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-soft)" }}>
                  Query Parameters:
                </span>
                <pre
                  style={{
                    background: "var(--surface, #ffffff)",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.76rem",
                    border: "1px solid var(--line)",
                    margin: "0.3rem 0 0",
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(errorItem.queryParams, null, 2)}
                </pre>
              </div>
            )}

            {/* Request Body (if any) */}
            {errorItem.requestBody && Object.keys(errorItem.requestBody).length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-soft)" }}>
                  Payload (Sanitized):
                </span>
                <pre
                  style={{
                    background: "var(--surface, #ffffff)",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.76rem",
                    border: "1px solid var(--line)",
                    margin: "0.3rem 0 0",
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(errorItem.requestBody, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Stack Trace */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.4rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--ink-soft, #64748b)",
                }}
              >
                <Terminal size={14} /> Server Stack Trace
              </div>
              {errorItem.stackTrace && (
                <button
                  type="button"
                  onClick={handleCopyTrace}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.75rem",
                    background: "transparent",
                    border: "1px solid var(--line)",
                    borderRadius: "0.25rem",
                    padding: "0.2rem 0.5rem",
                    cursor: "pointer",
                    color: "var(--ink)",
                  }}
                >
                  {copiedTrace ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  {copiedTrace ? "Copied" : "Copy Trace"}
                </button>
              )}
            </div>

            <div
              style={{
                background: "#0f172a",
                color: "#f8fafc",
                borderRadius: "0.5rem",
                padding: "1rem",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                lineHeight: 1.5,
                maxHeight: "220px",
                overflowY: "auto",
                border: "1px solid #334155",
              }}
            >
              {errorItem.stackTrace ? (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {errorItem.stackTrace}
                </pre>
              ) : (
                <span style={{ color: "#94a3b8" }}>No server stack trace was recorded for this entry.</span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface-sunken, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Button variant="secondary" onClick={handleCopyJson}>
              {copiedJson ? <Check size={14} style={{ marginRight: 4 }} /> : <Copy size={14} style={{ marginRight: 4 }} />}
              {copiedJson ? "Copied Diagnostic JSON" : "Copy Full Diagnostics"}
            </Button>
            {errorItem.resolvedAt ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#16a34a", fontSize: "0.84rem", fontWeight: 600 }}>
                <CheckCircle size={15} /> Resolved ({new Date(errorItem.resolvedAt).toLocaleTimeString()})
              </span>
            ) : (
              <Button variant="secondary" onClick={() => void handleResolve()} busy={resolving}>
                Mark as Resolved
              </Button>
            )}
          </div>

          <Button variant="primary" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  );
}
