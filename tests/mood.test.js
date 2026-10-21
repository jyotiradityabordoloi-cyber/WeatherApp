import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMood, moodFromCurrent, MOOD_RULES, MOODS } from '../js/mood.js';

const mood = (tempC, humidity, windKph) => getMood({ tempC, humidity, windKph }).key;

test('each rule fires on its own', () => {
  assert.equal(mood(40, 30, 5), 'scorching');
  assert.equal(mood(2, 50, 5), 'freezing');
  assert.equal(mood(31, 85, 5), 'muggy');
  assert.equal(mood(25, 50, 35), 'windy');
  assert.equal(mood(25, 50, 10), 'pleasant');
  assert.equal(mood(17, 70, 25), 'comfortable');
  assert.equal(mood(12, 90, 10), 'mixed');
});

test('boundaries are inclusive', () => {
  assert.equal(mood(38, 10, 0), 'scorching');
  assert.equal(mood(37.9, 10, 0), 'mixed');
  assert.equal(mood(5, 10, 0), 'freezing');
  assert.equal(mood(5.1, 10, 0), 'mixed');
  assert.equal(mood(28, 80, 0), 'muggy');
  assert.equal(mood(28, 79, 0), 'mixed', 'just under muggy, but too humid for comfortable');
  assert.equal(mood(28, 75, 0), 'comfortable');
  assert.equal(mood(25, 50, 30), 'windy');
  assert.equal(mood(20, 60, 20), 'pleasant');
  assert.equal(mood(30, 60, 20), 'pleasant');
  assert.equal(mood(30.1, 60, 20), 'mixed');
  assert.equal(mood(15, 75, 29.9), 'comfortable');
  assert.equal(mood(14.9, 75, 10), 'mixed');
});

test('priority order resolves overlaps', () => {
  assert.equal(mood(40, 90, 50), 'scorching', 'heat beats humidity and wind');
  assert.equal(mood(0, 50, 60), 'freezing', 'cold beats wind');
  assert.equal(mood(32, 85, 40), 'muggy', 'muggy beats windy');
  assert.equal(mood(25, 40, 32), 'windy', 'windy beats pleasant');
  assert.equal(mood(25, 40, 10), 'pleasant', 'pleasant beats comfortable');
});

test('the mockup example (32 °C, 42 %, 12 km/h) is Mixed under the PRD rules', () => {
  // 32 °C is above both comfortable bands (max 30 °C) and below 38 °C.
  assert.equal(mood(32, 42, 12), 'mixed');
});

test('missing or invalid data falls back to Mixed', () => {
  assert.equal(getMood({}).key, 'mixed');
  assert.equal(getMood({ tempC: NaN, humidity: 40, windKph: 5 }).key, 'mixed');
  assert.equal(moodFromCurrent(null).key, 'mixed');
});

test('every mood has a label and description; rules are ordered', () => {
  for (const [k, v] of Object.entries(MOODS)) {
    assert.ok(v.label && v.description, k);
  }
  assert.deepEqual(MOOD_RULES.map((r) => r.mood), ['scorching', 'freezing', 'muggy', 'windy', 'pleasant', 'comfortable']);
  assert.equal(getMood({ tempC: 25, humidity: 40, windKph: 10 }).priority, 5);
});

test('reads WeatherAPI current fields', () => {
  assert.equal(moodFromCurrent({ temp_c: 24, humidity: 55, wind_kph: 8 }).key, 'pleasant');
});
