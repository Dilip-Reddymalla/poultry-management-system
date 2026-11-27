/**
 * Platform detection for auth-cookie routing.
 *
 * Safari / all iOS browsers enforce Intelligent Tracking Prevention (ITP),
 * which blocks third-party cookies. For those devices the app must talk to the
 * API same-origin (via a reverse proxy) so session cookies are first-party.
 * Other browsers can keep the direct cross-origin flow.
 */
export function needsSameOriginCookies(): boolean {
  if (typeof navigator === "undefined" || !navigator.userAgent) return false;

  const ua = navigator.userAgent;
  const sp = (ua || "").toLowerCase();

  // iOS: every browser (Safari, Chrome, Edge, Firefox) runs on WebKit, so ITP
  // applies to every browser there.
  if (/iphone|ipad|ipod/.test(sp)) return true;

  // iPadOS 13+ reports a macOS user agent; detect real iPads via touch support,
  // and real Macs via WebKit/Safari (not Chrome/Firefox/Edge).
  const isMac = /macintosh|mac os x/.test(sp);
  if (isMac) {
    const touchMac = typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
    const isWebKitSafari =
      /safari/.test(sp) && !/chrome|crios|edg|fxios|firefox/.test(sp);
    if (touchMac || isWebKitSafari) return true;
  }

  return false;
}
