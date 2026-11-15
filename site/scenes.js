// Canvas-drawn demo scenes. Each item knows how to draw itself, so the
// snapshot handed to the particle engine matches pixel for pixel.

const INK = '#242529', TEXT = '#525252', MUTED = '#A3A3A3';
const FONT = 'Inter, system-ui, sans-serif';

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function notif(app, title, body, color, time) {
  return {
    h: 74,
    draw(ctx, w, h) {
      ctx.fillStyle = '#fff';
      rr(ctx, 0, 0, w, h, 18); ctx.fill();
      ctx.fillStyle = color;
      rr(ctx, 14, 17, 40, 40, 11); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `700 17px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(app[0], 34, 38);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `600 10.5px ${FONT}`; ctx.fillStyle = MUTED;
      ctx.fillText(app.toUpperCase(), 68, 26);
      ctx.textAlign = 'right'; ctx.font = `400 11.5px ${FONT}`;
      ctx.fillText(time, w - 14, 26);
      ctx.textAlign = 'left';
      ctx.font = `600 14px ${FONT}`; ctx.fillStyle = INK;
      ctx.fillText(title, 68, 44);
      ctx.font = `400 13.5px ${FONT}`; ctx.fillStyle = TEXT;
      ctx.fillText(body, 68, 61);
    },
  };
}

function bubble(me, text) {
  return {
    h: 40,
    align: me ? 'right' : 'left',
    measure(ctx) {
      ctx.font = `400 14.5px ${FONT}`;
      return Math.ceil(ctx.measureText(text).width) + 28;
    },
    draw(ctx, w, h) {
      ctx.fillStyle = me ? '#0A84FF' : '#E9E9EB';
      rr(ctx, 0, 0, w, h, 20); ctx.fill();
      ctx.font = `400 14.5px ${FONT}`;
      ctx.fillStyle = me ? '#fff' : '#111';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 14, h / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    },
  };
}

const SKIES = [
  ['#FFB27A', '#FF6F61', '#3B2C5E', '#FFE29A'],
  ['#8EC5FC', '#4D9DE0', '#2E5E4E', '#FFFFFF'],
  ['#F9D976', '#F39F86', '#6B4226', '#FFF5D6'],
  ['#A1C4FD', '#C2E9FB', '#3D7B5F', '#FFFDE4'],
  ['#2C3E50', '#4CA1AF', '#0F2027', '#F0F0F0'],
  ['#FBC2EB', '#A18CD1', '#4A3F6B', '#FFF1F7'],
  ['#F6D365', '#FDA085', '#7A3B2E', '#FFF7E0'],
  ['#84FAB0', '#8FD3F4', '#1F5F5B', '#FFFFFF'],
  ['#FF9A9E', '#FAD0C4', '#5B3A50', '#FFF3F3'],
];

function photo(i) {
  const [a, b, hill, sun] = SKIES[i % SKIES.length];
  return {
    grid: true,
    draw(ctx, w, h) {
      ctx.save();
      rr(ctx, 0, 0, w, h, 8); ctx.clip();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = sun; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(w * (0.3 + (i % 3) * 0.2), h * 0.38, w * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = hill;
      ctx.beginPath(); ctx.moveTo(0, h);
      ctx.bezierCurveTo(w * 0.2, h * 0.55, w * 0.55, h * 0.95, w, h * 0.6);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(0, h * 0.8);
      ctx.bezierCurveTo(w * 0.4, h * 0.6, w * 0.7, h * 0.7, w, h * 0.85);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  };
}

function task(title, tag) {
  const item = {
    h: 52,
    done: false,
    draw(ctx, w, h) {
      ctx.fillStyle = '#fff';
      rr(ctx, 0, 0, w, h, 14); ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(28, h / 2, 11, 0, Math.PI * 2);
      if (item.done) {
        ctx.fillStyle = '#1C1C1C'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(23, h / 2); ctx.lineTo(27, h / 2 + 4); ctx.lineTo(33, h / 2 - 4); ctx.stroke();
      } else {
        ctx.strokeStyle = '#C9C9C9'; ctx.stroke();
      }
      ctx.font = `400 14.5px ${FONT}`;
      ctx.fillStyle = item.done ? MUTED : INK;
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 50, h / 2 + 1);
      if (item.done) {
        const tw = ctx.measureText(title).width;
        ctx.fillRect(50, h / 2 + 1, tw, 1);
      }
      ctx.font = `400 11px 'Geist Mono', monospace`;
      ctx.fillStyle = MUTED; ctx.textAlign = 'right';
      ctx.fillText(tag, w - 16, h / 2 + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    },
  };
  return item;
}

export const SCENES = [
  {
    name: 'Notifications',
    caption: 'Click a notification',
    preset: 'dust',
    make: () => [
      notif('Messages', 'Lina', 'On se retrouve à 19h devant le ciné ?', '#34C759', 'now'),
      notif('Calendar', 'Design review', 'Today at 14:30 · Studio 2', '#FF3B30', '5m'),
      notif('Bank', 'Card payment', '42,90 € at Boulangerie Ernest', '#8B5E3C', '12m'),
      notif('Weather', 'Rain soon', 'Light rain starting in 20 minutes', '#0A84FF', '30m'),
    ],
  },
  {
    name: 'Chat',
    caption: 'Click a message to unsend it',
    preset: 'ember',
    duration: 1300,
    make: () => [
      bubble(false, 'Tu as vu le nouveau proto ?'),
      bubble(true, 'Oui, la poussière est folle'),
      bubble(false, 'Montre-moi sur ton téléphone'),
      bubble(true, 'Oups, mauvais message'),
      bubble(true, 'Je supprime vite'),
      bubble(false, 'Trop tard, j’ai vu'),
    ],
  },
  {
    name: 'Photos',
    caption: 'Click a photo to delete it',
    preset: 'pixel',
    duration: 1100,
    make: () => Array.from({ length: 8 }, (_, i) => photo(i)),
  },
  {
    name: 'Tasks',
    caption: 'Check a task to complete it',
    preset: 'sand',
    duration: 1600,
    make: () => [
      task('Record the demo video', 'launch'),
      task('Write the README', 'docs'),
      task('Pick a final name', 'brand'),
      task('Publish to npm', 'launch'),
      task('Post on X', 'launch'),
    ],
  },
];

/** Computes target rects for the items of a scene inside a W x H stage. */
export function layout(items, W, H, ctx) {
  const pad = 24;
  if (items[0]?.grid || items.some((i) => i.grid)) {
    const cols = 4, gap = 8;
    const size = Math.min(110, (W - pad * 2 - gap * (cols - 1)) / cols);
    const total = size * cols + gap * (cols - 1);
    const x0 = (W - total) / 2;
    const rows = Math.ceil(8 / cols);
    const y0 = (H - (size * rows + gap * (rows - 1))) / 2;
    return items.map((_, i) => ({ x: x0 + (i % cols) * (size + gap), y: y0 + Math.floor(i / cols) * (size + gap), w: size, h: size }));
  }
  const width = Math.min(380, W - pad * 2);
  const x0 = (W - width) / 2;
  const gap = items[0]?.align ? 6 : 8;
  let y = pad;
  return items.map((it) => {
    let w = width, x = x0;
    if (it.align) {
      w = Math.min(it.measure(ctx), width * 0.8);
      x = it.align === 'right' ? x0 + width - w : x0;
    }
    const r = { x, y, w, h: it.h };
    y += it.h + gap;
    return r;
  });
}
