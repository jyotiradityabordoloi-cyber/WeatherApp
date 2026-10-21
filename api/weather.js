/**
 * GET /api/weather?city=Patna
 *
 * Server-side proxy to WeatherAPI's current-weather endpoint. The API key is
 * read from WEATHERAPI_KEY and never leaves the server. The upstream status
 * and body are forwarded unchanged so the client can show the real response.
 */
import { validateCity, clientIp, createRateLimiter } from '../lib/validate.js';

const UPSTREAM_URL = 'https://api.weatherapi.com/v1/current.json';
const UPSTREAM_TIMEOUT_MS = 8_000;
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

function sendError(res, status, code, message, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify({ error: { code, message, source: 'proxy' } }));
}

function readCityParam(req) {
  if (req.query && 'city' in req.query) return req.query.city;
  try {
    return new URL(req.url || '', 'http://localhost').searchParams.get('city');
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendError(res, 405, 'method_not_allowed', 'Use GET for this endpoint.', { Allow: 'GET, HEAD' });
  }

  const rate = limiter.hit(clientIp(req));
  res.setHeader('X-RateLimit-Limit', String(limiter.limit));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  if (!rate.ok) {
    return sendError(res, 429, 'rate_limited', 'Too many searches in a short time. Try again in a minute.', {
      'Retry-After': String(rate.retryAfterSec),
    });
  }

  const validation = validateCity(readCityParam(req));
  if (!validation.ok) return sendError(res, 400, 'invalid_city', validation.message);

  const key = process.env.WEATHERAPI_KEY;
  if (!key) {
    return sendError(res, 500, 'missing_api_key', 'The server has no weather API key configured.');
  }

  const url = `${UPSTREAM_URL}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(validation.city)}&aqi=no`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let upstream;
  let body;
  try {
    upstream = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    body = await upstream.text();
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    console.error('[weather] upstream request failed:', timedOut ? 'timeout' : err?.message);
    return timedOut
      ? sendError(res, 504, 'upstream_timeout', 'The weather service took too long to respond.')
      : sendError(res, 502, 'upstream_unreachable', 'The weather service could not be reached.');
  } finally {
    clearTimeout(timer);
  }

  // Defence in depth: never echo the key, even if upstream did.
  if (body.includes(key)) body = body.split(key).join('[redacted]');

  res.statusCode = upstream.status;
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain; charset=utf-8');
  res.setHeader('X-Upstream-Status', String(upstream.status));
  res.setHeader(
    'Cache-Control',
    upstream.ok ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=60' : 'no-store'
  );
  res.end(req.method === 'HEAD' ? undefined : body);
}
