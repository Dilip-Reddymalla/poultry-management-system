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
import { useToast } from "../../components/use-toast.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { Panel, Button, EmptyState } from "../../components/ui.js";
import "./NotificationsDashboardPage.css";

export function NotificationsDashboardPage(): React.ReactElement {
  const { user } = useAuth();
  const { notify } = useToast();
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
    <div className="notification-dashboard">
      <PageHeader
        title="Notification Center"
        description="Unified audit notifications, IP Fallback approvals, and real-time system alerts."
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={handleMarkAllRead}>
              <CheckCircle size={15} style={{ marginRight: 6 }} /> Mark All Read
            </Button>
          ) : undefined
        }
      />

      {/* Push Subscription Management Banner */}
      <Panel className="push-banner-panel">
        <div className="push-banner">
          <div className="push-banner__content">
            <div
              className={`push-banner__icon ${
                isSubscribed ? "push-banner__icon--active" : "push-banner__icon--inactive"
              }`}
            >
              <Smartphone size={22} />
            </div>
            <div className="push-banner__text">
              <div className="push-banner__title">
                {isSubscribed ? "Push Notifications Active" : "Push Notifications Inactive"}
              </div>
              <div className="push-banner__desc">
                {isSubscribed
                  ? "This device receives instant audit and system notifications even when the app is closed."
                  : isSupported
                    ? "Enable notifications on this device to receive alerts when the PWA is closed."
                    : "Push notifications are not supported on this browser."}
              </div>
              {pushError && (
                <div className="push-banner__error">
                  ⚠️ {pushError}
                </div>
              )}
            </div>
          </div>

          <div className="push-banner__actions">
            <Button
              variant="secondary"
              onClick={async () => {
                // 1. Play pleasant notification chime
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

                const notifTitle = "🚨 Server Alert: IP Fallback Audit";
                const notifBody = "10 attendance records require audit confirmation at Green Valley Farm.";

                // 2. Always display instant in-app banner for visible foreground feedback
                notify("info", `${notifTitle} — ${notifBody}`);

                // 3. Check and request native OS notification permissions
                try {
                  if (typeof window !== "undefined" && "Notification" in window) {
                    if (Notification.permission !== "granted") {
                      const perm = await Notification.requestPermission();
                      if (perm !== "granted") {
                        alert(
                          "Notification permission is not granted. Please enable notifications in your browser URL bar or device settings to receive system pop-ups."
                        );
                        return;
                      }
                    }
                  }

                  // 4. Safely acquire service worker registration without hanging
                  let reg: ServiceWorkerRegistration | null = null;
                  if ("serviceWorker" in navigator) {
                    try {
                      reg = (await navigator.serviceWorker.getRegistration()) || null;
                      if (!reg) {
                        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
                      }
                      if (reg && !reg.active) {
                        await Promise.race([
                          navigator.serviceWorker.ready,
                          new Promise<void>((res) => setTimeout(res, 1200)),
                        ]);
                      }
                    } catch (swErr) {
                      console.warn("Service worker lookup notice:", swErr);
                    }
                  }

                  const notifTag = `test-toast-${Date.now()}`;
                  const notifOptions: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
                    body: notifBody,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/icon-192.png",
                    tag: notifTag,
                    renotify: true,
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    data: { url: "/notifications" },
                  };

                  let nativeDispatched = false;
                  if (reg && typeof reg.showNotification === "function") {
                    try {
                      await reg.showNotification(notifTitle, notifOptions as NotificationOptions);
                      nativeDispatched = true;
                    } catch (showErr) {
                      console.warn("ServiceWorker showNotification failed:", showErr);
                    }
                  }

                  if (!nativeDispatched && typeof window !== "undefined" && "Notification" in window) {
                    try {
                      new Notification(notifTitle, {
                        body: notifBody,
                        icon: "/icons/icon-192.png",
                        badge: "/icons/icon-192.png",
                        tag: notifTag,
                      });
                    } catch {
                      // Ignored on Android Chrome where constructor is restricted
                    }
                  }
                } catch (e) {
                  console.error("Native notification delivery notice:", e);
                }
              }}
            >
              🔊 Test Sound & Banner
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
      <div className="notification-tabs">
        {[
          { id: "ALL", label: `All (${total})` },
          { id: "UNREAD", label: `Unread (${unreadCount})` },
          { id: "IP_FALLBACK", label: "IP Fallback Audits" },
          ...(user?.isSystemAdmin ? [{ id: "SERVER_500", label: "Server 500 Errors" }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`button notification-tab-btn ${
              activeTab === tab.id ? "notification-tab-btn--active" : ""
            }`}
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
        <div className="notification-cards-list">
          {notifications.map((item) => {
            const isUnread = !item.readAt;
            const is500 = item.category === "SERVER_500_ERROR";
            const isIp = item.category === "IP_FALLBACK_AUDIT";
            const isResolved =
              item.title.startsWith("[Resolved]") ||
              (item.metadata as any)?.status === "RESOLVED" ||
              (item.metadata as any)?.remainingPending === 0;

            const accentColor = isResolved
              ? "#16a34a"
              : is500
                ? "#ef4444"
                : isIp
                  ? "#d97706"
                  : "var(--line)";

            return (
              <div
                key={item.id}
                className="notification-card"
                style={{
                  border: `1px solid ${isUnread ? accentColor : "var(--line)"}`,
                  borderLeft: `4px solid ${accentColor}`,
                  boxShadow: isUnread ? "0 2px 8px rgba(0, 0, 0, 0.05)" : "none",
                }}
              >
                <div className="notification-card__main-row">
                  <div className="notification-card__header-left">
                    <span className="notification-card__category-icon">
                      {isResolved ? "✅" : is500 ? "🚨" : isIp ? "🌐" : "ℹ️"}
                    </span>
                    <div className="notification-card__title-group">
                      <div className="notification-card__title-line">
                        <strong style={{ fontWeight: isUnread ? 700 : 600 }}>
                          {item.title}
                        </strong>
                        {isResolved ? (
                          <span
                            className="notification-card__badge-new"
                            style={{
                              background: "#dcfce7",
                              color: "#15803d",
                            }}
                          >
                            RESOLVED
                          </span>
                        ) : isUnread ? (
                          <span
                            className="notification-card__badge-new"
                            style={{
                              background: is500 ? "#fee2e2" : "#fef3c7",
                              color: is500 ? "#b91c1c" : "#b45309",
                            }}
                          >
                            NEW
                          </span>
                        ) : null}
                      </div>
                      <span className="notification-card__timestamp">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="notification-card__actions">
                    {isUnread && (
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ fontSize: "0.76rem", padding: "0.25rem 0.5rem" }}
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
                        {isResolved
                          ? "View in Approvals"
                          : isIp
                            ? "Review in Approvals"
                            : "Inspect Logs"}{" "}
                        <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="notification-card__body">
                  {item.body}
                </div>

                {/* Metadata Pill Breakdown (if present) */}
                {item.metadata && (
                  <div className="notification-card__metadata">
                    {item.metadata.farmName && (
                      <span className="notification-card__pill">
                        Farm: <strong>{String(item.metadata.farmName)}</strong>
                      </span>
                    )}
                    {item.metadata.resolvedBy && (
                      <span
                        className="notification-card__pill"
                        style={{ background: "#dcfce7", color: "#15803d" }}
                      >
                        Audited by: <strong>{String(item.metadata.resolvedBy)}</strong>
                      </span>
                    )}
                    {item.metadata.remainingPending !== undefined && !isResolved && (
                      <span className="notification-card__pill">
                        Pending remaining: <strong>{String(item.metadata.remainingPending)}</strong>
                      </span>
                    )}
                    {item.metadata.newCount !== undefined && !isResolved && (
                      <span className="notification-card__pill">
                        New check-ins: <strong>{String(item.metadata.newCount)}</strong>
                      </span>
                    )}
                    {item.metadata.backlogCount !== undefined && Number(item.metadata.backlogCount) > 0 && !isResolved && (
                      <span className="notification-card__pill">
                        Prior backlog: <strong>{String(item.metadata.backlogCount)}</strong>
                      </span>
                    )}
                    {item.metadata.requestId && (
                      <span
                        className="notification-card__pill"
                        style={{ background: "#fee2e2", color: "#991b1b" }}
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
