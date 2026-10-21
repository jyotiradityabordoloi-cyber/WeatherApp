# Weather — a CRED-inspired weather dashboard

Search any city (or tap one of ten popular ones) to see current conditions, a
plain-language mood for the day, and the exact API response in raw and
syntax-highlighted JSON. Vanilla HTML/CSS/JS on the front, one Node serverless
function on Vercel at the back. No frameworks, no build step, no dependencies.

## Project structure

```
index.html            Page markup
css/styles.css        All styles (dark theme, responsive, reduced motion)
js/app.js             Wiring: search, chips, tabs, copy, state
js/api.js             Client for /api/weather (cancels stale requests, maps errors)
js/mood.js            Mood engine (pure function, shared with tests)
js/render.js          DOM rendering
js/format.js          Date, number and metric-label helpers
js/json-view.js       JSON syntax highlighter (HTML-escaped)
api/weather.js        Vercel serverless proxy to WeatherAPI
lib/validate.js       Input validation, client IP, rate limiter
tests/                node:test suites (mood, validation, proxy, client)
vercel.json           Security headers (CSP, HSTS…), function limits
deploy.sh             One-command production deploy
```

## Mood engine

`js/mood.js → getMood({ tempC, humidity, windKph })`. First matching rule wins;
ranges are inclusive.

| Priority | Mood        | Condition                                   |
|---------:|-------------|---------------------------------------------|
| 1        | Scorching   | temp ≥ 38 °C                                |
| 2        | Freezing    | temp ≤ 5 °C                                 |
| 3        | Muggy       | humidity ≥ 80 % and temp ≥ 28 °C            |
| 4        | Windy       | wind ≥ 30 km/h                              |
| 5        | Pleasant    | 20–30 °C, humidity ≤ 60 %, wind ≤ 20 km/h   |
| 6        | Comfortable | 15–30 °C, humidity ≤ 75 %, wind ≤ 30 km/h   |
| 7        | Mixed       | everything else, or missing data            |

Safety-relevant extremes come first, then the "feel" modifiers, then the
comfortable bands from narrowest to broadest. Change thresholds in
`MOOD_RULES`; each mood's copy lives in `MOODS`.

## API proxy

`GET /api/weather?city=Patna` → `https://api.weatherapi.com/v1/current.json`

- The key comes from the `WEATHERAPI_KEY` environment variable and never reaches the browser.
- Upstream status code and body are forwarded unchanged (the inspector shows the real response).
- City is trimmed, length-limited (80) and restricted to letters, digits, spaces and `. , ' ( ) -`.
- 8 s upstream timeout (504), network failure (502), GET/HEAD only (405).
- 30 requests/min per IP (429 with `Retry-After`), plus a 5-minute CDN cache per city.
- Defence in depth: the key is redacted from any upstream body that echoes it.

## Run locally

```bash
cp .env.example .env.local     # put your WeatherAPI key in it
npx vercel dev                 # http://localhost:3000
npm test                       # unit + proxy tests, no network needed
```

## Deploy

```bash
VERCEL_TOKEN=your_token WEATHERAPI_KEY=your_key ./deploy.sh
```

This links a `cred-weather` project, stores the key as an encrypted Vercel
environment variable, deploys to production and smoke-tests the live API.
Set `PROJECT_NAME` to use a different project name.

Manual alternative:

```bash
npx vercel link
npx vercel env add WEATHERAPI_KEY production
npx vercel deploy --prod
```

## Notes

- With the PRD rules, a reading like 32 °C / 42 % / 12 km/h is **Mixed** (Pleasant
  tops out at 30 °C). The design mockup labels that example "Pleasant"; widen the
  Pleasant band in `MOOD_RULES` if that's the intended behaviour.
- The rate limiter is in-memory per function instance, so it's a speed bump
  rather than a guarantee. For hard limits, add Vercel Firewall rate-limiting rules.
