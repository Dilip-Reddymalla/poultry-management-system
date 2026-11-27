import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestHandler } from "express";

interface RequestContext {
  userAgent?: string | undefined;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Captures per-request metadata (currently the User-Agent) so service layer
 * code can store it without threading it through every call site.
 */
export const requestContextMiddleware: RequestHandler = (req, _res, next) => {
  storage.run({ userAgent: req.headers["user-agent"] }, () => next());
};

export function getRequestUserAgent(): string | undefined {
  return storage.getStore()?.userAgent;
}

/**
 * Turn a raw User-Agent string into a friendly, short device label.
 */
export function parseUserAgent(ua: string | undefined): string | null {
  if (!ua || typeof ua !== "string" || ua.trim() === "") return null;
  const s = ua;

  let os = "Unknown OS";
  if (/windows/i.test(s)) os = "Windows";
  else if (/android/i.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(s)) os = "iOS";
  else if (/mac os x|macintosh/i.test(s)) os = "macOS";
  else if (/linux/i.test(s)) os = "Linux";

  let browser = "Browser";
  if (/edg\//i.test(s)) browser = "Edge";
  else if (/firefox\//i.test(s)) browser = "Firefox";
  else if (/samsungbrowser/i.test(s)) browser = "Samsung Internet";
  else if (/crios/i.test(s)) browser = "Chrome (iOS)";
  else if (/fxios/i.test(s)) browser = "Firefox (iOS)";
  else if (/chrome\//i.test(s)) browser = "Chrome";
  else if (/safari/i.test(s)) browser = "Safari";

  const mobile = /mobi|android|iphone|ipad|ipod/i.test(s);
  return `${browser} on ${os}${mobile ? " · Mobile" : ""}`;
}
