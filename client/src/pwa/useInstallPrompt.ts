import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

// Attach early at script load time so the event is captured even if React takes time to mount
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    // Prevent standard mini-infobar on mobile Chrome
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** True when the app is already running as an installed window. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    // iOS Safari standalone indicator
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export type PlatformType = "ios" | "android" | "desktop" | "other";

export function detectPlatform(): PlatformType {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  
  // iOS detection (iPad, iPhone, iPod or iPad OS Safari)
  const isIos =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIos) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) return "desktop";

  return "other";
}

export interface InstallPrompt {
  /** True when the browser has supplied a native one-click install prompt event */
  canInstall: boolean;
  /** True if already running inside an installed standalone window */
  isInstalled: boolean;
  /** The current user's OS / platform for targeted instructions */
  platform: PlatformType;
  /** Trigger the native browser install dialog */
  install: () => Promise<boolean>;
}

export function useInstallPrompt(): InstallPrompt {
  const promptEvent = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [platform, setPlatform] = useState<PlatformType>("other");

  useEffect(() => {
    setInstalled(isStandalone());
    setPlatform(detectPlatform());

    function onDisplayModeChange(): void {
      setInstalled(isStandalone());
    }

    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", onDisplayModeChange);
    return () => {
      mq.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    const activePrompt = deferredPrompt;
    await activePrompt.prompt();
    const choice = await activePrompt.userChoice;

    if (choice.outcome === "accepted") {
      deferredPrompt = null;
      notifyListeners();
      return true;
    }

    // Dismissed: event is single use in Chrome
    deferredPrompt = null;
    notifyListeners();
    return false;
  }, []);

  return {
    canInstall: promptEvent !== null && !installed,
    isInstalled: installed,
    platform,
    install,
  };
}
