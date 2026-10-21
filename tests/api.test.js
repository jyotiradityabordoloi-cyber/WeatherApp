import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'test-secret-key-123';
process.env.WEATHERAPI_KEY = KEY;
const { default: handler } = await import('../api/weather.js');

const realFetch = globalThis.fetch;
let calls;
let ipCounter = 0;

function mockFetch(impl) {
  globalThis.fetch = async (url, opts) => {
    calls.push(String(url));
    return impl(String(url), opts);
  };
}

function run(query, { method = 'GET', ip } = {}) {
  const req = {
    method,
    query,
    url: '/api/weather',
    headers: { 'x-forwarded-for': ip || `10.0.0.${++ipCounter}` },
  };
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
  };
  return handler(req, res).then(() => res);
}

const SAMPLE = '{"location":{"name":"Patna","region":"Bihar","country":"India","localtime":"2026-10-21 16:30"},"current":{"temp_c":31.2,"humidity":58,"wind_kph":9.4,"condition":{"text":"Sunny","icon":"//cdn.weatherapi.com/weather/64x64/day/113.png","code":1000}}}';

beforeEach(() => { calls = []; process.env.WEATHERAPI_KEY = KEY; });
afterEach(() => { globalThis.fetch = realFetch; });

test('proxies a successful lookup and forwards the raw body', async () => {
  mockFetch(() => new Response(SAMPLE, { status: 200, headers: { 'content-type': 'application/json' } }));
  const res = await run({ city: '  Patna ' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, SAMPLE, 'body forwarded byte-for-byte');
  assert.match(res.headers['cache-control'], /s-maxage=300/);
  const u = new URL(calls[0]);
  assert.equal(u.origin + u.pathname, 'https://api.weatherapi.com/v1/current.json');
  assert.equal(u.searchParams.get('q'), 'Patna');
  assert.equal(u.searchParams.get('key'), KEY);
});

test('URL-encodes city names', async () => {
  mockFetch(() => new Response(SAMPLE, { status: 200 }));
  await run({ city: 'São Paulo' });
  assert.ok(calls[0].includes('q=S%C3%A3o%20Paulo'));
});

test('forwards upstream errors (unknown city) with status, never cached', async () => {
  const body = '{"error":{"code":1006,"message":"No matching location found."}}';
  mockFetch(() => new Response(body, { status: 400, headers: { 'content-type': 'application/json' } }));
  const res = await run({ city: 'Atlantisx' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body, body);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('forwards invalid-key errors', async () => {
  mockFetch(() => new Response('{"error":{"code":2006,"message":"API key is invalid."}}', { status: 401 }));
  const res = await run({ city: 'Pune' });
  assert.equal(res.statusCode, 401);
});

test('redacts the key if upstream ever echoes it', async () => {
  mockFetch((url) => new Response(`{"echo":"${url}"}`, { status: 200 }));
  const res = await run({ city: 'Pune' });
  assert.ok(!res.body.includes(KEY));
  assert.ok(res.body.includes('[redacted]'));
});

test('rejects bad input without calling upstream', async () => {
  mockFetch(() => assert.fail('should not call upstream'));
  for (const city of [undefined, '', '   ', '<b>', 'x'.repeat(81)]) {
    const res = await run(city === undefined ? {} : { city });
    assert.equal(res.statusCode, 400, String(city));
    assert.equal(JSON.parse(res.body).error.code, 'invalid_city');
  }
  assert.equal(calls.length, 0);
});

test('rejects non-GET methods', async () => {
  const res = await run({ city: 'Pune' }, { method: 'POST' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'GET, HEAD');
});

test('returns 500 when the key is not configured', async () => {
  delete process.env.WEATHERAPI_KEY;
  const res = await run({ city: 'Pune' });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.parse(res.body).error.code, 'missing_api_key');
});

test('maps network failures to 502 and timeouts to 504', async () => {
  mockFetch(() => { throw new TypeError('fetch failed'); });
  assert.equal((await run({ city: 'Pune' })).statusCode, 502);
  mockFetch(() => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
  assert.equal((await run({ city: 'Pune' })).statusCode, 504);
});

test('rate-limits a single client after 30 requests per minute', async () => {
  mockFetch(() => new Response(SAMPLE, { status: 200 }));
  let last;
  for (let i = 0; i < 31; i++) last = await run({ city: 'Pune' }, { ip: '9.9.9.9' });
  assert.equal(last.statusCode, 429);
  assert.ok(Number(last.headers['retry-after']) >= 1);
});
