import { useCallback, useEffect, useState } from "react";

/**
 * The Chromium install event. It is not in the DOM lib types because it is not
 * a standard yet, and it is the only way to offer installation from our own UI
 * instead of the browser's address-bar affordance.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** True when the app is already running as an installed window. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    // iOS Safari, which has no display-mode support for installed web apps.
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

interface InstallPrompt {
  /** Only true when the browser has actually offered installation. */
  canInstall: boolean;
  install: () => Promise<void>;
}

/**
 * Captures the browser's install offer so the app can present it once, from a
 * quiet control the user chose to press. Browsers that never fire the event
 * (Firefox, Safari) leave `canInstall` false and no install UI is rendered.
 */
export function useInstallPrompt(): InstallPrompt {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(nativeEvent: Event): void {
      // Suppress the browser's own mini-infobar; the app offers it instead.
      nativeEvent.preventDefault();
      setEvent(nativeEvent as BeforeInstallPromptEvent);
    }

    function handleInstalled(): void {
      setEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) {
      return;
    }

    await event.prompt();
    await event.userChoice;

    // The event is single-use, whatever the user chose.
    setEvent(null);
  }, [event]);

  return { canInstall: event !== null && !isStandalone(), install };
}
