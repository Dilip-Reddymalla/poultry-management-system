import { useState, useCallback, useEffect } from "react";
import { listSessions, revokeSession, logoutAll, type SessionInfo } from "../../api/auth.js";
import { useToast } from "../../components/use-toast.js";
import { Button } from "../../components/ui.js";

/**
 * Lists the account's active sessions (refresh tokens) and lets the user revoke
 * individual sessions or log out of all devices.
 */
export function ProfileSessionsPanel(): React.ReactElement {
  const { notify } = useToast();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSessions();
      setSessions(res.sessions);
    } catch {
      notify("error", "Could not load sessions.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeSession(id);
      notify("success", "Session revoked.");
      await load();
    } catch {
      notify("error", "Failed to revoke session.");
    } finally {
      setBusyId(null);
    }
  };

  const handleLogoutAll = async () => {
    setBusyId("*");
    try {
      await logoutAll();
      notify("success", "Logged out of all sessions.");
      await load();
    } catch {
      notify("error", "Failed to log out of all sessions.");
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <section className="ph-section">
      <div className="ph-section__header">
        <h2 className="ph-section__title">Active sessions</h2>
        <p className="ph-section__sub">
          Devices currently signed in to this account. Revoke any session you no
          longer recognize.
        </p>
      </div>

      <div className="stack" style={{ gap: "0.75rem" }}>
        {loading ? (
          <p className="muted">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="muted">No active sessions.</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.6rem 0.9rem",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                background: "var(--surface)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem" }}>Signed in {formatDate(s.createdAt)}</div>
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  Expires {formatDate(s.expiresAt)}
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => handleRevoke(s.id)}
                busy={busyId === s.id}
              >
                Revoke
              </Button>
            </div>
          ))
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={handleLogoutAll} busy={busyId === "*"}>
            Log out of all sessions
          </Button>
        </div>
      </div>
    </section>
  );
}
