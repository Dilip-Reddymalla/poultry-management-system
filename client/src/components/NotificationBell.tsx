import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from "../api/notifications.js";
import { usePushSubscription } from "../hooks/usePushSubscription.js";

export function NotificationBell(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isSubscribed, subscribe, busy: pushBusy } = usePushSubscription();

  const loadLatest = async () => {
    try {
      const res = await fetchNotifications({ limit: 5 });
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
    } catch {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    void loadLatest();
    const interval = setInterval(() => {
      void loadLatest();
    }, 45_000); // 45s poll for in-app badge freshness
    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleMarkAll = async () => {
    setLoading(true);
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      await markNotificationRead(item.id).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
    }
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        type="button"
        className="button button--ghost"
        style={{
          position: "relative",
          padding: "0.5rem",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "38px",
          width: "38px",
        }}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void loadLatest();
        }}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={18} style={{ color: "var(--ink)" }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: "#ef4444",
              color: "#fff",
              fontSize: "0.68rem",
              fontWeight: 700,
              borderRadius: "10px",
              minWidth: "18px",
              height: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
              boxShadow: "0 0 0 2px var(--surface)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "340px",
            maxWidth: "90vw",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--line)",
              background: "var(--slate-soft)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "1px 6px",
                    borderRadius: 12,
                    background: "var(--clay)",
                    color: "#fff",
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="button button--ghost"
                style={{ fontSize: "0.75rem", padding: "2px 6px", height: "auto", minHeight: 0 }}
                onClick={handleMarkAll}
                disabled={loading}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Quick Push Subscribe status banner */}
          {!isSubscribed && (
            <div
              style={{
                padding: "0.6rem 1rem",
                background: "#fef3c7",
                borderBottom: "1px solid #fde68a",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <span>🔔 Enable push alerts for closed app</span>
              <button
                type="button"
                className="button button--secondary"
                style={{ padding: "2px 8px", fontSize: "0.72rem", height: "auto", minHeight: "22px" }}
                onClick={() => void subscribe()}
                disabled={pushBusy}
              >
                {pushBusy ? "Enabling..." : "Enable"}
              </button>
            </div>
          )}

          {/* Notification List preview */}
          <div style={{ maxHeight: "320px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--ink-soft)", fontSize: "0.85rem" }}>
                🎉 You're all caught up! No notifications.
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.readAt;
                const isError = item.category === "SERVER_500_ERROR";
                const isIpFallback = item.category === "IP_FALLBACK_AUDIT";

                  const targetUrl = item.linkUrl
                    ? item.linkUrl.startsWith("/audit/logs")
                      ? item.linkUrl.replace("/audit/logs", "/audit-logs?tab=system-errors")
                      : item.linkUrl
                    : "/notifications";

                  return (
                    <Link
                      key={item.id}
                      to={targetUrl}
                      onClick={() => void handleItemClick(item)}
                    style={{
                      display: "block",
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid var(--line)",
                      background: isUnread ? "rgba(234, 88, 12, 0.04)" : "transparent",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1rem" }}>
                        {isError ? "🚨" : isIpFallback ? "🌐" : "ℹ️"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: isUnread ? 700 : 500,
                            color: "var(--ink)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.title}
                          </span>
                          {isUnread && (
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#ea580c",
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: "0.76rem",
                            color: "var(--ink-soft)",
                            margin: "2px 0 0 0",
                            lineHeight: 1.3,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer View All link */}
          <div
            style={{
              padding: "0.6rem 1rem",
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              textAlign: "center",
            }}
          >
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--moss)",
                textDecoration: "none",
              }}
            >
              Go to Notification Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
