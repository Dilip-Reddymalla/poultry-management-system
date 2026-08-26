import { registerSW } from "virtual:pwa-register";

/**
 * Registers the generated service worker. It precaches the application shell
 * only — no API response is ever stored — so an installed copy can start up
 * offline and then report the network honestly.
 *
 * The build uses `autoUpdate`: when a new deployment is detected the fresh
 * worker takes over and the page reloads itself, so nobody runs a stale client
 * against a newer API.
 */
export function registerServiceWorker(): void {
  registerSW({ immediate: true });
}
