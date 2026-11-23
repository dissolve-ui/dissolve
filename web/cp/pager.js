// PagerTabs demo. The pager is the React web component's core (registry/web/pager-tabs.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a reading app
// with seven topics, more than fit, and the autoplay, which walks the tabs.
import { createPagerTabs } from '../lib/pager-tabs.js';
import { el, fitTile, availW, prop, add, webAdd } from './kit.js';

const TOPICS = {
  'For you': [['The quiet return of the corner shop', 'Cities, 6 min'], ['Why bread needs a cold night', 'Food, 4 min'], ['A walk along the old canal', 'Travel, 9 min'], ['Designing for one hand', 'Design, 5 min'], ['Ten books for a long train', 'Books, 3 min']],
  Following: [['Maya Chen on studio light', 'Interview, 8 min'], ['Theo Martin bakes again', 'Notes, 2 min'], ['Ines Duval: cities on foot', 'Essay, 11 min'], ['Sam Okafor runs the river', 'Diary, 3 min']],
  Design: [['Designing for one hand', '5 min'], ['Grey is a color too', '4 min'], ['The case for smaller kitchens', '7 min'], ['Type that reads at night', '6 min']],
  Cities: [['The quiet return of the corner shop', '6 min'], ['Benches, and who they are for', '5 min'], ['Mapping the shade', '8 min'], ['Night buses of Lyon', '4 min']],
  Food: [['Why bread needs a cold night', '4 min'], ['Soup for a whole week', '3 min'], ['The market at nine', '5 min'], ['Coffee without the gear', '6 min']],
  Travel: [['A walk along the old canal', '9 min'], ['Trains over planes, a year in', '12 min'], ['Packing for four days', '3 min'], ['Islands out of season', '7 min']],
  Books: [['Ten books for a long train', '3 min'], ['Reading slowly on purpose', '6 min'], ['Essays on walking', '5 min'], ['Libraries after dark', '7 min']],
};
const TABS = Object.keys(TOPICS);

function mountPager(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 340 : mode === 'stage' ? Math.round(Math.min(400, (availW(body) || 400) - 4)) : Math.round(Math.min(380, (availW(body) || 360) - 4));
  const H = mode === 'stage' ? 380 : 320;
  const root = el('div', 'pg-demo');
  root.style.width = W + 'px';
  root.style.height = H + 'px';
  const host = el('div', 'pg-host');
  root.append(host);
  body.append(tile ? fitTile(body, root, W, H) : root);

  const pager = createPagerTabs(host, { tabs: TABS });
  sc.onDispose(() => pager.destroy());
  pager.pages.forEach((page, i) => {
    const list = el('ul', 'pg-list');
    for (const [t, m] of TOPICS[TABS[i]]) {
      const li = el('li', 'pg-row');
      li.append(el('div', 'pg-title'), el('div', 'pg-meta'));
      li.firstChild.textContent = t;
      li.lastChild.textContent = m;
      list.append(li);
    }
    page.append(list);
  });

  // A real pointer on the pager stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  root.addEventListener('wheel', (e) => { if (e.isTrusted) user = true; }, { passive: true });

  return {
    async run() {
      for (const i of [1, 2, 3, 0]) {
        await sc.wait(i ? 900 : 1100);
        if (!sc.alive || user) return;
        pager.select(i);
      }
    },
  };
}

export const ENTRIES = {
  'pager-tabs': {
    title: 'PagerTabs',
    note: 'Tabs over swipeable pages: a soft pill slides and stretches between the tabs.',
    desc: 'Tabs above swipeable pages. Swipe the pages (touch, a trackpad, or drag them with the mouse) and a soft pill slides behind the tabs the whole way, following the finger, stretching between two tabs of different widths; the label on it turns from muted to full ink as it arrives. No underline, no rule. Tap a tab and the pages glide to it. With more tabs than fit, the row scrolls on its own to keep the active tab in view. On the web the row is ARIA tabs: once it has focus the arrow keys, Home and End move between tabs. Give it a height: the pages fill it under the tabs and each scrolls on its own. A tick when the page changes. Reduced motion: a tap jumps straight to its page.',
    hint: 'Swipe the pages, or click a tab',
    tileHint: 'Click a tab',
    mount: mountPager,
    code: add('pager-tabs', 'PagerTabs, type PagerTabsHandle', `<PagerTabs
  tabs={['For you', 'Following', 'Design', 'Cities']}
  renderPage={(tab) => <Feed topic={tab} />}
  onIndexChange={(i) => track('tab', i)}
  className="flex-1"
/>

// A few tabs sharing the width, from code with a ref.
const pager = useRef<PagerTabsHandle>(null);
<PagerTabs ref={pager} tabs={['Day', 'Week', 'Month']} scrollable={false} renderPage={renderRange} />
pager.current?.select(2);`),
    webCode: webAdd('pager-tabs', 'PagerTabs, type PagerTabsHandle', `<PagerTabs
  tabs={['For you', 'Following', 'Design', 'Cities']}
  renderPage={(tab) => <Feed topic={tab} />}
  onIndexChange={(i) => track('tab', i)}
  style={{ height: 600 }}
/>

// A few tabs sharing the width, from code with a ref.
const pager = useRef<PagerTabsHandle>(null);
<PagerTabs ref={pager} tabs={['Day', 'Week', 'Month']} scrollable={false} renderPage={renderRange} style={{ height: 480 }} />
pager.current?.select(2);`),
    props: [
      prop('tabs', 'string[]', '', 'The tab labels, one page each.'),
      prop('renderPage', '(tab: string, index: number) =&gt; ReactNode', '', 'The page of each tab. Each page scrolls on its own.'),
      prop('initialIndex', 'number', '0', 'The page shown first.'),
      prop('onIndexChange', '(index: number) =&gt; void', '', 'Called when the pages settle on a new tab.'),
      prop('scrollable', 'boolean', 'true', 'The tab row scrolls when the tabs do not fit; false shares the width between them.'),
      prop('haptics', 'boolean', 'true', 'A tick when the page changes.'),
      prop('ref.select', '(index: number, animated?: boolean) =&gt; void', '', 'Goes to a page from code, as a tap on its tab.'),
      prop('className', 'string', '', 'Outer classes. Give it a height (flex: 1, or a fixed height on the web).'),
    ],
  },
};
