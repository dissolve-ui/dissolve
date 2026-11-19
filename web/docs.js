/* Docs pages: Introduction, Installation, CLI, Theming, Agent prompt, plus the "works with your coding agent" strip.
   Page builders take the helpers from app.js ({ pageHead, codeBlock, cmd, copyIcon, icon, GLYPH }). */

import { PKG } from './variants-content.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PEERS = ['@shopify/react-native-skia', 'react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler', 'expo-haptics'];
const INSTALL = `npx expo install ${PKG} ${PEERS.join(' ')}`;
const SKILL_PATH = 'skills/dissolve/SKILL.md';
const GITHUB = 'https://github.com/rs-4/dissolve';

const skillURL = () => new URL(SKILL_PATH, location.href).href;

const PROVIDER = `import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from 'dissolve-ui';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <Stack />
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}`;

const QUICK = `import { Pressable, View } from 'react-native';
import { useDissolve } from 'dissolve-ui';

export function Row({ item, onRemove }) {
  const { ref, dissolving, dissolve } = useDissolve();

  return (
    <Pressable onPress={async () => {
      await dissolve({ preset: 'sand' });
      onRemove(item.id); // the space can be reclaimed
    }}>
      <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
        {/* row content */}
      </View>
    </Pressable>
  );
}`;

const PROMPT = `Add dissolve-ui to this React Native / Expo app. It snapshots any view with Skia and turns it into grains animated on the UI thread (Reanimated 4).

1. Install the package and its peers:
   ${INSTALL}
   (Known good: Expo SDK 57, Skia 2.6, Reanimated 4.5, react-native-worklets 0.10, gesture handler 2.32. Bare React Native needs 'react-native-worklets/plugin' in babel.config.js.)

2. Wrap the root layout once, above the navigator, inside GestureHandlerRootView:
   <GestureHandlerRootView style={{ flex: 1 }}>
     <DissolveProvider><Stack /></DissolveProvider>
   </GestureHandlerRootView>
   Do not add a second provider if one exists.

3. Use the hook on the view that should disappear:
   const { ref, dissolving, dissolve } = useDissolve();
   <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>...</View>
   await dissolve({ preset: 'dust' });
   then remove the item from state. Never unmount the view before the await resolves.

4. Ready-made components (swipe to delete, toasts, like button, slide to confirm, OTP input, thinking orb, mini player...) are not exported by the package. They are copied into the project with the CLI, shadcn style, and need NativeWind v5 (Tailwind v4 on react-native-css) plus tailwind-merge. Skip a) if NativeWind v5 already runs in the app.
   a) NativeWind v5 on Expo SDK 57:
      npm pkg set overrides.lightningcss=1.30.1
      npm install --legacy-peer-deps nativewind@5.0.0-preview.4 react-native-css@3.0.7 tailwindcss@^4 @tailwindcss/postcss tailwind-merge
      metro.config.js: module.exports = withNativewind(getDefaultConfig(__dirname), { inlineVariables: false, globalClassNamePolyfill: false }) (withNativewind from 'nativewind/metro')
      postcss.config.mjs: export default { plugins: { '@tailwindcss/postcss': {} } };
      nativewind-env.d.ts: /// <reference types="react-native-css/types" />
      global.css starts with: @import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/preflight.css" layer(base); @import "tailwindcss/utilities.css"; and is imported once at the top of the root layout.
   b) npx dissolve-ui init --native   (once: dissolve.json, tw.tsx primitives + --dissolve-* theme tokens in global.css, then it checks the setup and prints what is missing: fix everything it reports)
   c) npx dissolve-ui add <name>      (npx dissolve-ui list shows the names; dependencies between components are copied too)
      import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';
   Restyle with className and the part classNames (textClassName, boxClassName...), or change the --dissolve-* tokens in global.css. Light and dark follow the system.
   Finish by running npx tsc --noEmit and starting the app.

Pick the variant from the intent:
- Exits (useDissolve): delete a row or card: dust. Delete forever: sand. Unsend or burn: ember. Tap to pop: snap with origin { x: locationX, y: locationY }. Error or broken: shatter. Playful: melt. Clear all: field: 'cascade' with rows (local Y of each row) on the list container.
- Archive or move: stream with to: iconRef and onArrive to bump the icon.
- Entrances: new message or card: <DissolveIn preset="gather">. List: <DissolveIn preset="rain" delay={i * 40}>. Generated text: useAppear().appear({ preset: 'print' }).
- Gestures: swipe to dismiss: fling with the release velocity, or useDissolveScrub({ preset, onCommit }) for a reversible drag. Sticker or card dismissal by hand: useDissolvePeel({ onCommit }), both return { ref, gesture, style } for a GestureDetector around an Animated.View. Destructive confirm (delete account, wipe data): useDissolveHold({ onCommit }) instead of an alert, spread pressHandlers on a Pressable.
- Transitions: toggle state (Follow to Following): useDissolveMorph. Leave a screen: useDissolveScreen().dissolveScreen({ preset: 'sand', then: () => router.back() }).

Rules:
- One effect per user action, on user intent only, 0.9 s to 1.8 s.
- Reduced motion is handled by the provider (the effect is skipped), do not add a custom fallback.
- Keep grain counts reasonable: default grain on cards, a larger grain on big views, useDissolveScreen for full screens, one cascade burst instead of one burst per row.
- Import the engine and hooks from dissolve-ui. Import components from their copied file, never from the package.

For a React web app (Next.js, Vite) there is no engine to install: run npx dissolve-ui init --web, then npx dissolve-ui add <name> (npx dissolve-ui list shows which components run on the web). The components need React 19 and react-dom only, and take the same props as on native.`;

/** The copyable setup prompt, shared by the Installation and Agent prompt pages. */
function promptBlock(copyIcon, label = 'Tell your coding agent') {
  return `<div class="prompt">
      <div class="prompt-head"><span>${label}</span><button class="icon-btn" aria-label="Copy prompt" data-copy>${copyIcon}</button></div>
      <div class="prompt-body"><pre class="dc-prompt">${esc(PROMPT)}</pre></div>
    </div>`;
}

/* ---------- Brand marks (Simple Icons, CC0) ---------- */

export const CLAUDE_PATH = 'm4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z';
export const OPENAI_PATH = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z';

const mark = (d, label, size = 18) =>
  `<svg class="dc-mark" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="${label}"><path d="${d}"/></svg>`;

const ICONS = {
  prompt: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="2.5"/><path d="M5 6.5 7 8.5 5 10.5M8.5 10.5H11"/></svg>',
  skill: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h5.5L12.5 5v9H4z"/><path d="M9.5 2v3h3M6.5 8.5h3.5M6.5 11h3.5"/></svg>',
  mcp: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11v3"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10"/></svg>',
  open: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10M9 2h5v5M14 2 7.5 8.5"/></svg>',
  arrow: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
};

const step = (n, title, id) => `<h2 class="section-title dc-step" id="${id}"><span class="dc-num">${n}</span>${title}</h2>`;

/* ---------- Components: CLI, NativeWind v5, theme ---------- */

const CLI = `npx ${PKG}`;
const STYLE_INSTALL = 'npx expo install nativewind@5.0.0-preview.4 react-native-css@3.0.7 tailwindcss @tailwindcss/postcss tailwind-merge';

const METRO = `const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  inlineVariables: false,         // keeps the theme tokens live, light and dark
  globalClassNamePolyfill: false, // className comes from the tw primitives
});`;

const POSTCSS = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};`;

const GLOBAL_CSS = `@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

/* npx dissolve-ui init appends the dissolve tokens below */`;

const OVERRIDES = `{
  "overrides": {
    "lightningcss": "1.30.1"
  }
}`;

const ADD_EXAMPLE = `import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';

<SlideToConfirm
  label="Slide to pay 42 €"
  doneLabel="Paid"
  onConfirm={pay}
  className="mx-4"
/>`;

const WEB_EXAMPLE = `import { ScratchCard } from '@/components/dissolve/scratch-card';

export default function Page() {
  return (
    <ScratchCard onReveal={claim}>
      <span className="text-4xl font-bold">$25</span>
    </ScratchCard>
  );
}`;

const OVERRIDE_EXAMPLE = `// Defaults: track bg-dissolve-surface, number text-dissolve-foreground
<SlideToConfirm
  label="Slide to order"
  onConfirm={order}
  className="bg-amber-100"                      // replaces bg-dissolve-surface
/>

<NumberTicker
  value={total}
  textClassName="text-emerald-600 font-bold"    // replaces the color and the weight
/>`;

const THEME_EDIT = `/* global.css, after init */
:root {
  --dissolve-primary: rgb(120 72 40);
  --dissolve-primary-foreground: rgb(255 248 240);
  --dissolve-accent: rgb(196 120 60);
}

@media (prefers-color-scheme: dark) {
  :root {
    --dissolve-primary: rgb(232 200 168);
    --dissolve-primary-foreground: rgb(40 24 12);
  }
}`;

const THEME_INLINE = `@layer theme {
  @theme inline {
    --color-dissolve-surface: var(--dissolve-surface);
    /* ... one line per token */
  }
}`;

const USE_TOKEN = `import { useToken } from '@/components/dissolve/tw';

const ink = useToken('foreground'); // live color string, light or dark
<Path path={stroke} color={ink} />`;

const TOKENS = [
  ['background', '255 255 255', '0 0 0', 'Screen behind the components'],
  ['surface', '242 242 247', '28 28 30', 'Tracks, pads, bubbles, frames'],
  ['surface-2', '229 229 234', '44 44 46', 'Raised pills and controls'],
  ['foreground', '28 28 30', '242 242 247', 'Text, digits, ink'],
  ['muted', '142 142 147', '152 152 157', 'Secondary text, idle icons, placeholders'],
  ['primary', '28 28 30', '242 242 247', 'Main buttons, knobs, toasts'],
  ['primary-foreground', '255 255 255', '28 28 30', 'Content on primary'],
  ['success', '52 199 89', '48 209 88', 'Done and verified states'],
  ['danger', '255 59 48', '255 69 58', 'Destructive actions, wrong codes'],
  ['danger-foreground', '255 255 255', '255 255 255', 'Content on danger'],
  ['accent', '10 132 255', '10 132 255', 'Your own voice notes, highlights'],
  ['border', '60 60 67 / 0.12', '84 84 88 / 0.5', 'Hairlines, the signing line'],
  ['chart-1', '255 55 135', '255 79 152', 'First chart series, pink'],
  ['chart-2', '124 92 255', '142 114 255', 'Second chart series, violet'],
  ['chart-3', '255 196 0', '255 210 51', 'Third chart series, yellow'],
];

const swatch = (rgb) => `<span class="dc-swatch" style="background: rgb(${rgb})"></span><code>${rgb}</code>`;

function tokenTable() {
  return `<div class="dc-table-wrap">
      <table class="dc-table dc-tokens">
        <thead><tr><th>Token</th><th>Light</th><th>Dark</th><th>Used for</th></tr></thead>
        <tbody>${TOKENS.map(([t, l, d, u]) => `<tr><td><code>--dissolve-${t}</code></td><td class="dc-nowrap">${swatch(l)}</td><td class="dc-nowrap">${swatch(d)}</td><td>${u}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
}

/* ---------- Introduction ---------- */

export function introductionPage({ pageHead, icon }) {
  return `
    ${pageHead('introduction', 'dissolve', 'An animation library for React Native, with its components for React on the web too. Wrap any view and it dissolves, melts, peels or rebuilds itself. Sixteen variants, all on the UI thread.', `<span class="glyph-lg">${icon('dust', 26)}</span>`)}
    <p class="dc-lead"><code>${PKG}</code> gives deletes, archives, arrivals and gestures a physical ending. Wrap your app once, put a ref on a view, call <code>dissolve()</code>.</p>
    <h2 class="section-title">How it works</h2>
    <ol class="dc-how">
      <li><span class="dc-num">1</span><div><strong>Snapshot.</strong> Skia captures the view with <code>makeImageFromView</code>, so any view works: text, images, blur, gradients.</div></li>
      <li><span class="dc-num">2</span><div><strong>Grains.</strong> The image is cut into a grid of grains drawn with a single <code>&lt;Atlas&gt;</code>, capped at 6000 per effect.</div></li>
      <li><span class="dc-num">3</span><div><strong>UI thread.</strong> Every grain is moved in one Reanimated 4 reaction per frame, idle grains are skipped, haptics follow the motion.</div></li>
    </ol>
    <h2 class="section-title">Two parts</h2>
    <ol class="dc-how">
      <li><span class="dc-num">1</span><div><strong>The engine, from npm.</strong> <code>npm install ${PKG}</code> gives you the provider and the hooks: <code>useDissolve</code>, <code>DissolveIn</code>, <code>useAppear</code>, the gesture and transition hooks. Every variant in the sidebar runs on it.</div></li>
      <li><span class="dc-num">2</span><div><strong>Components, copied into your app.</strong> Swipe to delete, toasts, slide to confirm and the rest are not in the package. <code>npx ${PKG} add</code> copies their source into <code>components/dissolve</code>, the shadcn way: the code is yours, styled with classNames and the <code>--dissolve-*</code> theme tokens.</div></li>
      <li><span class="dc-num">3</span><div><strong>React Native or React.</strong> <code>npx ${PKG} init</code> asks which one and saves it in <code>dissolve.json</code>. On the web, components take the same props, need only React 19 and <code>react-dom</code>, and draw on a canvas: no engine to install. Each component page has a switch for its React Native and React snippets.</div></li>
    </ol>
    <div class="dc-actions">
      <a class="btn btn-accent" href="#/gallery">See the Gallery ${ICONS.arrow}</a>
      <a class="btn" href="#/installation">Installation</a>
      <a class="btn" href="#/cli">CLI</a>
      <a class="btn" href="#/agent-prompt">Use it with your agent</a>
    </div>`;
}

/* ---------- Installation ---------- */

const PEER_ROWS = [
  ['@shopify/react-native-skia', '2.6', 'Snapshot and Atlas drawing'],
  ['react-native-reanimated', '4.5', 'UI thread animation'],
  ['react-native-worklets', '0.10', 'Worklets runtime for Reanimated 4'],
  ['react-native-gesture-handler', '2.32', 'Scrub, peel and hold gestures'],
  ['expo-haptics', '57', 'Haptic ticks during the effect'],
];

const STYLE_ROWS = [
  ['nativewind', '5.0.0-preview.4', 'className on React Native views'],
  ['react-native-css', '3.0.7', 'The CSS runtime behind NativeWind v5'],
  ['tailwindcss + @tailwindcss/postcss', '4', 'Tailwind v4 compiler'],
  ['tailwind-merge', '3', 'Your classes win over the defaults'],
  ['lightningcss (override)', '1.30.1', 'Pinned for Expo SDK 57'],
];

export function installationPage({ pageHead, codeBlock, cmd, copyIcon, GLYPH }) {
  return `
    ${pageHead('installation', 'Installation', 'Paste one prompt into your coding agent and it sets up everything: engine, provider, NativeWind and components. Or follow the steps by hand.', `<span class="glyph-lg">${GLYPH.installation}</span>`)}
    <h2 class="section-title" id="dc-agent">With your agent <span class="badge">Fastest</span></h2>
    <p class="dc-text">Works with Claude Code, Codex, Cursor or any chat. It installs the engine, wraps the root layout, sets up NativeWind v5, runs <code>init</code> and adds the components you ask for. More options, like the skill and the MCP server, are on the <a class="dc-link" href="#/agent-prompt">Agent prompt</a> page.</p>
    ${promptBlock(copyIcon)}

    <h2 class="section-title" id="dc-web">React on the web</h2>
    <p class="dc-text">Building a Next.js or Vite app? Skip the engine and NativeWind: web components need React 19 and <code>react-dom</code>, nothing else. <code>init</code> asks the platform (React is preselected in a web project), saves it in <code>dissolve.json</code> and writes the theme tokens, as plain CSS when the project has no Tailwind.</p>
    ${cmd(`${CLI} init --web`)}
    ${cmd(`${CLI} add scratch-card`)}
    ${codeBlock(WEB_EXAMPLE, { title: 'app/page.tsx' })}
    <p class="dc-note">Same props as on React Native. <code>${CLI} list</code> shows which components run on the web, and every component page has a React Native / React switch.</p>

    <h2 class="section-title" id="dc-manual">React Native, by hand</h2>
    ${step(1, 'Install the engine', 'dc-install')}
    <p class="dc-text">The package holds the engine and the hooks. It is all you need for the variants.</p>
    ${cmd(INSTALL)}
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead><tr><th>Peer</th><th>Tested</th><th>Used for</th></tr></thead>
        <tbody>${PEER_ROWS.map(([p, v, u]) => `<tr><td><code>${p}</code></td><td>${v}</td><td>${u}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="dc-note">Built on Expo SDK 57 and React Native 0.86, runs in Expo Go. Expo's Babel preset already adds the worklets plugin. In a bare React Native app, add <code>'react-native-worklets/plugin'</code> to <code>babel.config.js</code>.</p>

    ${step(2, 'Add the provider', 'dc-provider')}
    <p class="dc-text">The provider draws grains in a full screen overlay that ignores touches. Put it above your navigator so an effect survives a screen pop.</p>
    ${codeBlock(PROVIDER, { title: 'app/_layout.tsx' })}

    ${step(3, 'Quick start', 'dc-quick')}
    <p class="dc-text">Put the ref on the view to snapshot, hide it while it dissolves, and remove the item once the promise resolves.</p>
    ${codeBlock(QUICK, { title: 'Row.tsx' })}
    <p class="dc-note">Reduced motion is handled for you: the effect is skipped and the view hides at once.</p>

    <h2 class="section-title" id="dc-components">Components</h2>
    <p class="dc-text">Components are copied into your project instead of imported from the package, like shadcn. You own the file, edit it freely, and restyle it with classNames. They need NativeWind v5 (Tailwind v4 on <code>react-native-css</code>) and <code>tailwind-merge</code>.</p>

    ${step(4, 'Set up NativeWind v5', 'dc-nativewind')}
    <p class="dc-text">Skip this step if your app already runs NativeWind v5.</p>
    ${cmd(STYLE_INSTALL)}
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead><tr><th>Package</th><th>Tested</th><th>Used for</th></tr></thead>
        <tbody>${STYLE_ROWS.map(([p, v, u]) => `<tr><td><code>${p}</code></td><td>${v}</td><td>${u}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="dc-text" style="margin-top: 16px">On Expo SDK 57, pin <code>lightningcss</code> with npm <code>overrides</code> (<code>resolutions</code> is Yarn only), then reinstall with <code>npm install --legacy-peer-deps</code>.</p>
    ${codeBlock(OVERRIDES, { title: 'package.json', lang: 'json' })}
    ${codeBlock(METRO, { title: 'metro.config.js', lang: 'js' })}
    ${codeBlock(POSTCSS, { title: 'postcss.config.mjs', lang: 'js' })}
    ${codeBlock(GLOBAL_CSS, { title: 'global.css', lang: 'css' })}
    <p class="dc-note">Import <code>global.css</code> once at the top of <code>app/_layout.tsx</code>. The full guide is on <a class="dc-link" href="https://www.nativewind.dev/v5" target="_blank" rel="noopener">nativewind.dev</a>.</p>

    ${step(5, 'Init', 'dc-init')}
    <p class="dc-text">Once per project. It asks the platform (React Native is preselected in an Expo or React Native project) and saves it in <code>dissolve.json</code>, writes <code>tw.tsx</code>, the className primitives every component shares, and appends the theme tokens to your <code>global.css</code>. It also tells you which dependency is missing.</p>
    ${cmd(`${CLI} init`)}

    ${step(6, 'Add components', 'dc-add')}
    <p class="dc-text">Name one or more. Files land in <code>components/dissolve</code>, or <code>src/components/dissolve</code> with a <code>src/</code> layout, and the CLI prints the import line.</p>
    ${cmd(`${CLI} add slide-to-confirm swipe-to-delete`)}
    ${cmd(`${CLI} list`)}
    ${codeBlock(ADD_EXAMPLE, { title: 'Checkout.tsx' })}
    <p class="dc-note">Every option is on the <a class="dc-link" href="#/cli">CLI</a> page. Every component page shows its own <code>add</code> command and props.</p>

    ${step(7, 'Theme', 'dc-theme')}
    <p class="dc-text">Components read <code>--dissolve-*</code> tokens: <code>background</code>, <code>surface</code>, <code>surface-2</code>, <code>foreground</code>, <code>muted</code>, <code>primary</code>, <code>primary-foreground</code>, <code>success</code>, <code>danger</code>, <code>danger-foreground</code>, <code>accent</code>, <code>border</code>, <code>chart-1</code> to <code>chart-3</code>. Change a value in <code>global.css</code> and every component follows. Dark values sit in a <code>prefers-color-scheme: dark</code> block, so dark mode follows the system.</p>
    <p class="dc-text">For one instance, pass a className. Classes are merged with <code>tailwind-merge</code>, so yours replace the default of the same kind: <code>className="bg-amber-100"</code> replaces <code>bg-dissolve-surface</code>.</p>
    ${codeBlock(OVERRIDE_EXAMPLE, { title: 'Order.tsx' })}
    <div class="dc-actions">
      <a class="btn btn-accent" href="#/gallery">Pick a variant ${ICONS.arrow}</a>
      <a class="btn" href="#/theming">Theming</a>
      <a class="btn" href="#/agent-prompt">Let your agent do it</a>
    </div>`;
}

/* ---------- CLI ---------- */

const COMMANDS = [
  ['init', 'Asks the platform, React Native or React, with the one your <code>package.json</code> points to preselected, and saves it in <code>dissolve.json</code>. Appends the theme tokens to your <code>global.css</code>, and on native writes <code>tw.tsx</code> (className primitives, <code>cn</code>, <code>useToken</code>). Then lists missing dependencies.'],
  ['add &lt;name...&gt;', 'Copies one or more components for the platform in <code>dissolve.json</code>, running <code>init</code> first if it is missing, and prints the import line of each file.'],
  ['list', 'Every component, the platforms it runs on and a one line description. Alias: <code>ls</code>.'],
  ['help', 'Usage. Also <code>--help</code> or <code>-h</code>.'],
];

const OPTIONS = [
  ['--native, --web', 'asked', 'Pick the platform without the question. Saved in <code>dissolve.json</code>.'],
  ['--yes, -y', 'off', 'Take the detected platform. Also what happens without a terminal, in CI or scripts.'],
  ['--path, -p &lt;dir&gt;', '<code>components/dissolve</code>', 'Target folder, relative to the project.'],
  ['--overwrite, -o', 'off', 'Replace files that exist. Without it, existing files are skipped so your edits are safe. With <code>init</code>, appends the tokens again.'],
  ['--cwd &lt;dir&gt;', 'current folder', 'Project root, for monorepos and scripts.'],
];

const CONFIG = `{
  "platform": "web",
  "dir": "components/dissolve"
}`;

const ADD_OUTPUT = `$ npx dissolve-ui add toast like-button
added   components/dissolve/toast.tsx
        import { ToastProvider, useToast } from '@/components/dissolve/toast';
added   components/dissolve/like-button.tsx
        import { LikeButton } from '@/components/dissolve/like-button';`;

export function cliPage({ pageHead, codeBlock, cmd, GLYPH }) {
  return `
    ${pageHead('cli', 'CLI', 'Copy components into your project, the shadcn way. The source is yours to read, edit and restyle.', `<span class="glyph-lg">${GLYPH.cli}</span>`)}
    <p class="dc-lead">One CLI for React Native and React on the web, run it with <code>npx</code>. Native components need NativeWind v5 in the project, web components only React 19, see <a class="dc-link" href="#/installation">Installation</a>. <code>npx ${PKG}</code> runs the same CLI.</p>
    ${cmd(`${CLI} init`)}
    ${cmd(`${CLI} add swipe-to-delete toast`)}
    ${cmd(`${CLI} list`)}

    <h2 class="section-title">Commands</h2>
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead><tr><th>Command</th><th>Does</th></tr></thead>
        <tbody>${COMMANDS.map(([c, d]) => `<tr><td><code>${c}</code></td><td>${d}</td></tr>`).join('')}</tbody>
      </table>
    </div>

    <h2 class="section-title">Options</h2>
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead><tr><th>Option</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>${OPTIONS.map(([o, d, u]) => `<tr><td><code>${o}</code></td><td>${d}</td><td>${u}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    ${cmd(`${CLI} add otp-input --path app/ui/dissolve --overwrite`)}

    <h2 class="section-title">Platform</h2>
    <p class="dc-text"><code>init</code> preselects React Native when <code>package.json</code> has <code>react-native</code> or <code>expo</code>, React when it has <code>react-dom</code>, <code>next</code> or <code>vite</code> without them. The answer goes in <code>dissolve.json</code> at the project root, and every <code>add</code> reads it. Run <code>init --web</code> or <code>init --native</code> to switch.</p>
    ${codeBlock(CONFIG, { title: 'dissolve.json', lang: 'json' })}

    <h2 class="section-title">Where files go</h2>
    <p class="dc-text">By default <code>components/dissolve</code>. When <code>tsconfig.json</code> maps <code>@/*</code> to <code>./src/*</code> and a <code>src</code> folder exists, <code>src/components/dissolve</code>. Import lines use your <code>@/</code> alias when there is one, a relative path otherwise.</p>
    ${codeBlock(ADD_OUTPUT, { title: 'Terminal', lang: 'sh' })}

    <h2 class="section-title">What init writes</h2>
    <p class="dc-text">On the web, <code>dissolve.json</code> and the theme tokens, as plain CSS variables when the project has no Tailwind. Each component comes with its framework free core (<code>&lt;name&gt;.core.ts</code>) and the shared files it imports, nothing to install.</p>
    <p class="dc-text">On React Native, <code>tw.tsx</code> holds <code>View</code>, <code>Text</code>, <code>Pressable</code>, <code>TextInput</code> and <code>Animated</code> with className support, <code>cn()</code> to merge classes and <code>useToken()</code> to read a token as a color. The tokens go at the end of the first <code>global.css</code> found (root, <code>src/</code>, <code>app/</code>, <code>styles/</code>, or any CSS file importing Tailwind). With none, it writes <code>dissolve.css</code> next to the components: import it from your Tailwind entry.</p>
    <p class="dc-note">Running it twice is safe: files and tokens that exist are left alone.</p>
    <div class="dc-actions">
      <a class="btn btn-accent" href="#/theming">Theming ${ICONS.arrow}</a>
      <a class="btn" href="#/installation">Installation</a>
    </div>`;
}

/* ---------- Theming ---------- */

export function themingPage({ pageHead, codeBlock, GLYPH }) {
  return `
    ${pageHead('theming', 'Theming', 'Twelve tokens, light and dark. Change them once and every component follows, or override one instance with a className.', `<span class="glyph-lg">${GLYPH.theming}</span>`)}
    <p class="dc-lead"><code>init</code> adds the tokens to your <code>global.css</code>. Components take their colors from classes like <code>bg-dissolve-surface</code> or <code>text-dissolve-foreground</code>, so they follow your palette. On the web, components read the same <code>--dissolve-*</code> variables directly, with or without Tailwind.</p>

    <h2 class="section-title">Tokens</h2>
    ${tokenTable()}
    <p class="dc-note">Each token is also a Tailwind color: <code>bg-dissolve-primary</code>, <code>text-dissolve-muted</code>, <code>border-dissolve-border</code>. Use them in your own screens too.</p>

    <h2 class="section-title">Change them</h2>
    <p class="dc-text">Edit the values in <code>global.css</code>. Light values live on <code>:root</code>, dark ones in the <code>prefers-color-scheme: dark</code> block below.</p>
    ${codeBlock(THEME_EDIT, { title: 'global.css', lang: 'css' })}

    <h2 class="section-title">Dark mode</h2>
    <p class="dc-text">Nothing to wire: the dark block follows the system color scheme and components switch live. Keep the <code>:root</code> plus media query pattern, <code>light-dark()</code> does not resolve on native.</p>

    <h2 class="section-title">Why @theme inline</h2>
    <p class="dc-text">The tokens are mapped to Tailwind colors with <code>@theme inline</code>. Without <code>inline</code>, a class points at a <code>--color-*</code> variable that can be resolved once at the root, and on native it keeps the light value. With it, each class reads <code>var(--dissolve-*)</code> directly and picks the value of the current color scheme.</p>
    ${codeBlock(THEME_INLINE, { title: 'global.css', lang: 'css' })}

    <h2 class="section-title">Override one instance</h2>
    <p class="dc-text">Every component takes <code>className</code>, plus a className per part: <code>textClassName</code>, <code>knobClassName</code>, <code>boxClassName</code> and so on, listed in its props. Classes are merged with <code>tailwind-merge</code>, so yours win over the default of the same kind.</p>
    ${codeBlock(OVERRIDE_EXAMPLE, { title: 'Order.tsx' })}
    <p class="dc-note">Some colors are animated or drawn by Skia (OTP boxes, signature ink, waveform). They read the tokens through <code>useToken()</code>, so change the token, or edit the file: it is yours.</p>
    ${codeBlock(USE_TOKEN, { title: 'Your own Skia drawing' })}
    <div class="dc-actions">
      <a class="btn btn-accent" href="#/swipe-to-delete">Browse components ${ICONS.arrow}</a>
      <a class="btn" href="#/cli">CLI</a>
    </div>`;
}

/* ---------- Agent prompt ---------- */

const MCP_TOOLS = [
  ['list_variants', 'Every variant with its kind (exit, entrance, gesture, transition), hook and use case.'],
  ['get_variant', 'Usage snippet, options and best practices for one variant.'],
  ['get_setup', 'Install command, provider snippet, first effect, the component CLI and picking rules.'],
];

// Published as its own dependency free npm package, dissolve-ui-mcp.
const SERVER_CMD = 'npx -y dissolve-ui-mcp';
const DESKTOP = `{
  "mcpServers": {
    "dissolve": {
      "command": "npx",
      "args": ["-y", "dissolve-ui-mcp"]
    }
  }
}`;
const CODEX = `[mcp_servers.dissolve]
command = "npx"
args = ["-y", "dissolve-ui-mcp"]`;

export function agentPromptPage({ pageHead, codeBlock, cmd, copyIcon, GLYPH }) {
  const url = skillURL();
  const card = (id, ic, title, desc) => `<button class="dc-way" data-scroll="${id}"><span class="dc-way-icon">${ic}</span><span class="dc-way-title">${title}</span><span class="dc-way-desc">${desc}</span></button>`;
  return `
    ${pageHead('agent-prompt', 'Agent prompt', 'The fastest way to set up dissolve. Paste this prompt into your coding agent: it installs the engine, sets up NativeWind and adds the components you want.', `<span class="glyph-lg">${GLYPH['agent-prompt']}</span>`)}
    <div id="dc-prompt">${promptBlock(copyIcon)}</div>
    <h2 class="section-title">Keep it in your agent</h2>
    <p class="dc-text">Install the skill or the MCP server once, and your agent knows dissolve in every project.</p>
    <div class="dc-quick">
      <section class="dc-quick-card">
        <header>${mark(CLAUDE_PATH, 'Claude').replace('class="dc-mark"', 'class="dc-mark dc-claude"')}<strong>Claude Code</strong></header>
        <p class="dc-label">Install the skill</p>
        ${cmd(`mkdir -p ~/.claude/skills/dissolve-ui && curl -fsSL ${url} -o ~/.claude/skills/dissolve-ui/SKILL.md`)}
        <p class="dc-label">Add the MCP server</p>
        ${cmd(`claude mcp add dissolve -- ${SERVER_CMD}`)}
      </section>
      <section class="dc-quick-card">
        <header>${mark(OPENAI_PATH, 'OpenAI')}<strong>Codex</strong></header>
        <p class="dc-label">Add the instructions to AGENTS.md</p>
        ${cmd(`curl -fsSL ${url} >> AGENTS.md`)}
        <p class="dc-label">Add the MCP server</p>
        ${cmd(`codex mcp add dissolve -- ${SERVER_CMD}`)}
      </section>
    </div>

    <h2 class="section-title">Details</h2>
    <div class="dc-ways">
      ${card('dc-skill', ICONS.skill, 'Claude skill', 'Loaded when it is relevant.')}
      ${card('dc-mcp', ICONS.mcp, 'MCP server', 'Docs as tools, on demand.')}
    </div>

    ${step(1, 'Claude skill', 'dc-skill')}
    <p class="dc-text">An Agent Skill is a <code>SKILL.md</code> file Claude loads on its own whenever you ask for a dissolve effect. It holds the setup, the API of every hook, a variant picking table and the best practices.</p>
    <div class="dc-file">
      <span class="dc-file-icon">${ICONS.skill}</span>
      <div class="dc-file-meta"><span class="dc-file-name">SKILL.md</span><span class="dc-file-path">dissolve-ui</span></div>
      <a class="btn btn-sm" href="${SKILL_PATH}" target="_blank" rel="noopener">${ICONS.open}View</a>
      <a class="btn btn-sm btn-accent" href="${SKILL_PATH}" download="SKILL.md">${ICONS.download}Download</a>
    </div>
    <p class="dc-label">For all your projects</p>
    ${cmd(`mkdir -p ~/.claude/skills/dissolve-ui && curl -fsSL ${url} -o ~/.claude/skills/dissolve-ui/SKILL.md`)}
    <p class="dc-label">For this project only, shared with your team</p>
    ${cmd(`mkdir -p .claude/skills/dissolve-ui && curl -fsSL ${url} -o .claude/skills/dissolve-ui/SKILL.md`)}
    <p class="dc-note">Restart Claude Code, then ask for an effect, for example "dissolve the row when I delete a task". With other agents, paste the file into <code>AGENTS.md</code> or a Cursor rule.</p>

    ${step(2, 'MCP server', 'dc-mcp')}
    <p class="dc-text">A tiny MCP server with no dependencies, published on npm as <code>dissolve-ui-mcp</code>. Your agent runs it with <code>npx</code> over stdio, so it stays up to date, and it answers with the same data as the docs. The source is in <code>mcp/server.mjs</code> on <a class="dc-link" href="${GITHUB}" target="_blank" rel="noopener">GitHub</a>.</p>
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead><tr><th>Tool</th><th>Returns</th></tr></thead>
        <tbody>${MCP_TOOLS.map(([t, d]) => `<tr><td><code>${t}</code></td><td>${d}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="dc-label">Claude Code</p>
    ${cmd(`claude mcp add dissolve -- ${SERVER_CMD}`)}
    ${codeBlock(DESKTOP, { title: 'Claude Desktop · claude_desktop_config.json', lang: 'json' })}
    ${codeBlock(DESKTOP, { title: 'Cursor · .cursor/mcp.json', lang: 'json' })}
    ${codeBlock(CODEX, { title: 'Codex · ~/.codex/config.toml', lang: 'toml' })}
    <p class="dc-note">Then ask: "use the dissolve MCP to add a delete effect to the inbox rows".</p>`;
}

/* ---------- Gallery strip ---------- */

export function agentsStripHTML() {
  return `
  <aside class="dc-strip" aria-label="Works with your coding agent">
    <div class="dc-strip-marks">${mark(CLAUDE_PATH, 'Claude').replace('class="dc-mark"', 'class="dc-mark dc-claude"')}${mark(OPENAI_PATH, 'OpenAI')}</div>
    <p class="dc-strip-title">Works with your coding agent</p>
    <nav class="dc-strip-links">
      <a href="#/agent-prompt">Claude skill</a>
      <a href="#/agent-prompt">MCP</a>
      <a href="#/agent-prompt">Prompt</a>
    </nav>
  </aside>`;
}
