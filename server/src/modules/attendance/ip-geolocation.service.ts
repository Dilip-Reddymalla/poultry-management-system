import type { Request } from "express";

export interface IpLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number; // radius in meters, default 25000 (25km)
  city: string;
  region: string;
  country: string;
  isp?: string | undefined;
  ip: string;
  isLoopback: boolean;
}

// In-memory cache for IP lookup to avoid redundant network queries (1 hour TTL)
interface CacheEntry {
  result: IpLocationResult;
  expiresAt: number;
}
const ipCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export function extractClientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  return (req.socket?.remoteAddress || req.ip || "127.0.0.1").replace(/^::ffff:/, "");
}

export function isPrivateOrLoopbackIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fe80:")
  );
}

/**
 * Resolves an IP address to approximate geographic coordinates.
 * Priority: Cache -> Free IP API -> Fallback Default.
 */
export async function resolveClientLocation(req: Request): Promise<IpLocationResult> {
  const ip = extractClientIp(req);

  // Check cache
  const cached = ipCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // If local / private LAN IP during development, query public IP or provide local dev coordinates
  if (isPrivateOrLoopbackIp(ip)) {
    try {
      const publicIpRes = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(2000),
      });
      if (publicIpRes.ok) {
        const data = (await publicIpRes.json()) as { ip: string };
        if (data.ip && !isPrivateOrLoopbackIp(data.ip)) {
          return await lookupPublicIp(data.ip, ip);
        }
      }
    } catch {
      // Offline or network error
    }

    // Default regional location (Hyderabad / Telangana center of poultry cluster)
    const fallbackLocal: IpLocationResult = {
      latitude: 17.385044,
      longitude: 78.486671,
      accuracy: 35000,
      city: "Local Network",
      region: "Telangana",
      country: "India",
      isp: "Development LAN",
      ip,
      isLoopback: true,
    };
    return fallbackLocal;
  }

  return await lookupPublicIp(ip, ip);
}

async function lookupPublicIp(queryIp: string, originalClientIp: string): Promise<IpLocationResult> {
  try {
    const res = await fetch(`http://ip-api.com/json/${queryIp}?fields=status,message,country,regionName,city,lat,lon,isp,query`, {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        status: string;
        lat?: number;
        lon?: number;
        city?: string;
        regionName?: string;
        country?: string;
        isp?: string;
        query?: string;
      };

      if (data.status === "success" && data.lat !== undefined && data.lon !== undefined) {
        const result: IpLocationResult = {
          latitude: data.lat,
          longitude: data.lon,
          accuracy: 25000, // IP geolocation has typical 25km accuracy radius
          city: data.city || "Unknown City",
          region: data.regionName || "Unknown Region",
          country: data.country || "Unknown Country",
          isp: data.isp,
          ip: originalClientIp,
          isLoopback: false,
        };

        ipCache.set(originalClientIp, {
          result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        return result;
      }
    }
  } catch {
    // Service timeout or offline
  }

  // Backup fallback
  return {
    latitude: 17.385044,
    longitude: 78.486671,
    accuracy: 50000,
    city: "Approximate Region",
    region: "India",
    country: "India",
    ip: originalClientIp,
    isLoopback: false,
  };
}
