import { apiRequest } from "./client.js";

export interface NotificationItem {
  id: string;
  category: "IP_FALLBACK_AUDIT" | "SERVER_500_ERROR" | "ATTENDANCE_APPROVAL" | "SYSTEM_ALERT";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  body: string;
  linkUrl: string | null;
  metadata: Record<string, any> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export function fetchVapidPublicKey(): Promise<{ success: boolean; publicKey: string }> {
  return apiRequest<{ success: boolean; publicKey: string }>("/notifications/vapid-key");
}

export function subscribePush(subscription: PushSubscriptionJSON): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/notifications/subscribe", {
    method: "POST",
    body: {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: navigator.userAgent,
    },
  });
}

export function unsubscribePush(endpoint: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/notifications/unsubscribe", {
    method: "POST",
    body: { endpoint },
  });
}

export function fetchNotifications(params?: {
  page?: number | undefined;
  limit?: number | undefined;
  category?: string | undefined;
  unreadOnly?: boolean | undefined;
}): Promise<NotificationListResponse> {
  return apiRequest<NotificationListResponse>("/notifications", {
    query: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.category ? { category: params.category } : {}),
      ...(params?.unreadOnly ? { unreadOnly: "true" } : {}),
    },
  });
}

export function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead(): Promise<{ success: boolean; count: number }> {
  return apiRequest<{ success: boolean; count: number }>("/notifications/read-all", {
    method: "POST",
  });
}
