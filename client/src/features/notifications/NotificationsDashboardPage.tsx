import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from "../../api/notifications.js";
import { usePushSubscription } from "../../hooks/usePushSubscription.js";
import { useAuth } from "../../auth/use-auth.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { Panel, Button, EmptyState } from "../../components/ui.js";

export function NotificationsDashboardPage(): React.ReactElement {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "UNREAD" | "IP_FALLBACK" | "SERVER_500">("ALL");

  const {
    isSupported,
    isSubscribed,
    busy: pushBusy,
    error: pushError,
    subscribe,
    unsubscribe,
  } = usePushSubscription();

  const loadData = async () => {
    setLoading(true);
    try {
      const category =
        activeTab === "IP_FALLBACK"
          ? "IP_FALLBACK_AUDIT"
          : activeTab === "SERVER_500"
            ? "SERVER_500_ERROR"
            : undefined;

      const res = await fetchNotifications({
        category,
        unreadOnly: activeTab === "UNREAD",
        limit: 50,
      });

      setNotifications(res.data);
      setTotal(res.total);
      setUnreadCount(res.unreadCount);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeTab]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Notification Center"
        description="Unified audit notifications, IP Fallback approvals, and real-time system alerts."
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllRead}>
              <CheckCircle size={15} style={{ marginRight: 6 }} /> Mark All Read
            </Button>
          )
        }
      />

      {/* Push Subscription Management Banner */}
      <Panel>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: isSubscribed ? "rgba(22, 163, 74, 0.12)" : "rgba(217, 119, 6, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isSubscribed ? "#16a34a" : "#d97706",
              }}
            >
              <Smartphone size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                {isSubscribed ? "Push Notifications Active" : "Push Notifications Inactive"}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                {isSubscribed
                  ? "This device receives instant audit and system notifications even when the app is closed."
                  : isSupported
                    ? "Enable notifications on this device to receive alerts when the PWA is closed."
                    : "Push notifications are not supported on this browser."}
              </div>
              {pushError && (
                <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 4 }}>
                  ⚠️ {pushError}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  // Play pleasant notification chime
                  try {
                    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
                    gain.gain.setValueAtTime(0.2, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.45);
                  } catch {
                    // ignore audio failure
                  }

                  if (Notification.permission !== "granted") {
                    const perm = await Notification.requestPermission();
                    if (perm !== "granted") {
                      alert("Please allow notification permission in your browser URL bar.");
                      return;
                    }
                  }

                  if ("serviceWorker" in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    await reg.showNotification("🚨 Server Alert: IP Fallback Audit", {
                      body: "10 attendance records require audit confirmation at Green Valley Farm.",
                      icon: "/icons/icon-192.png",
                      badge: "/icons/icon-192.png",
                      tag: `test-toast-${Date.now()}`,
                      data: { url: "/notifications" },
                    });
                  } else {
                    new Notification("🚨 Server Alert: IP Fallback Audit", {
                      body: "10 attendance records require audit confirmation at Green Valley Farm.",
                      icon: "/icons/icon-192.png",
                    });
                  }
                } catch (e) {
                  alert("Could not display notification: " + (e instanceof Error ? e.message : String(e)));
                }
              }}
            >
              🔊 Test Banner & Sound
            </Button>

            {isSupported && (
              isSubscribed ? (
                <Button variant="ghost" onClick={() => void unsubscribe()} busy={pushBusy}>
                  Disable on this Device
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void subscribe()} busy={pushBusy}>
                  🔔 Enable Push Alerts
                </Button>
              )
            )}
          </div>
        </div>
      </Panel>

      {/* Tabs Filter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.5rem",
          overflowX: "auto",
        }}
      >
        {[
          { id: "ALL", label: `All (${total})` },
          { id: "UNREAD", label: `Unread (${unreadCount})` },
          { id: "IP_FALLBACK", label: "IP Fallback Audits" },
          ...(user?.isSystemAdmin ? [{ id: "SERVER_500", label: "Server 500 Errors" }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="button"
            style={{
              padding: "0.35rem 0.85rem",
              fontSize: "0.82rem",
              borderRadius: "20px",
              background: activeTab === tab.id ? "var(--moss)" : "transparent",
              color: activeTab === tab.id ? "#fff" : "var(--ink-soft)",
              border: activeTab === tab.id ? "1px solid var(--moss)" : "1px solid var(--line)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification Cards */}
      {loading ? (
        <Panel>
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ink-soft)" }}>
            Loading notifications...
          </div>
        </Panel>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications in this view"
          description="You are all caught up! New alerts will appear here."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {notifications.map((item) => {
            const isUnread = !item.readAt;
            const is500 = item.category === "SERVER_500_ERROR";
            const isIp = item.category === "IP_FALLBACK_AUDIT";

            const borderColor = is500
              ? "#ef4444"
              : isIp
                ? "#d97706"
                : "var(--line)";

            return (
              <div
                key={item.id}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${isUnread ? borderColor : "var(--line)"}`,
                  borderLeft: `4px solid ${borderColor}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "1rem 1.25rem",
                  boxShadow: isUnread ? "0 2px 8px rgba(0, 0, 0, 0.04)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>
                      {is500 ? "🚨" : isIp ? "🌐" : "ℹ️"}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: isUnread ? 700 : 600,
                          color: "var(--ink)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span>{item.title}</span>
                        {isUnread && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: is500 ? "#fee2e2" : "#fef3c7",
                              color: is500 ? "#b91c1c" : "#b45309",
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.74rem", color: "var(--ink-soft)" }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {isUnread && (
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ fontSize: "0.76rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => void handleMarkRead(item.id)}
                      >
                        Mark as read
                      </button>
                    )}
                    {item.linkUrl && (
                      <Link
                        to={
                          item.linkUrl.startsWith("/audit/logs")
                            ? item.linkUrl.replace("/audit/logs", "/audit-logs?tab=system-errors")
                            : item.linkUrl
                        }
                        className="button button--secondary"
                        style={{
                          fontSize: "0.76rem",
                          padding: "0.25rem 0.65rem",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isIp ? "Review in Approvals" : "Inspect Logs"}{" "}
                        <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--ink)",
                    lineHeight: 1.4,
                    paddingLeft: "2rem",
                  }}
                >
                  {item.body}
                </div>

                {/* Metadata Pill Breakdown (if present) */}
                {item.metadata && (
                  <div
                    style={{
                      paddingLeft: "2rem",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    {item.metadata.farmName && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          background: "var(--slate-soft)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "var(--ink-soft)",
                        }}
                      >
                        Farm: <strong>{String(item.metadata.farmName)}</strong>
                      </span>
                    )}
                    {item.metadata.newCount !== undefined && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          background: "var(--slate-soft)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "var(--ink-soft)",
                        }}
                      >
                        New check-ins: <strong>{String(item.metadata.newCount)}</strong>
                      </span>
                    )}
                    {item.metadata.backlogCount !== undefined && Number(item.metadata.backlogCount) > 0 && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          background: "var(--slate-soft)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "var(--ink-soft)",
                        }}
                      >
                        Prior pending backlog: <strong>{String(item.metadata.backlogCount)}</strong>
                      </span>
                    )}
                    {item.metadata.requestId && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          background: "#fee2e2",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "#991b1b",
                        }}
                      >
                        Req ID: <code>{String(item.metadata.requestId)}</code>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
