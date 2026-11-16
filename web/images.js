// Paintings shared by every canvas-drawn demo (same set as assets/paintings in the app).
export const NAMES = ['aqueduct', 'arch', 'cypress', 'lake', 'pines', 'pond', 'temple', 'tuscany', 'valley', 'villa'];
export const IMG = {};
export const ready = Promise.all(NAMES.map((n) => new Promise((res) => {
  const im = new Image();
  im.onload = im.onerror = () => res();
  im.src = `assets/paintings/${n}.jpg`;
  IMG[n] = im;
})));

export const FONT = 'Allo, system-ui, sans-serif';

/** Draws img to fill (x, y, w, h), cropped like object-fit: cover. */
export function cover(ctx, img, x, y, w, h) {
  if (!img?.naturalWidth) { ctx.fillStyle = '#5a5248'; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
