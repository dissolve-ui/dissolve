// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/accordion.core.ts
var DEFAULTS = { items: [], type: "single", collapsible: true, haptics: true };
var OPEN = 320;
var CLOSE = 260;
var CONTENT_DELAY = 60;
var CONTENT_IN = 240;
var CONTENT_OUT = 120;
var SLIDE = 6;
var FADE = 150;
var EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
var CHEVRON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.9 4.8 7 9.2l5.1-4.4"/></svg>';
var CSS = `
:where([data-dissolve="accordion"]) { display: block; }
:where(.dissolve-accordion-item + .dissolve-accordion-item) { border-top: 1px solid var(--dissolve-border, rgb(60 60 67 / 0.12)); }
:where(.dissolve-accordion-heading) { margin: 0; }
:where(.dissolve-accordion-trigger) { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 56px; padding: 14px 0; text-align: left; color: var(--dissolve-foreground, rgb(28 28 30)); -webkit-tap-highlight-color: transparent; transition: opacity 120ms; border-radius: 8px; }
:where(.dissolve-accordion-trigger:active:not(:disabled)) { opacity: 0.6; }
:where(.dissolve-accordion-trigger:disabled) { opacity: 0.4; cursor: default; }
:where(.dissolve-accordion-trigger:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 2px; }
:where(.dissolve-accordion-title) { flex: 1; font-size: 16px; line-height: 22px; font-weight: 500; }
:where(.dissolve-accordion-chevron) { display: flex; flex: none; color: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-accordion-region) { overflow: hidden; }
:where(.dissolve-accordion-content) { padding-bottom: 18px; font-size: 15px; line-height: 22px; color: var(--dissolve-muted, rgb(142 142 147)); }
`;
var uid = 0;
function createAccordion(host, initial = {}) {
  injectStyle("dissolve-accordion", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const id = `dissolve-accordion-${++uid}`;
  host.dataset.dissolve = "accordion";
  let inner = [...p().defaultValue ?? []];
  const openKeys = () => p().value ?? inner;
  const sections = /* @__PURE__ */ new Map();
  const slots = /* @__PURE__ */ new Map();
  const slotOf = (value) => {
    let c = slots.get(value);
    if (!c) {
      c = document.createElement("div");
      c.className = "dissolve-accordion-content";
      slots.set(value, c);
    }
    return c;
  };
  function show(s, open, instant) {
    if (s.open === open) return;
    s.open = open;
    clearTimeout(s.timer);
    const reduced = reducedMotion();
    const { region, content, chevron, trigger } = s;
    trigger.setAttribute("aria-expanded", String(open));
    s.root.dataset.state = open ? "open" : "closed";
    if (instant) {
      region.style.transition = content.style.transition = chevron.style.transition = "none";
      region.style.height = open ? "auto" : "0px";
      region.style.visibility = open ? "" : "hidden";
      content.style.opacity = open ? "1" : "0";
      content.style.transform = open ? "" : `translateY(${-SLIDE}px)`;
      chevron.style.transform = open ? "rotate(180deg)" : "";
      return;
    }
    const ms = reduced ? 0 : open ? OPEN : CLOSE;
    region.style.transition = "none";
    region.style.height = region.getBoundingClientRect().height + "px";
    region.style.visibility = "";
    void region.offsetHeight;
    region.style.transition = ms ? `height ${ms}ms ${EASE}` : "none";
    region.style.height = open ? content.offsetHeight + "px" : "0px";
    chevron.style.transition = ms ? `transform ${ms}ms ${EASE}` : "none";
    chevron.style.transform = open ? "rotate(180deg)" : "";
    if (reduced) content.style.transition = `opacity ${FADE}ms`;
    else if (open) content.style.transition = `opacity ${CONTENT_IN}ms ${EASE} ${CONTENT_DELAY}ms, transform ${CONTENT_IN + 80}ms ${EASE} ${CONTENT_DELAY}ms`;
    else content.style.transition = `opacity ${CONTENT_OUT}ms, transform ${CONTENT_OUT}ms`;
    content.style.opacity = open ? "1" : "0";
    content.style.transform = open || reduced ? "" : `translateY(${-SLIDE}px)`;
    s.timer = setTimeout(() => {
      region.style.transition = "none";
      if (open) region.style.height = "auto";
      else region.style.visibility = "hidden";
    }, Math.max(ms, reduced ? FADE : 0) + 20);
    if (!open && !reduced) content.addEventListener("transitionend", () => {
      if (!s.open) content.style.transform = `translateY(${-SLIDE}px)`;
    }, { once: true });
  }
  function sync(instant = false) {
    const keys = openKeys();
    for (const s of sections.values()) show(s, keys.includes(s.item.value), instant);
  }
  function toggle(key) {
    const keys = openKeys();
    const isOpen = keys.includes(key);
    let next;
    if (p().type === "multiple") next = isOpen ? keys.filter((k) => k !== key) : [...keys, key];
    else if (isOpen) {
      if (!p().collapsible) return;
      next = [];
    } else next = [key];
    if (p().haptics) vibrate(4);
    if (p().value === void 0) inner = next;
    p().onValueChange?.(next);
    if (p().value === void 0) sync();
  }
  function make(item) {
    const n = ++uid;
    const root = document.createElement("div");
    root.className = "dissolve-accordion-item";
    const heading = document.createElement("div");
    heading.className = "dissolve-accordion-heading";
    heading.setAttribute("role", "heading");
    heading.setAttribute("aria-level", "3");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dissolve-accordion-trigger";
    Object.assign(trigger.style, { background: "none", border: "0", margin: "0", font: "inherit", cursor: "pointer" });
    trigger.id = `${id}-t${n}`;
    const title = document.createElement("span");
    title.className = "dissolve-accordion-title";
    const chevron = document.createElement("span");
    chevron.className = "dissolve-accordion-chevron";
    chevron.innerHTML = CHEVRON;
    trigger.append(title, chevron);
    heading.append(trigger);
    const region = document.createElement("div");
    region.className = "dissolve-accordion-region";
    region.id = `${id}-r${n}`;
    region.setAttribute("role", "region");
    region.setAttribute("aria-labelledby", trigger.id);
    trigger.setAttribute("aria-controls", region.id);
    trigger.setAttribute("aria-expanded", "false");
    const content = slotOf(item.value);
    region.append(content);
    root.append(heading, region);
    const s = { item, root, trigger, title, chevron, region, content, open: true, timer: void 0 };
    trigger.addEventListener("click", () => toggle(s.item.value));
    show(s, false, true);
    if (openKeys().includes(item.value)) show(s, true, true);
    return s;
  }
  function build() {
    const items = p().items;
    const seen = /* @__PURE__ */ new Set();
    items.forEach((item, i) => {
      seen.add(item.value);
      let s = sections.get(item.value);
      if (!s) {
        s = make(item);
        sections.set(item.value, s);
      }
      s.item = item;
      s.title.textContent = item.title;
      s.trigger.disabled = !!item.disabled;
      if (item.content !== void 0) s.content.replaceChildren(item.content);
      if (host.children[i] !== s.root) host.insertBefore(s.root, host.children[i] ?? null);
    });
    for (const [key, s] of sections) if (!seen.has(key)) {
      clearTimeout(s.timer);
      s.root.remove();
      sections.delete(key);
      slots.delete(key);
    }
  }
  const onKey = (e) => {
    const t = e.target;
    if (!t.classList?.contains("dissolve-accordion-trigger")) return;
    const list = [...sections.values()].map((s) => s.trigger).filter((b) => !b.disabled);
    const i = list.indexOf(t);
    if (i === -1) return;
    const to = e.key === "ArrowDown" ? list[(i + 1) % list.length] : e.key === "ArrowUp" ? list[(i - 1 + list.length) % list.length] : e.key === "Home" ? list[0] : e.key === "End" ? list[list.length - 1] : null;
    if (!to) return;
    e.preventDefault();
    to.focus();
  };
  host.addEventListener("keydown", onKey);
  build();
  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has("items")) build();
      if (changed.has("value") || changed.has("type")) sync();
    },
    slot: slotOf,
    destroy() {
      sc.dispose();
      host.removeEventListener("keydown", onKey);
      for (const s of sections.values()) {
        clearTimeout(s.timer);
        s.root.remove();
      }
      sections.clear();
      slots.clear();
      host.removeAttribute("data-dissolve");
    }
  };
}
export {
  createAccordion
};
