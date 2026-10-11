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

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);

      void navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(Boolean(sub));
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError("Push notifications are not supported in this browser.");
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      // 1. Request OS permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setError("Notification permission was denied.");
        return false;
      }

      // 2. Fetch VAPID key
      const { publicKey } = await fetchVapidPublicKey();
      if (!publicKey) {
        throw new Error("Push server public key is unavailable.");
      }

      // 3. Ensure service worker is registered and ready
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const convertedVapidKey = urlBase64ToUint8Array(publicKey.trim());

      // If an old subscription exists with different key, unsubscribe first
      try {
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) {
          await oldSub.unsubscribe();
        }
      } catch {
        // ignore
      }

      console.log("Registering push with public key:", publicKey, "Key bytes:", convertedVapidKey.length);

      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey as unknown as BufferSource,
          });
        } catch (subErr) {
          // Fallback: try raw buffer if Uint8Array was rejected
          try {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey.buffer as BufferSource,
            });
          } catch {
            throw subErr;
          }
        }
      }

      // 4. Send subscription to server
      await subscribePush(sub.toJSON());
      setIsSubscribed(true);
      return true;
    } catch (err: unknown) {
      console.error("Push subscription failure details:", err);
      let msg = err instanceof Error ? err.message : "Failed to enable notifications.";
      
      if (msg.toLowerCase().includes("push service error")) {
        msg = "Browser push service error. If you are using Brave, enable 'Use Google services for push messaging' in Settings > Privacy. If in Chrome/Edge, check chrome://gcm-internals and ensure Windows OS notifications are enabled for your browser.";
      }
      
      setError(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    setBusy(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

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
