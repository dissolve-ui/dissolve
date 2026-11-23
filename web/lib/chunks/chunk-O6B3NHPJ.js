// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  CALM,
  el,
  injectStyle,
  propsOf,
  scope,
  value
} from "./chunk-BCIF2ROM.js";

// registry/web/number-ticker.core.ts
var DEFAULTS = { value: 0, decimals: 0, fontSize: 34, duration: 700, stagger: 28, tabular: true };
var DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
var WHEEL = Array.from({ length: 21 }, (_, i) => DIGITS[i % 10]);
var MINUS = "\u2212";
var SLACK = 6;
var CSS = `
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
function separatorsFor(locale) {
  try {
    const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true }).format(12345.6);
    const marks = s.replace(/[0-9]/g, "");
    if (marks.length >= 2) return { group: marks[0], decimal: marks[marks.length - 1] };
    if (marks.length === 1) return { group: "", decimal: marks[0] };
  } catch {
  }
  return { group: ",", decimal: "." };
}
function toCells(v, decimals, group, decimal) {
  const safe = Number.isFinite(v) ? v : 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [int, frac = ""] = fixed.split(".");
  const cells = [];
  if (safe < 0 && Number(fixed) !== 0) cells.push({ key: "sign", char: MINUS, kind: "sym", order: -1e6 });
  for (let i = 0; i < int.length; i++) {
    const place = int.length - 1 - i;
    if (group && place < int.length - 1 && (place + 1) % 3 === 0) cells.push({ key: `g${place + 1}`, char: group, kind: "sym", order: -(place + 1) * 2 + 1 });
    cells.push({ key: `i${place}`, char: int[i], kind: "digit", order: -place * 2 });
  }
  if (decimals > 0) {
    cells.push({ key: "dec", char: decimal, kind: "sym", order: 1 });
    for (let i = 0; i < frac.length; i++) cells.push({ key: `f${i}`, char: frac[i], kind: "digit", order: 2 + i });
  }
  return cells.sort((a, b) => a.order - b.order);
}
function createNumberTicker(host, initial) {
  injectStyle("dissolve-number-ticker", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "number-ticker";
  host.setAttribute("role", "img");
  const prefix = el("span");
  const suffix = el("span");
  host.append(prefix, suffix);
  const cols = /* @__PURE__ */ new Map();
  let lh = 0, digitW = 0, width = {};
  let group = "", decimal = ".", last = p().value, dir = 1;
  const textClass = () => "dissolve-ticker-text" + (p().textClassName ? " " + p().textClassName : "");
  function measure() {
    const { fontSize, tabular, locale, separator, decimalSeparator, affixClassName } = p();
    const seps = separatorsFor(locale);
    group = separator ?? seps.group;
    decimal = decimalSeparator ?? seps.decimal;
    lh = Math.round(fontSize * 1.22);
    Object.assign(host.style, { fontSize: fontSize + "px", lineHeight: lh + "px", height: lh + "px" });
    host.toggleAttribute("data-tabular", tabular);
    for (const a of [prefix, suffix]) a.className = `dissolve-ticker-affix ${textClass()}${affixClassName ? " " + affixClassName : ""}`;
    const probe = el("span", "dissolve-ticker-probe " + textClass());
    host.append(probe);
    width = {};
    for (const g of [...DIGITS, group, decimal, MINUS].filter(Boolean)) {
      probe.textContent = g;
      width[g] = probe.getBoundingClientRect().width;
    }
    probe.remove();
    digitW = Math.max(...DIGITS.map((d) => width[d]));
  }
  function makeCol(c, fresh) {
    const node = el("span", "dissolve-ticker-col " + textClass());
    node.style.height = lh + "px";
    const roll = el("span", "dissolve-ticker-roll");
    const cw = c.kind === "digit" ? digitW : width[c.char] ?? 0;
    for (const d of c.kind === "digit" ? WHEEL : [c.char]) {
      const g = el("span", "dissolve-ticker-cell");
      g.textContent = d;
      g.style.cssText = `width:${cw + SLACK}px;margin-left:${-SLACK / 2}px;height:${lh}px`;
      roll.append(g);
    }
    node.append(roll);
    const draw = () => {
      roll.style.transform = `translate3d(0,${(-col.pos.v * lh).toFixed(2)}px,0)`;
      node.style.width = col.w.v.toFixed(2) + "px";
      node.style.opacity = col.o.v.toFixed(3);
    };
    const digit = c.kind === "digit" ? +c.char : 0;
    const col = { node, c, cw, leaving: false, pos: value(sc, fresh ? 0 : digit, draw), w: value(sc, fresh ? 0 : cw, draw), o: value(sc, fresh ? 0 : 1, draw) };
    draw();
    return col;
  }
  function render(first = false) {
    const { value: v, decimals, duration, stagger } = p();
    const cells = toCells(v, decimals, group, decimal);
    const keys = new Set(cells.map((c) => c.key));
    const items = cells.map((c) => ({ ...c, present: true }));
    for (const [key, col] of cols) if (!keys.has(key)) items.push({ ...col.c, present: false });
    items.sort((a, b) => a.order - b.order);
    const delays = {};
    let rank = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      delays[items[i].key] = Math.min(rank, 8) * stagger;
      if (items[i].kind === "digit") rank++;
    }
    for (const it of items) {
      let col = cols.get(it.key);
      if (!col) {
        col = makeCol(it, !first);
        cols.set(it.key, col);
      }
      if (it.present) col.c = it;
      host.insertBefore(col.node, suffix);
      const delay = delays[it.key];
      const shown = it.present && it.kind === "digit" ? +it.char : 0;
      if (it.kind === "digit") {
        let c = col.pos.v % 10;
        if (dir < 0) c += 10;
        col.pos.set(c);
        const to = dir >= 0 ? shown >= c - 0.5 ? shown : shown + 10 : shown + 10 <= c + 0.5 ? shown + 10 : shown;
        col.pos.to(to, duration, CALM, delay);
      } else {
        col.pos.set(0);
      }
      col.w.to(it.present ? col.cw : 0, duration, CALM, it.present ? 0 : delay);
      col.o.to(it.present ? 1 : 0, duration * 0.6, CALM, it.present ? delay : 0);
      if (!it.present && !col.leaving) {
        col.leaving = true;
        const gone = col;
        sc.wait(duration + 400).then(() => {
          if (cols.get(it.key) === gone && gone.leaving) {
            gone.node.remove();
            cols.delete(it.key);
          }
        });
      } else if (it.present) col.leaving = false;
    }
    host.setAttribute("aria-label", `${p().prefix ?? ""}${cells.map((c) => c.char).join("")}${p().suffix ?? ""}`);
  }
  function rebuild() {
    for (const col of cols.values()) col.node.remove();
    cols.clear();
    measure();
    render(true);
  }
  prefix.textContent = p().prefix ?? "";
  suffix.textContent = p().suffix ?? "";
  rebuild();
  return {
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      const v = p().value;
      if (changed.has("value") && Number.isFinite(v) && Number.isFinite(last)) dir = Math.abs(v) >= Math.abs(last) ? 1 : -1;
      last = v;
      prefix.textContent = p().prefix ?? "";
      suffix.textContent = p().suffix ?? "";
      const restyle = ["fontSize", "tabular", "textClassName", "affixClassName", "locale", "separator", "decimalSeparator"];
      if (restyle.some((k) => changed.has(k))) rebuild();
      else if (changed.has("value") || changed.has("decimals") || changed.has("prefix") || changed.has("suffix")) render();
    },
    destroy() {
      sc.dispose();
      for (const col of cols.values()) col.node.remove();
      prefix.remove();
      suffix.remove();
      for (const a of ["data-dissolve", "data-tabular", "role", "aria-label"]) host.removeAttribute(a);
      for (const k of ["font-size", "line-height", "height"]) host.style.removeProperty(k);
    }
  };
}

export {
  createNumberTicker
};
