/** Syntax highlighting for the formatted JSON tab. Output is HTML-escaped. */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const TOKEN = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Highlight one line of pretty-printed JSON. */
export function highlightLine(line) {
  let out = '';
  let last = 0;
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(line))) {
    out += escapeHtml(line.slice(last, m.index));
    const [whole, str, colon, bool, nul, number] = m;
    if (str !== undefined) {
      out += colon
        ? `<span class="j-key">${escapeHtml(str)}</span>${escapeHtml(colon)}`
        : `<span class="j-str">${escapeHtml(str)}</span>`;
    } else if (bool) out += `<span class="j-bool">${bool}</span>`;
    else if (nul) out += `<span class="j-null">null</span>`;
    else if (number) out += `<span class="j-num">${number}</span>`;
    else out += escapeHtml(whole);
    last = m.index + whole.length;
  }
  return out + escapeHtml(line.slice(last));
}

/** Pretty-print a value and return line-wrapped, highlighted HTML. */
export function renderHighlightedJson(value) {
  const pretty = JSON.stringify(value, null, 2) ?? 'null';
  return pretty
    .split('\n')
    .map((line) => `<span class="line">${highlightLine(line) || ' '}</span>`)
    .join('');
}
