/** App wiring: search, chips, state, tabs and copy. */
import { fetchWeather } from './api.js';
import { moodFromCurrent } from './mood.js';
import * as ui from './render.js';

export const POPULAR_CITIES = [
  'New Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai',
  'Kolkata', 'Pune', 'Patna', 'Jaipur', 'London',
];
const DEFAULT_CITY = 'New Delhi';
const MAX_LEN = 80;

const state = { city: null, lastResult: null, activeTab: 'formatted' };

const input = document.getElementById('city-input');

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

async function search(rawCity, { fromChip = false } = {}) {
  const city = normalize(rawCity);
  if (!city) {
    ui.setHint('Enter a city name to search.', true);
    input.focus();
    return;
  }
  if (city.length > MAX_LEN) {
    ui.setHint(`City names can be up to ${MAX_LEN} characters.`, true);
    return;
  }
  ui.setHint('');
  state.city = city;
  ui.setActiveChip(city);
  if (fromChip) input.value = '';
  ui.renderLoading(city);

  const url = new URL(location.href);
  url.searchParams.set('city', city);
  history.replaceState(null, '', url);

  const result = await fetchWeather(city);
  if (result.stale) return; // a newer search has started; drop this one

  state.lastResult = result;
  ui.renderInspector(result, city);

  if (result.error) {
    ui.renderError(result.error, city);
  } else {
    ui.renderWeather(result.json, moodFromCurrent(result.json.current));
  }
}

/* ---------- search form & chips ---------- */
document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  search(input.value);
});
input.addEventListener('input', () => ui.setHint(''));
ui.decorateMetrics();
ui.renderChips(POPULAR_CITIES, (city) => search(city, { fromChip: true }));
document.getElementById('retry-btn').addEventListener('click', () => {
  if (state.city) search(state.city);
});

/* ---------- tabs (WAI-ARIA tabs pattern) ---------- */
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = false) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  }
  state.activeTab = tab.id === 'tab-raw' ? 'raw' : 'formatted';
  if (focus) tab.focus();
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(tabs[(next + tabs.length) % tabs.length], true);
  });
}

/* ---------- copy ---------- */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'visually-hidden';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
const copyLabel = document.getElementById('copy-label');
let copyTimer;
document.getElementById('copy-btn').addEventListener('click', async () => {
  const r = state.lastResult;
  if (!r?.text) return;
  const text = state.activeTab === 'formatted' && r.isJson ? JSON.stringify(r.json, null, 2) : r.text;
  const ok = await copyText(text);
  copyLabel.textContent = ok ? 'Copied' : 'Copy failed';
  ui.setStatus(ok ? `${state.activeTab === 'raw' ? 'Raw' : 'Formatted'} JSON copied to clipboard` : 'Copy failed');
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyLabel.textContent = 'Copy JSON'), 1800);
});

/* ---------- start ---------- */
const initial = new URLSearchParams(location.search).get('city');
search(normalize(initial) ? initial : DEFAULT_CITY);
