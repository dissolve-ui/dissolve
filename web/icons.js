// Tiny generative glyphs for the sidebar: a 5x5 grain grid bent by each variant's motion.
// Same visual language for every entry, so the list reads as one family.

const N = 5;

const FX = {
  dust: (c, r) => ({ x: c + (c / N) ** 2 * 2.2, y: r - (c / N) ** 2 * 1.2, o: 1 - c / 6 }),
  sand: (c, r) => ({ x: c, y: r + (c / N) * 1.6 * (r / N), o: 1 - (c / N) * 0.5 }),
  ember: (c, r) => ({ x: c, y: r - (c / N) ** 2 * 2, o: 1 - c / 7, warm: c > 2 }),
  pixel: (c, r) => ({ x: c, y: r, o: (c * 7 + r * 3) % 5 > 1 ? 1 : 0.2, sq: true }),
  vortex: (c, r) => {
    const dx = c - 2, dy = r - 2, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + d * 0.5;
    return { x: 2 + Math.cos(a) * d * 0.85, y: 2 + Math.sin(a) * d * 0.85, o: 1 - d / 4 };
  },
  shatter: (c, r) => ({ x: c + Math.sign(c - 2) * 0.6, y: r + Math.sign(r - 2) * 0.6, o: 1, sq: true, rot: true }),
  stream: (c, r) => ({ x: c * 0.6 + (c / N) * 2.2, y: r * (1 - c / 6) + (c / N) * 3, o: 1 - c / 8 }),
  gather: (c, r) => ({ x: 2 + (c - 2) * 1.35, y: 2 + (r - 2) * 1.35, o: 1 - Math.hypot(c - 2, r - 2) / 4 }),
  rain: (c, r) => ({ x: c, y: r - (c % 2) * 0.8, o: r > 2 ? 1 : 0.35 }),
  print: (c, r) => ({ x: c, y: r, o: r < 3 || (r === 3 && c < 3) ? 1 : 0.12 }),
  snap: (c, r) => {
    const dx = c - 2, dy = r - 2;
    return { x: 2 + dx * 1.3, y: 2 + dy * 1.3, o: dx || dy ? 1 - Math.hypot(dx, dy) / 4.5 : 0 };
  },
  fling: (c, r) => ({ x: c + (r / N) * 1.4 + (c / N) ** 2 * 1.5, y: r - (c / N) ** 2 * 1.5, o: 1 - c / 7 }),
  charge: (c, r) => {
    const d = Math.hypot(c - 2, r - 2);
    return { x: c, y: r, o: 1, warm: d < 1.6 };
  },
  pile: (c, r) => ({ x: c, y: r, o: r >= Math.abs(c - 2) + 2 ? 1 : 0.1 }),
  peel: (c, r) => (c + r > 5 ? { x: 9 - r, y: 9 - c, o: 0.35 } : { x: c, y: r, o: 1 }),
  melt: (c, r) => ({ x: c, y: r + (c % 2 ? r * 0.35 : r * 0.12), o: 1 - r / 9 }),
  morph: (c, r) => ({ x: c, y: r, o: c < 2 ? 1 : c === 2 ? 0.5 : Math.hypot(c - 3.5, r - 2) < 1.8 ? 1 : 0.1 }),
};

export function icon(id, size = 16) {
  const fx = FX[id];
  if (!fx) return '';
  let out = '';
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const p = fx(c, r);
      if (p.o <= 0.05) continue;
      const x = 2 + p.x * 3, y = 2 + p.y * 3;
      const fill = p.warm ? 'var(--accent)' : 'currentColor';
      out += p.sq
        ? `<rect x="${(x - 1.1).toFixed(2)}" y="${(y - 1.1).toFixed(2)}" width="2.2" height="2.2" rx=".4" fill="${fill}" opacity="${Math.max(0.15, p.o).toFixed(2)}"${p.rot ? ` transform="rotate(${(c - r) * 9} ${x.toFixed(2)} ${y.toFixed(2)})"` : ''}/>`
        : `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.05" fill="${fill}" opacity="${Math.max(0.15, p.o).toFixed(2)}"/>`;
    }
  return `<svg width="${size}" height="${size}" viewBox="0 0 18 18" aria-hidden="true">${out}</svg>`;
}

export const GLYPH = {
  introduction: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.01" stroke-linecap="round"/></svg>',
  installation: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10"/></svg>',
  'agent-prompt': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5 6 8l-3 3.5M8 12h5"/></svg>',
  gallery: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="9" width="4.5" height="4.5" rx="1.2"/></svg>',
};
