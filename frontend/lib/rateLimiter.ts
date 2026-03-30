/**
 * Simple in-memory rate limiter
 * Limits each IP to `maxRequests` downloads per `windowMs` milliseconds
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS   = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 3;         // max 3 downloads per minute per IP

export function rateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now    = Date.now();
  const entry  = store.get(ip);

  // First request from this IP, or window has expired — reset
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterSeconds: 0 };
  }

  // Within the window
  if (entry.count < MAX_REQUESTS) {
    entry.count++;
    store.set(ip, entry);
    return { allowed: true, remaining: MAX_REQUESTS - entry.count, retryAfterSeconds: 0 };
  }

  // Limit exceeded
  const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
  return { allowed: false, remaining: 0, retryAfterSeconds };
}