import { useState, useEffect, useCallback } from "react";
import { fetchVapidPublicKey, subscribePush, unsubscribePush } from "../api/notifications.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Automatically creates or refreshes the push subscription with browser FCM
   * and registers it with the backend database.
   */
  const registerAndSyncPush = useCallback(
    async (requirePrompt = false): Promise<boolean> => {
      try {
        if (
          typeof window === "undefined" ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        ) {
          return false;
        }

        // 1. Request or verify OS notification permission
        if (Notification.permission !== "granted") {
          if (!requirePrompt) return false;
          const result = await Notification.requestPermission();
          setPermission(result);
          if (result !== "granted") {
            setError("Notification permission was denied.");
            return false;
          }
        } else {
          setPermission("granted");
        }

        // 2. Fetch server VAPID public key
        const { publicKey } = await fetchVapidPublicKey();
        if (!publicKey) {
          if (requirePrompt) setError("Push server public key is unavailable.");
          return false;
        }

        // 3. Ensure service worker is registered and active
        let reg = (await navigator.serviceWorker.getRegistration()) || null;
        if (!reg) {
          reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        }
        if (reg && !reg.active) {
          await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<void>((res) => setTimeout(res, 1500)),
          ]);
        }

        const convertedVapidKey = urlBase64ToUint8Array(publicKey.trim());

        // 4. Query or create fresh subscription
        let sub = await reg?.pushManager?.getSubscription();
        if (!sub) {
          try {
            sub = await reg?.pushManager?.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey as unknown as BufferSource,
            });
          } catch (subErr) {
            try {
              sub = await reg?.pushManager?.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey.buffer as BufferSource,
              });
            } catch {
              throw subErr;
            }
          }
        }

        // 5. Sync active subscription with server
        if (sub) {
          await subscribePush(sub.toJSON());
          setIsSubscribed(true);
          setError(null);
          return true;
        }
        return false;
      } catch (err: unknown) {
        if (requirePrompt) {
          console.error("Push subscription failure details:", err);
          let msg = err instanceof Error ? err.message : "Failed to enable notifications.";
          if (msg.toLowerCase().includes("push service error")) {
            msg =
              "Browser push service error. If you are using Brave, enable 'Use Google services for push messaging' in Settings > Privacy. If in Chrome/Edge, check chrome://gcm-internals and ensure Windows OS notifications are enabled for your browser.";
          }
          setError(msg);
        }
        return false;
      }
    },
    [],
  );

  // Initialize and auto-heal on load
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      setIsSupported(true);
      const perm = Notification.permission;
      setPermission(perm);

      void (async () => {
        try {
          const reg =
            (await navigator.serviceWorker.getRegistration()) ||
            (await Promise.race([
              navigator.serviceWorker.ready,
              new Promise<null>((res) => setTimeout(() => res(null), 1500)),
            ]));

          const sub = await reg?.pushManager?.getSubscription();
          if (sub) {
            setIsSubscribed(true);
            // Re-sync with backend to ensure the subscription is fresh and alive in database
            void subscribePush(sub.toJSON()).catch(() => {});
          } else if (perm === "granted") {
            // Permission was already granted! Automatically renew subscription in background without asking again.
            console.log("Push permission granted but subscription expired/missing: auto-renewing...");
            await registerAndSyncPush(false);
          } else {
            setIsSubscribed(false);
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [registerAndSyncPush]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError("Push notifications are not supported in this browser.");
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      return await registerAndSyncPush(true);
    } finally {
      setBusy(false);
    }
  }, [isSupported, registerAndSyncPush]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    setBusy(true);
    setError(null);

    try {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ||
        (await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((res) => setTimeout(() => res(null), 1500)),
        ]));
      const sub = await reg?.pushManager?.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await unsubscribePush(endpoint).catch(() => {});
      }

      setIsSubscribed(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to unsubscribe.";
      setError(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    permission,
    busy,
    error,
    subscribe,
    unsubscribe,
  };
}
