/**
 * Request validation and lightweight abuse protection for /api/weather.
 * Shared by the serverless function and the test suite.
 */

export const CITY_MAX_LENGTH = 80;

// Letters (any script), combining marks, digits (postcodes), spaces and
// the punctuation that appears in real place names: . , ' ’ ( ) -
const CITY_PATTERN = /^[\p{L}\p{M}\d .,'’()-]+$/u;

/**
 * @param {unknown} input
 * @returns {{ ok: true, city: string } | { ok: false, message: string }}
 */
export function validateCity(input) {
  const value = Array.isArray(input) ? input[0] : input;
  if (typeof value !== 'string') {
    return { ok: false, message: 'Add a city to the request, for example /api/weather?city=Patna.' };
  }
  const city = value.trim().replace(/\s+/g, ' ');
  if (city.length === 0) {
    return { ok: false, message: 'Enter a city name to search.' };
  }
  if (city.length > CITY_MAX_LENGTH) {
    return { ok: false, message: `City names can be up to ${CITY_MAX_LENGTH} characters.` };
  }
  if (!CITY_PATTERN.test(city)) {
    return { ok: false, message: 'City names can only contain letters, numbers, spaces and . , \' ( ) -' };
  }
  return { ok: true, city };
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req) {
  const headers = req.headers || {};
  const forwarded = headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return first || headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Fixed-window, in-memory rate limiter. It lives per function instance, so it
 * is a speed bump rather than a hard guarantee; the CDN cache in front of the
 * function absorbs repeat lookups for the same city.
 */
export function createRateLimiter({ limit = 30, windowMs = 60_000, maxKeys = 5_000, now = Date.now } = {}) {
  const hits = new Map();
  return {
    limit,
    hit(key) {
      const t = now();
      if (hits.size > maxKeys) {
        for (const [k, v] of hits) if (v.reset <= t) hits.delete(k);
        if (hits.size > maxKeys) hits.clear();
      }
      let entry = hits.get(key);
      if (!entry || entry.reset <= t) {
        entry = { count: 0, reset: t + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return {
        ok: entry.count <= limit,
        remaining: Math.max(0, limit - entry.count),
        retryAfterSec: Math.max(1, Math.ceil((entry.reset - t) / 1000)),
      };
    },
  };
}
