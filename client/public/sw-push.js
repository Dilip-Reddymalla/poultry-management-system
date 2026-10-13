// Service worker push and notification listeners for PWA background notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "PoultryOps Alert",
    body: "New update received",
    url: "/notifications",
    tag: `notif-${Date.now()}`,
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  console.log("🔔 [SW] Push event received:", data);

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || `notif-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/notifications",
      timestamp: Date.now(),
    },
    actions: [
      { action: "open", title: "View Details" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  const showNotificationPromise = self.registration
    .showNotification(data.title, options)
    .then(() => {
      console.log("✅ [SW] Native notification successfully displayed for:", data.title);
    })
    .catch((err) => {
      console.error("❌ [SW] self.registration.showNotification failed:", err);
    });

  const broadcastPromise = clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        client.postMessage({
          type: "PUSH_NOTIFICATION_RECEIVED",
          payload: {
            title: data.title,
            body: data.body,
            url: data.url,
            tag: options.tag,
          },
        });
      }
    })
    .catch(() => {});

  event.waitUntil(Promise.allSettled([showNotificationPromise, broadcastPromise]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});

// Automatically renew push subscriptions whenever the browser/push service expires or changes them
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("🔄 [SW] pushsubscriptionchange detected. Auto-renewing subscription...");
  event.waitUntil(
    fetch("/api/v1/notifications/vapid-key")
      .then((res) => res.json())
      .then((data) => {
        const key = data.publicKey;
        if (!key) throw new Error("No VAPID public key received");
        const padding = "=".repeat((4 - (key.length % 4)) % 4);
        const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const buffer = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          buffer[i] = rawData.charCodeAt(i);
        }
        return self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: buffer,
        });
      })
      .then((newSub) => {
        return fetch("/api/v1/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: newSub.endpoint,
            keys: newSub.toJSON().keys,
            userAgent: "ServiceWorker AutoRenew",
          }),
        });
      })
      .then(() => {
        console.log("✅ [SW] Auto-renewed push subscription successfully stored on server!");
      })
      .catch((err) => {
        console.error("❌ [SW] Failed to auto-renew push subscription on pushsubscriptionchange:", err);
      }),
  );
});

