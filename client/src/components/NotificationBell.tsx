import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from "../api/notifications.js";
import { usePushSubscription } from "../hooks/usePushSubscription.js";
import "./NotificationBell.css";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

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

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
    <div className="notification-bell" ref={dropdownRef}>
      <button
        type="button"
        className="button button--ghost notification-bell__trigger"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void loadLatest();
        }}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
      >
        <Bell size={18} style={{ color: "var(--ink)" }} />
        {unreadCount > 0 && (
          <span className="notification-bell__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile backdrop scrim */}
      {open && (
        <div
          className="notification-bell__scrim"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          className="notification-bell__dropdown"
          role="dialog"
          aria-label="Notifications preview"
        >
          {/* Header */}
          <div className="notification-bell__header">
            <div className="notification-bell__header-title">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="notification-bell__unread-chip">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="notification-bell__header-actions">
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
              <button
                type="button"
                className="notification-bell__close-btn"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Push Subscribe status banner */}
          {!isSubscribed && (
            <div className="notification-bell__push-alert">
              <span className="notification-bell__push-text">
                🔔 Enable push alerts for closed app
              </span>
              <button
                type="button"
                className="button button--secondary"
                style={{
                  padding: "3px 8px",
                  fontSize: "0.72rem",
                  height: "auto",
                  minHeight: "24px",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
                onClick={() => void subscribe()}
                disabled={pushBusy}
              >
                {pushBusy ? "Enabling..." : "Enable"}
              </button>
            </div>
          )}

          {/* Notification List preview */}
          <div className="notification-bell__list">
            {notifications.length === 0 ? (
              <div className="notification-bell__empty">
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
                    className={`notification-bell__item ${
                      isUnread ? "notification-bell__item--unread" : ""
                    }`}
                  >
                    <div className="notification-bell__item-row">
                      <span className="notification-bell__item-icon">
                        {isError ? "🚨" : isIpFallback ? "🌐" : "ℹ️"}
                      </span>
                      <div className="notification-bell__item-content">
                        <div className="notification-bell__item-top">
                          <div
                            className="notification-bell__item-title"
                            style={{ fontWeight: isUnread ? 700 : 500 }}
                          >
                            {item.title}
                          </div>
                          {item.createdAt && (
                            <span className="notification-bell__item-time">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          )}
                          {isUnread && <span className="notification-bell__item-dot" />}
                        </div>
                        <p className="notification-bell__item-body">{item.body}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer View All link */}
          <div className="notification-bell__footer">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="notification-bell__footer-link"
            >
              Go to Notification Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
