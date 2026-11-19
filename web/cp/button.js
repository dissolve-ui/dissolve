// GlossyButton demo. The button is the React web component's core (registry/glossy-button.core.ts,
// built into web/lib), the same code a React app installs. On its page a playground tunes every
// layer and copies the JSX or the CSS.
import { createGlossyButton, GLOSSY_SIZES } from '../lib/glossy-button.js';
import { el, clamp, prop, add } from './kit.js';

/** The native defaults, the playground starts from them and the copied code omits them. */
const DEFAULTS = {
  color: '#296FF0', labelColor: '#FFFFFF', radius: 999, size: 'md',
  strokeOpacity: 0.4, innerOpacity: 0.24, innerBlur: 6, innerSpread: 2,
  shadowOpacity: 0.2, shadowY: 3, shadowBlur: 6, ringSpread: 1,
};
const LABEL = 'Get started';

const PLUS = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>`;
const CHECK = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
const COPY = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M10.5 3.2A1.8 1.8 0 0 0 9 2.5H4.3a1.8 1.8 0 0 0-1.8 1.8V9a1.8 1.8 0 0 0 .7 1.5"/></svg>';

/* ======================================================================================
   The button, from the playground settings. icon is a Plus or nothing here.
   ====================================================================================== */

function glossy(sc, opts) {
  const node = el('button');
  const props = (o) => ({ ...o, icon: undefined, label: o.label || LABEL });
  const b = createGlossyButton(node, props(opts));
  sc.onDispose(() => b.destroy());
  const pointer = (type) => node.dispatchEvent(new PointerEvent(type, { pointerId: 1e6, isPrimary: true, bubbles: true, button: 0 }));

  function apply(o) {
    b.update(props(o));
    b.icon.innerHTML = o.icon ? PLUS((GLOSSY_SIZES[o.size] ?? GLOSSY_SIZES.md).icon) : '';
  }
  apply(opts);

  return {
    node,
    apply,
    async tap() {
      pointer('pointerdown');
      await sc.wait(150);
      pointer('pointerup');
      await sc.wait(350);
    },
  };
}

/* ======================================================================================
   Code generation: the JSX (only what differs from the defaults) and plain CSS.
   ====================================================================================== */

const num = (v) => String(+(+v).toFixed(2));

function jsx(o) {
  const attrs = [];
  for (const key of Object.keys(DEFAULTS)) {
    const v = o[key], d = DEFAULTS[key];
    if (typeof d === 'string') {
      if (String(v).toUpperCase() !== d.toUpperCase()) attrs.push(`${key}="${key === 'size' ? v : String(v).toUpperCase()}"`);
    } else if (+num(v) !== d) attrs.push(`${key}={${num(v)}}`);
  }
  if (o.icon) attrs.unshift('icon={<PlusIcon />}');
  if (o.fullWidth) attrs.unshift('fullWidth');
  attrs.push('onPress={handlePress}');
  const label = (o.label || LABEL).replace(/[{}<>]/g, '');
  const one = `<GlossyButton ${attrs.join(' ')}>${label}</GlossyButton>`;
  if (one.length <= 96) return one;
  return `<GlossyButton\n${attrs.map((a) => '  ' + a).join('\n')}\n>\n  ${label}\n</GlossyButton>`;
}

function rgba(hexColor, a) {
  const h = hexColor.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${num(a)})`;
}

function css(o) {
  const s = GLOSSY_SIZES[o.size] || GLOSSY_SIZES.md;
  const r = o.radius >= s.height / 2 ? '999px' : o.radius + 'px';
  return `.glossy-button {
  position: relative;
  display: ${o.fullWidth ? 'flex' : 'inline-flex'};${o.fullWidth ? '\n  width: 100%;' : ''}
  align-items: center;
  justify-content: center;
  gap: ${s.gap}px;
  height: ${s.height}px;
  padding: 0 ${s.padding}px;
  border: 0;
  border-radius: ${r};
  background: ${o.color.toUpperCase()};
  color: ${o.labelColor.toUpperCase()};
  font-weight: 600;
  font-size: ${s.font}px;
  box-shadow:
    0 ${o.shadowY}px ${o.shadowBlur}px rgba(0, 0, 0, ${num(o.shadowOpacity)}),
    0 0 0 ${o.ringSpread}px ${o.color.toUpperCase()},
    inset 0 0 ${o.innerBlur}px ${o.innerSpread}px rgba(255, 255, 255, ${num(o.innerOpacity)});
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* 1px inside stroke, a white gradient lit from the top */
.glossy-button::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(to bottom, ${rgba('#FFFFFF', o.strokeOpacity)}, rgba(255, 255, 255, 0));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.glossy-button:active { transform: scale(0.97); }`;
}

/* ======================================================================================
   Playground (stage mode): the button big, a compact panel of cards beside it.
   ====================================================================================== */

function mountGlossy(body, { sc, mode }) {
  const opts = { ...DEFAULTS, label: LABEL, icon: false, size: mode === 'tile' ? 'md' : mode === 'stage' ? 'lg' : 'md' };
  if (mode !== 'stage') {
    const b = glossy(sc, opts);
    body.append(b.node);
    return { run: () => b.tap() };
  }

  const STAGE_DEFAULTS = { ...opts };
  const root = el('div', 'gbp');
  const view = el('div', 'gbp-view');
  const b = glossy(sc, opts);
  view.append(b.node);

  // Backdrop: site surface, white paper or night, to judge the shadows on both.
  const bgs = el('div', 'gbp-bg');
  [['', 'var(--wash)', 'Site'], ['gbp-paper', '#FFFFFF', 'White'], ['gbp-night', '#0E0E10', 'Black']].forEach(([cls, fill, name], i) => {
    const sw = el('button', i === 0 ? 'on' : '');
    sw.type = 'button';
    sw.title = name + ' background';
    sw.setAttribute('aria-label', name + ' background');
    sw.style.background = fill;
    sw.addEventListener('click', () => {
      view.classList.remove('gbp-paper', 'gbp-night');
      if (cls) view.classList.add(cls);
      bgs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === sw));
    });
    bgs.append(sw);
  });
  view.append(bgs);

  const side = el('div', 'gbp-side');
  const inputs = [];
  const refresh = [];
  const update = () => {
    b.apply(opts);
    refresh.forEach((f) => f());
  };

  const card = (title) => {
    const c = el('div', 'gbp-card');
    c.append(el('p', 'gbp-title', title));
    side.append(c);
    return c;
  };
  const row = (parent, name, wide = false) => {
    const r = el('div', 'gbp-row' + (wide ? ' gbp-wide' : ''));
    r.append(el('span', '', name));
    parent.append(r);
    return r;
  };

  function colorRow(parent, name, key) {
    const r = row(parent, name, true);
    const wrap = el('span', 'gbp-color');
    const sw = el('span', 'gbp-swatch');
    const picker = el('input');
    picker.type = 'color';
    picker.setAttribute('aria-label', name);
    sw.append(picker);
    const hexIn = el('input', 'gbp-hex');
    hexIn.spellcheck = false;
    hexIn.maxLength = 7;
    hexIn.setAttribute('aria-label', name + ' hex');
    hexIn.dataset.key = key;
    wrap.append(sw, hexIn);
    r.append(wrap);
    const show = () => {
      sw.style.background = opts[key];
      picker.value = opts[key].toLowerCase();
      if (document.activeElement !== hexIn) hexIn.value = opts[key].toUpperCase();
    };
    picker.addEventListener('input', () => { opts[key] = picker.value.toUpperCase(); update(); });
    hexIn.addEventListener('input', () => {
      let v = hexIn.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { opts[key] = v.toUpperCase(); update(); }
    });
    hexIn.addEventListener('blur', show);
    refresh.push(show);
    inputs.push(picker, hexIn);
  }

  function rangeRow(parent, name, key, min, max, step) {
    const r = row(parent, name);
    const range = el('input', 'gbp-range');
    Object.assign(range, { type: 'range', min, max, step });
    range.setAttribute('aria-label', name);
    range.dataset.key = key;
    const n = el('input', 'gbp-num');
    n.inputMode = 'decimal';
    n.spellcheck = false;
    n.setAttribute('aria-label', name + ' value');
    r.append(range, n);
    const show = () => {
      const v = Math.min(opts[key], max);
      range.value = v;
      range.style.setProperty('--fill', ((v - min) / (max - min)) * 100 + '%');
      if (document.activeElement !== n) n.value = num(opts[key]);
    };
    range.addEventListener('input', () => { opts[key] = +range.value; update(); });
    n.addEventListener('input', () => {
      const v = parseFloat(n.value.replace(',', '.'));
      if (Number.isNaN(v)) return;
      opts[key] = clamp(v, min, max);
      update();
    });
    n.addEventListener('blur', show);
    refresh.push(show);
    inputs.push(range, n);
    return { range, n };
  }

  // Button: label, colors, radius, size.
  const c1 = card('Button');
  const lr = row(c1, 'Label', true);
  const labelIn = el('input', 'gbp-text');
  labelIn.value = opts.label;
  labelIn.maxLength = 28;
  labelIn.setAttribute('aria-label', 'Label');
  labelIn.addEventListener('input', () => { opts.label = labelIn.value; update(); });
  refresh.push(() => { if (document.activeElement !== labelIn) labelIn.value = opts.label; });
  lr.append(labelIn);
  colorRow(c1, 'Label color', 'labelColor');
  colorRow(c1, 'Fill', 'color');

  const rr = row(c1, 'Radius');
  const radius = el('input', 'gbp-range');
  Object.assign(radius, { type: 'range', min: 0, max: 26, step: 1 });
  radius.setAttribute('aria-label', 'Radius');
  const pill = el('button', 'gbp-pill', 'Pill');
  pill.type = 'button';
  rr.append(radius, pill);
  let lastRadius = 14;
  const showRadius = () => {
    const isPill = opts.radius >= 999;
    pill.classList.toggle('on', isPill);
    pill.setAttribute('aria-pressed', String(isPill));
    radius.value = isPill ? 26 : opts.radius;
    radius.style.setProperty('--fill', ((isPill ? 26 : opts.radius) / 26) * 100 + '%');
  };
  radius.addEventListener('input', () => { opts.radius = +radius.value; lastRadius = opts.radius; update(); });
  pill.addEventListener('click', (e) => {
    e.preventDefault();
    opts.radius = opts.radius >= 999 ? lastRadius : 999;
    update();
  });
  refresh.push(showRadius);

  const sr = row(c1, 'Size', true);
  const seg = el('div', 'gbp-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Size');
  for (const k of ['sm', 'md', 'lg']) {
    const s = el('button', '', k);
    s.type = 'button';
    s.dataset.size = k;
    s.addEventListener('click', (e) => { e.preventDefault(); opts.size = k; update(); });
    seg.append(s);
  }
  sr.append(seg);
  refresh.push(() => seg.querySelectorAll('button').forEach((s) => s.classList.toggle('on', s.dataset.size === opts.size)));

  const wr = row(c1, 'Width', true);
  const wseg = el('div', 'gbp-seg');
  wseg.setAttribute('role', 'group');
  wseg.setAttribute('aria-label', 'Width');
  for (const [k, name] of [[false, 'Auto'], [true, 'Full']]) {
    const s = el('button', '', name);
    s.type = 'button';
    s.dataset.full = String(k);
    s.addEventListener('click', (e) => { e.preventDefault(); opts.fullWidth = k; update(); });
    wseg.append(s);
  }
  wr.append(wseg);
  refresh.push(() => wseg.querySelectorAll('button').forEach((s) => s.classList.toggle('on', s.dataset.full === String(!!opts.fullWidth))));

  const ir = row(c1, 'Icon', true);
  const iseg = el('div', 'gbp-seg');
  iseg.setAttribute('role', 'group');
  iseg.setAttribute('aria-label', 'Icon');
  for (const [k, name] of [[false, 'None'], [true, 'Plus']]) {
    const s = el('button', '', name);
    s.type = 'button';
    s.dataset.icon = String(k);
    s.addEventListener('click', (e) => { e.preventDefault(); opts.icon = k; update(); });
    iseg.append(s);
  }
  ir.append(iseg);
  refresh.push(() => iseg.querySelectorAll('button').forEach((s) => s.classList.toggle('on', s.dataset.icon === String(opts.icon))));

  // Layers of the recipe.
  const c2 = card('Stroke and ring');
  rangeRow(c2, 'Stroke', 'strokeOpacity', 0, 1, 0.01);
  rangeRow(c2, 'Ring', 'ringSpread', 0, 4, 0.5);
  const c3 = card('Drop shadow');
  rangeRow(c3, 'Opacity', 'shadowOpacity', 0, 1, 0.01);
  rangeRow(c3, 'Y', 'shadowY', 0, 20, 1);
  rangeRow(c3, 'Blur', 'shadowBlur', 0, 30, 1);
  const c4 = card('Inner shadow');
  rangeRow(c4, 'Opacity', 'innerOpacity', 0, 1, 0.01);
  rangeRow(c4, 'Blur', 'innerBlur', 0, 20, 1);
  rangeRow(c4, 'Spread', 'innerSpread', 0, 10, 0.5);

  // Output: copy buttons for the JSX or the CSS of the current settings, reset.
  const actions = el('div', 'gbp-actions');
  const copyBtn = (label, cls, get) => {
    const btn = el('button', 'gbp-btn ' + cls, `<span class="gbp-ic">${COPY}</span><span>${label}</span>`);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      const out = get();
      btn.dataset.copied = out;
      navigator.clipboard?.writeText(out).catch(() => {});
      btn.classList.add('done');
      btn.querySelector('.gbp-ic').innerHTML = CHECK;
      btn.lastChild.textContent = 'Copied';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        btn.classList.remove('done');
        btn.querySelector('.gbp-ic').innerHTML = COPY;
        btn.lastChild.textContent = label;
      }, 1200);
    });
    sc.onDispose(() => clearTimeout(btn._t));
    return btn;
  };
  const reset = el('button', 'gbp-btn', 'Reset');
  reset.type = 'button';
  reset.addEventListener('click', () => { Object.assign(opts, STAGE_DEFAULTS); update(); });
  const copyCode = copyBtn('Copy code', 'primary', () => add('glossy-button', 'GlossyButton', jsx(opts)));
  copyCode.dataset.gbCopy = 'code';
  const copyCss = copyBtn('CSS', '', () => css(opts));
  copyCss.dataset.gbCopy = 'css';
  actions.append(reset, copyCss, copyCode);
  side.append(actions);

  root.append(view, side);
  body.append(root);
  update();

  return { run: () => b.tap() };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'glossy-button': {
    title: 'GlossyButton',
    note: 'A tactile pill lit from the inside.',
    desc: 'A pill button with a slightly 3D look, built from one recipe: a 1 pt inside stroke as a white gradient lit from the top, a soft black drop shadow, a white inner shadow and a thin outer ring in the fill color. Pressed, it scales to 0.97 on a crisp spring while the inner light dims, with a light haptic. Every layer is a prop, tune them here and copy the JSX.',
    hint: 'Press the button, tune every layer, copy the code',
    tileHint: 'Press the button',
    mount: mountGlossy,
    code: add('glossy-button', 'GlossyButton', `<GlossyButton onPress={start}>Get started</GlossyButton>

<GlossyButton
  icon={({ color, size }) => <SymbolView name="plus" tintColor={color} size={size} />}
  onPress={create}
>
  New project
</GlossyButton>

<GlossyButton color="#E5484D" radius={14} size="lg" onPress={remove}>
  Delete
</GlossyButton>`),
    props: [
      prop('children / label', 'ReactNode / string', '', 'The label. A string is styled with labelColor, any other node renders as is.'),
      prop('icon', 'ReactNode | ({ color, size }) =&gt; ReactNode', '', 'Leading icon. The function form gets the label color and the icon size.'),
      prop('onPress', '() =&gt; void', '', 'Called on release.'),
      prop('color', 'string', `'#296FF0'`, 'Fill, also the color of the outer ring.'),
      prop('labelColor', 'string', `'#FFFFFF'`, 'Label and icon color.'),
      prop('radius', 'number', '999', 'Corner radius, capped at half the height (a pill).'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Height 36, 44 or 52, with matching padding and type.'),
      prop('fullWidth', 'boolean', 'false', 'Stretches to the full width of the parent.'),
      prop('strokeOpacity', 'number', '0.4', 'Top opacity of the 1 pt white gradient stroke, fading to 0 at the bottom.'),
      prop('innerOpacity / innerBlur / innerSpread', 'number', '0.24 / 6 / 2', 'White inner shadow. Dims while pressed.'),
      prop('shadowOpacity / shadowY / shadowBlur', 'number', '0.2 / 3 / 6', 'Black drop shadow.'),
      prop('ringSpread', 'number', '1', 'Outer ring in the fill color, no blur. 0 removes it.'),
      prop('disabled', 'boolean', 'false', 'Half opacity, no press, no haptic.'),
      prop('haptics', 'boolean', 'true', 'Light impact on press in.'),
      prop('className', 'string', '', 'Outer classes (margins, alignment, width...).'),
      prop('labelClassName', 'string', '', 'Label classes (weight, tracking...).'),
    ],
  },
};
