/**
 * Client for our own /api/weather proxy. Never talks to WeatherAPI directly.
 *
 * Each call cancels the previous in-flight request and tags its result with a
 * sequence number, so a slow earlier response can never overwrite a newer one.
 */

const CLIENT_TIMEOUT_MS = 12_000;
let sequence = 0;
let inflight = null;

/**
 * @returns {Promise<{ stale: boolean, ok: boolean, status: number, text: string,
 *   json: any, isJson: boolean, ms: number, error?: object }>}
 */
export async function fetchWeather(city) {
  const id = ++sequence;
  inflight?.abort();
  const controller = new AbortController();
  inflight = controller;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLIENT_TIMEOUT_MS);
  const started = performance.now();

  try {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    const stale = id !== sequence;
    let json = null;
    let isJson = false;
    try {
      json = JSON.parse(text);
      isJson = true;
    } catch {
      /* non-JSON body (e.g. an HTML error page) is handled by the UI */
    }
    const result = { stale, ok: res.ok, status: res.status, text, json, isJson, ms: Math.round(performance.now() - started) };
    if (!res.ok || !json?.current) result.error = classifyError(result);
    return result;
  } catch (err) {
    const stale = id !== sequence;
    const result = { stale, ok: false, status: 0, text: '', json: null, isJson: false, ms: Math.round(performance.now() - started) };
    result.error = timedOut
      ? { title: 'The request timed out', message: 'The weather service is slow right now. Try again in a moment.', retryable: true }
      : { title: 'No connection', message: 'Check your internet connection, then try again.', retryable: true };
    if (!stale) result.text = `${result.error.title}. ${err?.message || ''}`.trim();
    return result;
  } finally {
    clearTimeout(timer);
    if (inflight === controller) inflight = null;
  }
}

/** Map proxy and WeatherAPI error responses to plain-language messages. */
export function classifyError({ status, json, isJson }) {
  const code = json?.error?.code;
  const upstreamMsg = typeof json?.error?.message === 'string' ? json.error.message : '';

  if (status === 200 && isJson && !json?.current) {
    return { title: 'Incomplete response', message: 'The weather service sent data without current conditions. Try again.', retryable: true };
  }
  if (code === 1006) {
    return { title: 'City not found', message: 'Check the spelling, or try a larger city nearby.', retryable: false };
  }
  if (code === 'invalid_city' || code === 1003 || code === 1005) {
    return { title: 'Check the city name', message: upstreamMsg || 'That city name could not be searched.', retryable: false };
  }
  if (status === 429 || code === 'rate_limited') {
    return { title: 'Too many searches', message: 'Wait a minute, then try again.', retryable: true };
  }
  if (code === 2007) {
    return { title: 'Daily limit reached', message: 'The weather service quota is used up for now. Try again later.', retryable: true };
  }
  if (status === 401 || status === 403 || [1002, 2006, 2008, 2009].includes(code) || code === 'missing_api_key') {
    return { title: 'Weather service unavailable', message: 'The server’s API key is missing or invalid. The site owner needs to update it.', retryable: false };
  }
  if (code === 'upstream_timeout' || status === 504) {
    return { title: 'The request timed out', message: 'The weather service is slow right now. Try again in a moment.', retryable: true };
  }
  if (status >= 500 || status === 0) {
    return { title: 'Weather service unavailable', message: 'Something went wrong upstream. Try again in a moment.', retryable: true };
  }
  return { title: 'Search failed', message: upstreamMsg || `The server answered with status ${status}.`, retryable: true };
}
