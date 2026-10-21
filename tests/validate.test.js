import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCity, createRateLimiter, clientIp } from '../lib/validate.js';

test('accepts real city names', () => {
  for (const c of ['Patna', 'New Delhi', 'São Paulo', "Côte d'Ivoire", 'Zürich', 'München', 'Washington, D.C.', 'Stratford-upon-Avon', 'बेंगलुरु', '東京', 'SW1A']) {
    assert.equal(validateCity(c).ok, true, c);
  }
});

test('trims and collapses whitespace', () => {
  assert.deepEqual(validateCity('   New    Delhi  '), { ok: true, city: 'New Delhi' });
});

test('rejects empty, too long and unsafe input', () => {
  assert.equal(validateCity('').ok, false);
  assert.equal(validateCity('    ').ok, false);
  assert.equal(validateCity(undefined).ok, false);
  assert.equal(validateCity('a'.repeat(81)).ok, false);
  assert.equal(validateCity('<script>').ok, false);
  assert.equal(validateCity('Paris&key=abc').ok, false);
  assert.equal(validateCity('../../etc').ok, false);
});

test('rate limiter blocks after the limit and resets', () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  assert.equal(rl.hit('a').ok, true);
  assert.equal(rl.hit('a').ok, true);
  assert.equal(rl.hit('a').ok, true);
  const blocked = rl.hit('a');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterSec, 1);
  assert.equal(rl.hit('b').ok, true, 'other clients unaffected');
  t = 1001;
  assert.equal(rl.hit('a').ok, true, 'window resets');
});

test('client IP comes from the first x-forwarded-for entry', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } }), '1.2.3.4');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '::1' } }), '::1');
});
