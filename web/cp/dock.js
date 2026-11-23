// MagnifyDock demo. The dock is the React web component's core (registry/web/magnify-dock.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: seven apps on
// a plain desk, and the autoplay, which sweeps a pointer along the dock and launches an app.
import { createMagnifyDock, dockIcon } from '../lib/magnify-dock.js';
import { el, availW, prop, add, tween } from './kit.js';

const APPS = ['finder', 'mail', 'music', 'photos', 'notes', 'calendar', 'settings'].map((key) => ({
  key,
  label: key[0].toUpperCase() + key.slice(1),
  icon: dockIcon(key),
}));

/** A phone dock in a narrow box, a desktop dock in a wide one. */
const sizing = (w) => (w >= 560 ? { size: 52, magnification: 1.8, gap: 6 } : w >= 330 ? { size: 36, magnification: 1.55, gap: 5 } : { size: 30, magnification: 1.5, gap: 4 });

function mountDock(body, { sc, mode }) {
  const W = Math.round(Math.max(260, (availW(body) || 340) - 4));
  const root = el('div', 'dk-demo');
  root.style.width = W + 'px';
  const host = el('div');
  root.append(host);
  body.append(root);

  let running = ['finder'];
  const dock = createMagnifyDock(host, {
    items: APPS,
    label: 'Apps',
    running,
    onLaunch: (item) => {
      if (running.includes(item.key)) return;
      running = [...running, item.key];
      dock.update({ running });
    },
    ...sizing(W),
  });
  sc.onDispose(() => dock.destroy());

  // A real pointer on the dock stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  root.addEventListener('pointerover', (e) => { if (e.isTrusted) user = true; });

  // The scripted pointer: a mouse moving along the shelf, as a visitor would.
  const shelf = () => host.querySelector('.dissolve-md-shelf')?.getBoundingClientRect();
  const fire = (type, x) => {
    const r = host.getBoundingClientRect();
    host.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: x, clientY: r.bottom - 14, bubbles: type !== 'pointerleave' }));
  };

  return {
    async run() {
      await sc.wait(300);
      if (!sc.alive || user) return;
      running = ['finder'];
      dock.update({ running });
      const s = shelf();
      if (!s) return;
      const a = s.left + 12, b = s.right - 12;
      const stop = () => user;
      await tween(sc, 1500, (k) => fire('pointermove', a + (b - a) * (0.5 - Math.cos(Math.PI * k) / 2)), stop);
      await tween(sc, 900, (k) => fire('pointermove', b - (b - a) * 0.42 * (0.5 - Math.cos(Math.PI * k) / 2)), stop);
      if (!sc.alive || user) return;
      await sc.wait(250);
      // Launch the app under the pointer: it hops, then its dot lights up.
      const x = b - (b - a) * 0.42;
      fire('pointerdown', x);
      fire('pointerup', x);
      await sc.wait(1100);
      if (!sc.alive || user) return;
      fire('pointerleave', -1e4);
    },
  };
}

export const ENTRIES = {
  'magnify-dock': {
    title: 'MagnifyDock',
    note: 'The macOS dock: icons swell around the pointer and hop when they launch.',
    desc: 'The macOS dock. Move the pointer along it and the icons swell around it, each on its own spring: the one under the pointer is the largest, its neighbours ease up with the distance, and the frosted shelf widens with them so nothing overlaps, anchored at the pointer so the icon under it stays under it. Icons grow from the bottom, as vectors redrawn at their size, never a scaled bitmap. The name of the icon under the pointer floats above it. Click it and it launches: it hops out of the shelf and bounces once like a ball, then a dot lights under it and stays while the app runs (running, controlled or not). On a phone, press and slide along the dock to magnify under the finger; lifting launches the icon under it. Keyboard: Tab in, the arrow keys, Home and End move (the focused icon swells), Enter or Space launches. Icons are vector specs on a 100 by 100 grid: dockIcon gives seven ready ones (finder, mail, music, photos, notes, calendar with today\'s date, settings), or describe your own. The shelf follows the theme. A tick on launch. Reduced motion: no magnification and no bounce; names and dots still show.',
    hint: 'Hover the dock, click an icon',
    tileHint: 'Hover the dock',
    mount: mountDock,
    code: add('magnify-dock', 'MagnifyDock, dockIcon', `<MagnifyDock
  items={[
    { key: 'mail', label: 'Mail', icon: dockIcon('mail') },
    { key: 'music', label: 'Music', icon: dockIcon('music') },
    { key: 'notes', label: 'Notes', icon: dockIcon('notes') },
  ]}
  onLaunch={(item) => open(item.key)}
/>

// A phone sized dock, running apps controlled.
<MagnifyDock items={apps} size={38} magnification={1.5} gap={5} running={running} onLaunch={launch} />`),
    props: [
      prop('items', '{ key, label, icon }[]', '', 'The apps. icon is a vector spec: dockIcon(\'mail\') or your own DockIconSpec (a tile paint and layers on a 100 x 100 grid).'),
      prop('onLaunch', '(item, index) =&gt; void', '', 'Called when an icon launches (a click, a lift on touch, Enter), as it starts to bounce.'),
      prop('running', 'string[]', '', 'Keys of the running apps, a dot under each (controlled). Pair it with onLaunch.'),
      prop('defaultRunning', 'string[]', '[]', 'Running apps at first when uncontrolled. Launching adds to it.'),
      prop('size', 'number', '56', 'Icon size at rest, in pt.'),
      prop('magnification', 'number', '1.9', 'Size of the icon under the pointer, as a multiple.'),
      prop('reach', 'number', '2.6', 'How far the swell reaches, in icons.'),
      prop('gap', 'number', '6', 'Space between icons, in pt.'),
      prop('labels', 'boolean', 'true', 'The name above the icon under the pointer.'),
      prop('haptics', 'boolean', 'true', 'A tick on launch.'),
      prop('label', 'string', `'Dock'`, 'The toolbar\'s accessible name (web).'),
      prop('appearance', `'auto' | 'light' | 'dark'`, `'auto'`, 'The shelf\'s look: auto reads the background token (web).'),
      prop('className', 'string', '', 'Outer classes (margins...). It takes the full width and reserves the height it needs.'),
    ],
  },
};
