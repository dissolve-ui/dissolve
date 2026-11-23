/**
 * NumberTicker for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (number-ticker.tsx) wraps it; it also runs on its own:
 *
 *   const t = createNumberTicker(el, { value: 1240.5, decimals: 2, locale: 'fr-FR', suffix: ' €' });
 *   t.update({ value: 1312.9 });
 *
 * Animated number for prices, balances and counters. Every digit is a clipped column that rolls to
 * its new value on a calm iOS curve, right to left with a slight stagger. Columns roll like an
 * odometer, in the direction the number moves: 9 to 10 turns the units one step forward instead of
 * spinning back, and a new value arriving mid roll carries on from where the column is. Added
 * digits open in, removed ones fold out, so the layout never jumps.
 */
import { CALM, el, injectStyle, propsOf, scope, value, type Value } from './kit';

export type NumberTickerProps = {
  value: number;
  /** Digits after the decimal separator. Default 0. */
  decimals?: number;
  /** Locale used to pick the separators, e.g. 'fr-FR' gives "1 240,50", 'en-US' "1,240.50". */
  locale?: string;
  /** Overrides the locale thousands separator. Pass '' to turn grouping off. */
  separator?: string;
  /** Overrides the locale decimal separator. */
  decimalSeparator?: string;
  /** Static text before the number, e.g. '$'. */
  prefix?: string;
  /** Static text after the number, e.g. ' €' (no break space). */
  suffix?: string;
  /** Font size in px (drives the row height). Default 34. */
  fontSize?: number;
  /** Roll duration in ms. Default 700. */
  duration?: number;
  /** Delay between two columns, right to left, in ms. Default 28. */
  stagger?: number;
  /** Tabular figures, so digits never change width. Default true. */
  tabular?: boolean;
  /** Number classes (color, weight, family...). Default weight 600 in the foreground token. */
  textClassName?: string;
  /** Prefix and suffix classes, added on top of the number classes. */
  affixClassName?: string;
};

export type NumberTickerInstance = {
  update: (props: Partial<NumberTickerProps>) => void;
  destroy: () => void;
};

type Kind = 'digit' | 'sym';
type Cell = { key: string; char: string; kind: Kind; order: number };
type Column = { node: HTMLSpanElement; c: Cell; cw: number; pos: Value; w: Value; o: Value; leaving: boolean };

const DEFAULTS = { value: 0, decimals: 0, fontSize: 34, duration: 700, stagger: 28, tabular: true };

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** Two turns of the wheel plus a closing 0, so a column can roll either way from any digit. */
const WHEEL = Array.from({ length: 21 }, (_, i) => DIGITS[i % 10]);
const MINUS = '−';
/** Extra room given to each glyph inside its clipped column, so fractional advances never clip. */
const SLACK = 6;

const CSS = `
:where([data-dissolve="number-ticker"]) { display: flex; align-items: center; width: fit-content; white-space: nowrap; }
:where(.dissolve-ticker-text) { font-weight: 600; letter-spacing: -0.01em; color: var(--dissolve-foreground, rgb(28 28 30)); }
:where([data-tabular] .dissolve-ticker-text) { font-variant-numeric: tabular-nums; }
:where(.dissolve-ticker-col) { display: block; overflow: hidden; flex: none; }
:where(.dissolve-ticker-roll) { display: block; will-change: transform; }
:where(.dissolve-ticker-cell) { display: block; text-align: center; }
:where(.dissolve-ticker-probe) { position: absolute; visibility: hidden; }
:where(.dissolve-ticker-affix) { flex: none; }
:where(.dissolve-ticker-affix:empty) { display: none; }
`;

/** Thousands and decimal separators for a locale, read from Intl with a safe fallback. */
function separatorsFor(locale?: string) {
  try {
    const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true }).format(12345.6);
    const marks = s.replace(/[0-9]/g, '');
    if (marks.length >= 2) return { group: marks[0], decimal: marks[marks.length - 1] };
    if (marks.length === 1) return { group: '', decimal: marks[0] };
  } catch { /* unknown locale */ }
  return { group: ',', decimal: '.' };
}

/**
 * Cells keyed by their place, not their index: the units column stays the units column when the
 * number grows, so only the new leading digits enter and the rest roll in place.
 */
function toCells(v: number, decimals: number, group: string, decimal: string): Cell[] {
  const safe = Number.isFinite(v) ? v : 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [int, frac = ''] = fixed.split('.');
  const cells: Cell[] = [];
  if (safe < 0 && Number(fixed) !== 0) cells.push({ key: 'sign', char: MINUS, kind: 'sym', order: -1e6 });
  for (let i = 0; i < int.length; i++) {
    const place = int.length - 1 - i;
    if (group && place < int.length - 1 && (place + 1) % 3 === 0) cells.push({ key: `g${place + 1}`, char: group, kind: 'sym', order: -(place + 1) * 2 + 1 });
    cells.push({ key: `i${place}`, char: int[i], kind: 'digit', order: -place * 2 });
  }
  if (decimals > 0) {
    cells.push({ key: 'dec', char: decimal, kind: 'sym', order: 1 });
    for (let i = 0; i < frac.length; i++) cells.push({ key: `f${i}`, char: frac[i], kind: 'digit', order: 2 + i });
  }
  return cells.sort((a, b) => a.order - b.order);
}

/** A rolling number in host. */
export function createNumberTicker(host: HTMLElement, initial: NumberTickerProps): NumberTickerInstance {
  injectStyle('dissolve-number-ticker', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();

  host.dataset.dissolve = 'number-ticker';
  host.setAttribute('role', 'img');
  const prefix = el('span');
  const suffix = el('span');
  host.append(prefix, suffix);

  const cols = new Map<string, Column>();
  let lh = 0, digitW = 0, width: Record<string, number> = {};
  let group = '', decimal = '.', last = p().value, dir = 1;
  const textClass = () => 'dissolve-ticker-text' + (p().textClassName ? ' ' + p().textClassName : '');

  /** Row height, separators and glyph widths, measured with the real text style. */
  function measure() {
    const { fontSize, tabular, locale, separator, decimalSeparator, affixClassName } = p();
    const seps = separatorsFor(locale);
    group = separator ?? seps.group;
    decimal = decimalSeparator ?? seps.decimal;
    lh = Math.round(fontSize * 1.22);
    Object.assign(host.style, { fontSize: fontSize + 'px', lineHeight: lh + 'px', height: lh + 'px' });
    host.toggleAttribute('data-tabular', tabular);
    for (const a of [prefix, suffix]) a.className = `dissolve-ticker-affix ${textClass()}${affixClassName ? ' ' + affixClassName : ''}`;
    const probe = el('span', 'dissolve-ticker-probe ' + textClass());
    host.append(probe);
    width = {};
    for (const g of [...DIGITS, group, decimal, MINUS].filter(Boolean)) {
      probe.textContent = g;
      width[g] = probe.getBoundingClientRect().width;
    }
    probe.remove();
    digitW = Math.max(...DIGITS.map((d) => width[d]));
  }

  function makeCol(c: Cell, fresh: boolean): Column {
    const node = el('span', 'dissolve-ticker-col ' + textClass());
    node.style.height = lh + 'px';
    const roll = el('span', 'dissolve-ticker-roll');
    const cw = c.kind === 'digit' ? digitW : width[c.char] ?? 0;
    for (const d of c.kind === 'digit' ? WHEEL : [c.char]) {
      const g = el('span', 'dissolve-ticker-cell');
      g.textContent = d;
      g.style.cssText = `width:${cw + SLACK}px;margin-left:${-SLACK / 2}px;height:${lh}px`;
      roll.append(g);
    }
    node.append(roll);
    const draw = () => {
      roll.style.transform = `translate3d(0,${(-col.pos.v * lh).toFixed(2)}px,0)`;
      node.style.width = col.w.v.toFixed(2) + 'px';
      node.style.opacity = col.o.v.toFixed(3);
    };
    // New columns open from nothing and roll up from zero. pos is the wheel position in digits.
    const digit = c.kind === 'digit' ? +c.char : 0;
    const col: Column = { node, c, cw, leaving: false, pos: value(sc, fresh ? 0 : digit, draw), w: value(sc, fresh ? 0 : cw, draw), o: value(sc, fresh ? 0 : 1, draw) };
    draw();
    return col;
  }

  function render(first = false) {
    const { value: v, decimals, duration, stagger } = p();
    const cells = toCells(v, decimals, group, decimal);
    const keys = new Set(cells.map((c) => c.key));
    // Leaving columns stay in the order until they have folded out.
    const items = cells.map((c) => ({ ...c, present: true }));
    for (const [key, col] of cols) if (!keys.has(key)) items.push({ ...col.c, present: false });
    items.sort((a, b) => a.order - b.order);
    const delays: Record<string, number> = {};
    let rank = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      delays[items[i].key] = Math.min(rank, 8) * stagger;
      if (items[i].kind === 'digit') rank++;
    }
    for (const it of items) {
      let col = cols.get(it.key);
      if (!col) { col = makeCol(it, !first); cols.set(it.key, col); }
      if (it.present) col.c = it;
      host.insertBefore(col.node, suffix);
      const delay = delays[it.key];
      const shown = it.present && it.kind === 'digit' ? +it.char : 0;
      // Re-base the wheel on the turn that leaves room in the direction of travel (same digit on
      // screen), then roll the short way that way. Picks up mid roll.
      if (it.kind === 'digit') {
        let c = col.pos.v % 10;
        if (dir < 0) c += 10;
        col.pos.set(c);
        const to = dir >= 0 ? (shown >= c - 0.5 ? shown : shown + 10) : shown + 10 <= c + 0.5 ? shown + 10 : shown;
        col.pos.to(to, duration, CALM, delay);
      } else {
        // Separators and signs have one cell, no wheel: they never roll, or a decrease would scroll them out.
        col.pos.set(0);
      }
      col.w.to(it.present ? col.cw : 0, duration, CALM, it.present ? 0 : delay);
      col.o.to(it.present ? 1 : 0, duration * 0.6, CALM, it.present ? delay : 0);
      if (!it.present && !col.leaving) {
        col.leaving = true;
        const gone = col;
        sc.wait(duration + 400).then(() => {
          if (cols.get(it.key) === gone && gone.leaving) { gone.node.remove(); cols.delete(it.key); }
        });
      } else if (it.present) col.leaving = false;
    }
    host.setAttribute('aria-label', `${p().prefix ?? ''}${cells.map((c) => c.char).join('')}${p().suffix ?? ''}`);
  }

  /** Columns rebuilt at rest, for a new text style or new separators. */
  function rebuild() {
    for (const col of cols.values()) col.node.remove();
    cols.clear();
    measure();
    render(true);
  }

  prefix.textContent = p().prefix ?? '';
  suffix.textContent = p().suffix ?? '';
  rebuild();

  return {
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      const v = p().value;
      if (changed.has('value') && Number.isFinite(v) && Number.isFinite(last)) dir = Math.abs(v) >= Math.abs(last) ? 1 : -1;
      last = v;
      prefix.textContent = p().prefix ?? '';
      suffix.textContent = p().suffix ?? '';
      const restyle = ['fontSize', 'tabular', 'textClassName', 'affixClassName', 'locale', 'separator', 'decimalSeparator'] as const;
      if (restyle.some((k) => changed.has(k))) rebuild();
      else if (changed.has('value') || changed.has('decimals') || changed.has('prefix') || changed.has('suffix')) render();
    },
    destroy() {
      sc.dispose();
      for (const col of cols.values()) col.node.remove();
      prefix.remove();
      suffix.remove();
      for (const a of ['data-dissolve', 'data-tabular', 'role', 'aria-label']) host.removeAttribute(a);
      for (const k of ['font-size', 'line-height', 'height']) host.style.removeProperty(k);
    },
  };
}
