/**
 * Mood engine: turns temperature, humidity and wind into one deterministic mood.
 *
 * Priority order (first matching rule wins; ranges are inclusive):
 *   1. Scorching    temp ≥ 38 °C
 *   2. Freezing     temp ≤ 5 °C
 *   3. Muggy        humidity ≥ 80 % and temp ≥ 28 °C
 *   4. Windy        wind ≥ 30 km/h
 *   5. Pleasant     20–30 °C, humidity ≤ 60 %, wind ≤ 20 km/h
 *   6. Comfortable  15–30 °C, humidity ≤ 75 %, wind ≤ 30 km/h
 *   7. Mixed        everything else (including missing data)
 *
 * Extreme temperatures come first because they matter most for safety, then
 * the "feel" modifiers (humidity, wind), then the comfortable bands from the
 * narrowest (Pleasant) to the broadest (Comfortable).
 *
 * Pure and framework-free, so it runs in the browser and in Node tests.
 */

export const MOODS = Object.freeze({
  scorching: {
    label: 'Scorching',
    description: 'Extreme heat. Stay indoors at midday, drink water often and keep outings short.',
  },
  freezing: {
    label: 'Freezing',
    description: 'Bitterly cold. Wear layers, cover your hands and limit time outside.',
  },
  muggy: {
    label: 'Muggy',
    description: 'Hot and sticky. The air feels heavier than the number says, so take it slow.',
  },
  windy: {
    label: 'Windy',
    description: 'Strong gusts out there. Hold on to loose things and expect it to feel cooler.',
  },
  pleasant: {
    label: 'Pleasant',
    description: 'Warm, dry and calm. A great day to be out and about.',
  },
  comfortable: {
    label: 'Comfortable',
    description: 'Mild and easy-going. Good weather for a walk or errands outside.',
  },
  mixed: {
    label: 'Mixed',
    description: 'A bit of everything today. Check the details below before you head out.',
  },
});

/** Ordered rules: index = priority. Thresholds are product defaults. */
export const MOOD_RULES = Object.freeze([
  { mood: 'scorching', test: ({ temp }) => temp >= 38 },
  { mood: 'freezing', test: ({ temp }) => temp <= 5 },
  { mood: 'muggy', test: ({ temp, humidity }) => humidity >= 80 && temp >= 28 },
  { mood: 'windy', test: ({ wind }) => wind >= 30 },
  { mood: 'pleasant', test: ({ temp, humidity, wind }) => temp >= 20 && temp <= 30 && humidity <= 60 && wind <= 20 },
  { mood: 'comfortable', test: ({ temp, humidity, wind }) => temp >= 15 && temp <= 30 && humidity <= 75 && wind <= 30 },
]);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * @param {{ tempC: number, humidity: number, windKph: number }} input
 * @returns {{ key: string, label: string, description: string, priority: number }}
 */
export function getMood({ tempC, humidity, windKph } = {}) {
  if (!isNum(tempC) || !isNum(humidity) || !isNum(windKph)) {
    return {
      key: 'mixed',
      ...MOODS.mixed,
      description: 'Not enough data to read the mood. Check the details below.',
      priority: MOOD_RULES.length + 1,
    };
  }
  const values = { temp: tempC, humidity, wind: windKph };
  const index = MOOD_RULES.findIndex((rule) => rule.test(values));
  const key = index === -1 ? 'mixed' : MOOD_RULES[index].mood;
  return { key, ...MOODS[key], priority: index === -1 ? MOOD_RULES.length + 1 : index + 1 };
}

/** Convenience wrapper for a WeatherAPI `current` object. */
export function moodFromCurrent(current) {
  return getMood({ tempC: current?.temp_c, humidity: current?.humidity, windKph: current?.wind_kph });
}
