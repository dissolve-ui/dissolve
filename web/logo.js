/**
 * The dissolve mark, "Duo": a big disc and a small one drifting off it.
 * Flat, one colour: it follows the text colour, so it works in both themes.
 */

const DISCS = [[34, 58, 30], [76, 30, 18]];
const discs = (fill) => DISCS.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`).join('');

/** The mark as an inline SVG string. */
export function markHTML(size = 30, cls = 'mark') {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="1 2 96 96" aria-hidden="true">${discs('currentColor')}</svg>`;
}

/** Favicon: the mark in white on a dark rounded square, readable on any tab bar. */
export function mountLogo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#0A0A0A"/><svg x="14" y="14" width="100" height="100" viewBox="1 2 96 96">${discs('#fff')}</svg></svg>`;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.type = 'image/svg+xml';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}
