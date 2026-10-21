import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightLine, renderHighlightedJson, escapeHtml } from '../js/json-view.js';
import { classifyError } from '../js/api.js';
import { parseLocalTime, formatClock, formatDate, iconUrl, uvLabel, windLabel } from '../js/format.js';

test('highlights keys, strings, numbers, booleans and null', () => {
  const html = renderHighlightedJson({ a: 'x', n: -1.5, t: true, f: false, z: null });
  assert.match(html, /<span class="j-key">&quot;a&quot;<\/span>:/);
  assert.match(html, /<span class="j-str">&quot;x&quot;<\/span>/);
  assert.match(html, /<span class="j-num">-1.5<\/span>/);
  assert.match(html, /<span class="j-bool">true<\/span>/);
  assert.match(html, /<span class="j-bool">false<\/span>/);
  assert.match(html, /<span class="j-null">null<\/span>/);
});

test('escapes HTML inside JSON values', () => {
  const html = highlightLine('  "k": "<img src=x onerror=alert(1)>",');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('numbers inside strings are not highlighted as numbers', () => {
  const html = highlightLine('    "localtime": "2026-10-21 16:32"');
  assert.ok(!html.includes('j-num'));
});

test('classifies error responses', () => {
  assert.equal(classifyError({ status: 400, json: { error: { code: 1006 } }, isJson: true }).title, 'City not found');
  assert.equal(classifyError({ status: 401, json: { error: { code: 2006 } }, isJson: true }).retryable, false);
  assert.equal(classifyError({ status: 403, json: { error: { code: 2007 } }, isJson: true }).title, 'Daily limit reached');
  assert.equal(classifyError({ status: 429, json: { error: { code: 'rate_limited' } }, isJson: true }).title, 'Too many searches');
  assert.equal(classifyError({ status: 502, json: null, isJson: false }).retryable, true);
  assert.equal(classifyError({ status: 504, json: { error: { code: 'upstream_timeout' } }, isJson: true }).title, 'The request timed out');
});

test('formats WeatherAPI local time without timezone shift', () => {
  const t = parseLocalTime('2026-10-21 16:32');
  assert.equal(formatDate(t), 'Wed, 21 Oct 2026');
  assert.equal(formatClock(t), '04:32 PM');
  assert.equal(formatClock(parseLocalTime('2026-01-01 0:05')), '12:05 AM');
  assert.equal(parseLocalTime('nonsense'), null);
});

test('only trusts WeatherAPI icon URLs and forces https', () => {
  assert.equal(iconUrl('//cdn.weatherapi.com/weather/64x64/day/113.png'), 'https://cdn.weatherapi.com/weather/64x64/day/113.png');
  assert.equal(iconUrl('javascript:alert(1)'), '');
  assert.equal(iconUrl('//evil.example/x.png'), '');
});

test('metric labels', () => {
  assert.equal(uvLabel(6), 'High');
  assert.equal(windLabel(12), 'Light breeze');
});
