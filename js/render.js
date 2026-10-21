/** DOM rendering. All user/API text goes through textContent. */
import {
  parseLocalTime, formatClock, formatDate, round, num, iconUrl, formatBytes,
  feelsLabel, humidityLabel, windLabel, visibilityLabel, uvLabel, cloudLabel,
} from './format.js';
import { renderHighlightedJson } from './json-view.js';

const $ = (id) => document.getElementById(id);

const FACE = (mouth) =>
  `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="currentColor"/><circle cx="11.5" cy="13" r="1.8" fill="var(--bg)"/><circle cx="20.5" cy="13" r="1.8" fill="var(--bg)"/>${mouth}</svg>`;
const MOOD_ICONS = {
  pleasant: FACE('<path d="M10 18.5c3.2 4 8.8 4 12 0" fill="none" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round"/>'),
  comfortable: FACE('<path d="M11 19c2.8 2.3 7.2 2.3 10 0" fill="none" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round"/>'),
  mixed: FACE('<path d="M11 20h10" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round"/>'),
  muggy: FACE('<path d="M11 21c2.8-2.2 7.2-2.2 10 0" fill="none" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round"/><path d="M24.5 6.5c1.4 2 2 3 2 4a2 2 0 0 1-4 0c0-1 .6-2 2-4Z" fill="var(--bg)"/>'),
  scorching: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M16 2.5v3.5M16 26v3.5M2.5 16H6M26 16h3.5M6.5 6.5 9 9M23 23l2.5 2.5M6.5 25.5 9 23M23 9l2.5-2.5"/></g></svg>`,
  freezing: `<svg viewBox="0 0 32 32"><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13"/><path d="m12 5 4 3 4-3M12 27l4-3 4 3M4 14l4.5-1L7 8.6M28 18l-4.5 1 1.5 4.4M4 18l4.5 1L7 23.4M28 14l-4.5-1L25 8.6"/></g></svg>`,
  windy: `<svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M3 12h17a4 4 0 1 0-4-4"/><path d="M3 18h22a4 4 0 1 1-4 4"/><path d="M3 24h9"/></g></svg>`,
};

export function setStatus(text) {
  $('status').textContent = text;
}

export function setHint(text, isError = false) {
  const el = $('search-hint');
  el.textContent = text;
  el.classList.toggle('is-error', isError);
}

/** Highlight the chip that matches the active city (or none). */
export function setActiveChip(city) {
  const target = (city || '').trim().toLowerCase();
  for (const chip of document.querySelectorAll('.chip')) {
    const active = chip.dataset.city.toLowerCase() === target;
    chip.setAttribute('aria-pressed', String(active));
    if (active) revealChip(chip);
  }
}

/** Keep the active chip visible in the horizontal scroller (mobile). */
function revealChip(chip) {
  const wrap = chip.parentElement;
  if (wrap.scrollWidth <= wrap.clientWidth) return;
  const left = chip.offsetLeft;
  const right = left + chip.offsetWidth;
  if (left < wrap.scrollLeft || right > wrap.scrollLeft + wrap.clientWidth) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    wrap.scrollTo({ left: Math.max(0, left - 24), behavior: reduce ? 'auto' : 'smooth' });
  }
}

export function renderChips(cities, onSelect) {
  const wrap = $('city-chips');
  wrap.replaceChildren(
    ...cities.map((city) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.city = city;
      b.textContent = city;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => onSelect(city));
      return b;
    })
  );
}

function showSection(state) {
  const card = $('weather');
  card.dataset.state = state;
  card.setAttribute('aria-busy', String(state === 'loading'));
  $('error-panel').hidden = state !== 'error';
  $('metrics').dataset.state = state;
}

export function renderLoading(city) {
  showSection('loading');
  setStatus(`Loading weather for ${city}`);
}

export function renderError(error, city) {
  showSection('error');
  $('error-title').textContent = error.title;
  $('error-message').textContent = city ? `${error.message} (Searched for “${city}”.)` : error.message;
  $('retry-btn').hidden = !error.retryable;
  setStatus(`${error.title}. ${error.message}`);
}

function setMetric(name, value, note) {
  const card = document.querySelector(`.metric[data-metric="${name}"]`);
  card.querySelector('[data-value]').textContent = value;
  card.querySelector('[data-note]').textContent = note;
}

export function renderWeather({ location, current }, mood) {
  showSection('ready');

  $('city-name').textContent = location.name || '—';
  $('region-country').textContent = [location.region, location.country].filter(Boolean).join(', ') || '—';
  const t = parseLocalTime(location.localtime);
  $('local-date').textContent = formatDate(t);
  $('local-clock').textContent = formatClock(t);

  const temp = round(current.temp_c);
  $('temp-value').textContent = temp ?? '--';
  $('cond-text').textContent = current.condition?.text || '';
  const updated = parseLocalTime(current.last_updated);
  $('updated').textContent = updated ? `Updated ${formatClock(updated)} local time` : '';

  const icon = $('cond-icon');
  const src = iconUrl(current.condition?.icon);
  if (src) {
    icon.src = src.replace('/64x64/', '/128x128/');
    icon.onerror = () => { icon.onerror = null; icon.src = src; };
    icon.alt = current.condition?.text || '';
    icon.hidden = false;
  } else {
    icon.hidden = true;
  }

  const moodEl = $('mood');
  $('weather').dataset.mood = mood.key;
  moodEl.dataset.mood = mood.key;
  $('mood-icon').innerHTML = MOOD_ICONS[mood.key] || MOOD_ICONS.mixed;
  $('mood-label').textContent = mood.label;
  $('mood-desc').textContent = mood.description;

  setMetric('feels', `${num(current.feelslike_c)}°C`, feelsLabel(current.feelslike_c, current.temp_c));
  setMetric('humidity', `${num(current.humidity)}%`, humidityLabel(current.humidity));
  setMetric('wind', `${num(current.wind_kph)} km/h`, [windLabel(current.wind_kph), current.wind_dir].filter(Boolean).join(', from '));
  setMetric('visibility', `${num(current.vis_km)} km`, visibilityLabel(current.vis_km));
  setMetric('uv', num(current.uv, 1), uvLabel(current.uv));
  setMetric('cloud', `${num(current.cloud)}%`, cloudLabel(current.cloud));

  setStatus(`${location.name}: ${temp ?? '--'}°C, ${current.condition?.text || ''}. Mood: ${mood.label}.`);
}

/** Fill both inspector tabs from the latest response (success or error). */
export function renderInspector(result, city) {
  $('code-empty').hidden = true;
  $('copy-btn').disabled = !result.text;

  const raw = $('raw-json');
  raw.textContent = result.text || '(empty response body)';

  const formatted = $('formatted-json');
  if (result.isJson) {
    formatted.classList.remove('is-notice');
    formatted.innerHTML = renderHighlightedJson(result.json);
  } else {
    formatted.classList.add('is-notice');
    formatted.textContent = result.text
      ? 'This response isn’t JSON, so there’s nothing to format. The Raw JSON tab shows it exactly as received.'
      : 'No response body was received.';
  }

  const bytes = new TextEncoder().encode(result.text || '').length;
  const meta = $('response-meta');
  meta.replaceChildren(
    ...[
      [`HTTP ${result.status || '—'}`, result.ok ? 'ok' : 'bad'],
      [formatBytes(bytes)],
      [`${result.ms} ms`],
      ['GET /api/weather?city=' + encodeURIComponent(city)],
    ].map(([text, tone]) => {
      const s = document.createElement('span');
      s.textContent = text;
      if (tone) s.dataset.tone = tone;
      return s;
    })
  );
  $('inspector-sub').textContent = `Latest response for “${city}”, as returned by WeatherAPI through our server.`;
}

const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const METRIC_ICONS = {
  feels: `<path ${S} d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z"/><path ${S} d="M12 11v6"/>`,
  humidity: `<path ${S} d="M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/>`,
  wind: `<path ${S} d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>`,
  visibility: `<path ${S} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle ${S} cx="12" cy="12" r="3"/>`,
  uv: `<circle ${S} cx="12" cy="12" r="4"/><path ${S} d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
  cloud: `<path ${S} d="M7.5 18.5h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7.5 18.5Z"/>`,
};

/** Insert the decorative icon at the top of each metric card. */
export function decorateMetrics() {
  for (const card of document.querySelectorAll('.metric')) {
    const paths = METRIC_ICONS[card.dataset.metric];
    if (!paths || card.querySelector('.metric-icon')) continue;
    card.insertAdjacentHTML('afterbegin', `<svg class="metric-icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`);
  }
}
