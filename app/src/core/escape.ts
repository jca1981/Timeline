// **** Issue #8: fælles HTML/SVG-escaping — importerede data (label, color, url, note)
// må aldrig kunne injicere markup i eksporterede, selvstændige filer. ****

/** Escape til brødtekse (indhold mellem tags). */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape til attributværdier (uddeler også anførselstegn). */
export function attr(s: string): string {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Farver kan komme fra import; tillad kun hex (#abc..#aabbccdd) eller gængs CSS-navn. */
export function safeColor(c: string | undefined): string {
  return c && (/^#[0-9a-fA-F]{3,8}$/.test(c) || /^[a-zA-Z]+$/.test(c)) ? c : '#888';
}
