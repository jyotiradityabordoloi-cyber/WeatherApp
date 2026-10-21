/** Display helpers: dates, numbers and plain-language labels for metrics. */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse WeatherAPI's "YYYY-MM-DD H:mm" local time without shifting it into
 * the viewer's time zone.
 */
export function parseLocalTime(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/.exec(String(str || '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return { year: y, month: mo, day: d, hour: h, minute: mi, weekday };
}

export function formatClock(t) {
  if (!t) return '';
  const h12 = t.hour % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(t.minute).padStart(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDate(t) {
  if (!t) return '';
  return `${DAYS[t.weekday]}, ${t.day} ${MONTHS[t.month - 1]} ${t.year}`;
}

export const round = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null);

/** "34" or an em dash when the value is missing. */
export const num = (n, digits = 0) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits).replace(/\.0+$/, '') : '—';

export function feelsLabel(feels, actual) {
  if (typeof feels !== 'number' || typeof actual !== 'number') return '';
  const diff = feels - actual;
  if (diff >= 2) return 'Warmer than actual';
  if (diff <= -2) return 'Cooler than actual';
  return 'Close to actual';
}

export function humidityLabel(h) {
  if (typeof h !== 'number') return '';
  if (h < 30) return 'Dry';
  if (h <= 60) return 'Comfortable';
  if (h < 80) return 'Humid';
  return 'Very humid';
}

export function windLabel(k) {
  if (typeof k !== 'number') return '';
  if (k < 2) return 'Calm';
  if (k < 20) return 'Light breeze';
  if (k < 30) return 'Breezy';
  if (k < 50) return 'Windy';
  return 'Strong wind';
}

export function visibilityLabel(km) {
  if (typeof km !== 'number') return '';
  if (km < 2) return 'Poor';
  if (km < 5) return 'Moderate';
  if (km <= 10) return 'Good';
  return 'Excellent';
}

export function uvLabel(uv) {
  if (typeof uv !== 'number') return '';
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very high';
  return 'Extreme';
}

export function cloudLabel(c) {
  if (typeof c !== 'number') return '';
  if (c <= 5) return 'Clear';
  if (c <= 25) return 'Mostly clear';
  if (c <= 60) return 'Partly cloudy';
  if (c <= 85) return 'Mostly cloudy';
  return 'Overcast';
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/** WeatherAPI icons are protocol-relative ("//cdn..."); force HTTPS. */
export function iconUrl(icon) {
  if (typeof icon !== 'string' || !icon) return '';
  const url = icon.startsWith('//') ? `https:${icon}` : icon;
  return /^https:\/\/cdn\.weatherapi\.com\//.test(url) ? url : '';
}
