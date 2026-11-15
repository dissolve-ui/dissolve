/* Docs pages: Introduction, Installation, Agent prompt, plus the "works with your coding agent" strip.
   Page builders take the helpers from app.js ({ pageHead, codeBlock, cmd, copyIcon, icon, GLYPH }). */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PKG = 'react-native-dissolve';
const PEERS = ['@shopify/react-native-skia', 'react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler', 'expo-haptics'];
const INSTALL = `npx expo install ${PKG} ${PEERS.join(' ')}`;
const SKILL_PATH = 'skills/dissolve/SKILL.md';
const GITHUB = 'https://github.com/rs-4/dissolve';

const skillURL = () => new URL(SKILL_PATH, location.href).href;

const PROVIDER = `import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from 'react-native-dissolve';

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
import { useDissolve } from 'react-native-dissolve';

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

const PROMPT = `Add react-native-dissolve to this React Native / Expo app. It snapshots any view with Skia and turns it into grains animated on the UI thread (Reanimated 4).

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
- Use only the public exports of react-native-dissolve.`;

/* ---------- Brand marks (Simple Icons, CC0) ---------- */

const CLAUDE_PATH = 'm4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z';
const OPENAI_PATH = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z';

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

/* ---------- Introduction ---------- */

export function introductionPage({ pageHead, icon }) {
  return `
    ${pageHead('introduction', 'dissolve', 'An animation library for React Native. Wrap any view and it dissolves, melts, peels or rebuilds itself. Seventeen variants, all on the UI thread.', `<span class="glyph-lg">${icon('dust', 26)}</span>`)}
    <p class="dc-lead"><code>${PKG}</code> gives deletes, archives, arrivals and gestures a physical ending. Wrap your app once, put a ref on a view, call <code>dissolve()</code>.</p>
    <h2 class="section-title">How it works</h2>
    <ol class="dc-how">
      <li><span class="dc-num">1</span><div><strong>Snapshot.</strong> Skia captures the view with <code>makeImageFromView</code>, so any view works: text, images, blur, gradients.</div></li>
      <li><span class="dc-num">2</span><div><strong>Grains.</strong> The image is cut into a grid of grains drawn with a single <code>&lt;Atlas&gt;</code>, capped at 6000 per effect.</div></li>
      <li><span class="dc-num">3</span><div><strong>UI thread.</strong> Every grain is moved in one Reanimated 4 reaction per frame, idle grains are skipped, haptics follow the motion.</div></li>
    </ol>
    <div class="dc-actions">
      <a class="btn btn-accent" href="#/gallery">See the Gallery ${ICONS.arrow}</a>
      <a class="btn" href="#/installation">Installation</a>
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

export function installationPage({ pageHead, codeBlock, cmd, GLYPH }) {
  return `
    ${pageHead('installation', 'Installation', 'Install the package and its peers, then wrap your app once.', `<span class="glyph-lg">${GLYPH.installation}</span>`)}
    ${step(1, 'Install', 'dc-install')}
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
    <div class="dc-actions">
      <a class="btn btn-accent" href="#/gallery">Pick a variant ${ICONS.arrow}</a>
      <a class="btn" href="#/agent-prompt">Let your agent do it</a>
    </div>`;
}

/* ---------- Agent prompt ---------- */

const MCP_TOOLS = [
  ['list_variants', 'Every variant with its kind (exit, entrance, gesture, transition), hook and use case.'],
  ['get_variant', 'Usage snippet, options and best practices for one variant.'],
  ['get_setup', 'Install command, provider snippet, first effect and picking rules.'],
];

const SERVER = '/absolute/path/to/dissolve/mcp/server.mjs';
const DESKTOP = `{
  "mcpServers": {
    "dissolve": {
      "command": "node",
      "args": ["${SERVER}"]
    }
  }
}`;
const CODEX = `[mcp_servers.dissolve]
command = "node"
args = ["${SERVER}"]`;

export function agentPromptPage({ pageHead, codeBlock, cmd, copyIcon, GLYPH }) {
  const url = skillURL();
  const card = (id, ic, title, desc) => `<button class="dc-way" data-scroll="${id}"><span class="dc-way-icon">${ic}</span><span class="dc-way-title">${title}</span><span class="dc-way-desc">${desc}</span></button>`;
  return `
    ${pageHead('agent-prompt', 'Agent prompt', 'Give dissolve to your coding agent. Paste a prompt, install the skill, or plug in the MCP server.', `<span class="glyph-lg">${GLYPH['agent-prompt']}</span>`)}
    <div class="dc-quick">
      <section class="dc-quick-card">
        <header>${mark(CLAUDE_PATH, 'Claude').replace('class="dc-mark"', 'class="dc-mark dc-claude"')}<strong>Claude Code</strong></header>
        <p class="dc-label">Install the skill</p>
        ${cmd(`mkdir -p ~/.claude/skills/react-native-dissolve && curl -fsSL ${url} -o ~/.claude/skills/react-native-dissolve/SKILL.md`)}
        <p class="dc-label">Add the MCP server</p>
        ${cmd(`claude mcp add dissolve -- node ${SERVER}`)}
      </section>
      <section class="dc-quick-card">
        <header>${mark(OPENAI_PATH, 'OpenAI')}<strong>Codex</strong></header>
        <p class="dc-label">Add the instructions to AGENTS.md</p>
        ${cmd(`curl -fsSL ${url} >> AGENTS.md`)}
        <p class="dc-label">Add the MCP server</p>
        ${cmd(`codex mcp add dissolve -- node ${SERVER}`)}
      </section>
    </div>

    <h2 class="section-title">Other ways</h2>
    <div class="dc-ways">
      ${card('dc-prompt', ICONS.prompt, 'Paste a prompt', 'One message, any agent.')}
      ${card('dc-skill', ICONS.skill, 'Claude skill', 'Loaded when it is relevant.')}
      ${card('dc-mcp', ICONS.mcp, 'MCP server', 'Docs as tools, on demand.')}
    </div>

    ${step(1, 'Paste a prompt', 'dc-prompt')}
    <p class="dc-text">Works with Claude Code, Codex, Cursor or any chat. It installs the package, wraps the root layout and picks the right variant for each interaction.</p>
    <div class="prompt">
      <div class="prompt-head"><span>Tell your coding agent</span><button class="icon-btn" aria-label="Copy prompt" data-copy>${copyIcon}</button></div>
      <div class="prompt-body"><pre class="dc-prompt">${esc(PROMPT)}</pre></div>
    </div>

    ${step(2, 'Claude skill', 'dc-skill')}
    <p class="dc-text">An Agent Skill is a <code>SKILL.md</code> file Claude loads on its own whenever you ask for a dissolve effect. It holds the setup, the API of every hook, a variant picking table and the best practices.</p>
    <div class="dc-file">
      <span class="dc-file-icon">${ICONS.skill}</span>
      <div class="dc-file-meta"><span class="dc-file-name">SKILL.md</span><span class="dc-file-path">react-native-dissolve</span></div>
      <a class="btn btn-sm" href="${SKILL_PATH}" target="_blank" rel="noopener">${ICONS.open}View</a>
      <a class="btn btn-sm btn-accent" href="${SKILL_PATH}" download="SKILL.md">${ICONS.download}Download</a>
    </div>
    <p class="dc-label">For all your projects</p>
    ${cmd(`mkdir -p ~/.claude/skills/react-native-dissolve && curl -fsSL ${url} -o ~/.claude/skills/react-native-dissolve/SKILL.md`)}
    <p class="dc-label">For this project only, shared with your team</p>
    ${cmd(`mkdir -p .claude/skills/react-native-dissolve && curl -fsSL ${url} -o .claude/skills/react-native-dissolve/SKILL.md`)}
    <p class="dc-note">Restart Claude Code, then ask for an effect, for example "dissolve the row when I delete a task". With other agents, paste the file into <code>AGENTS.md</code> or a Cursor rule.</p>

    ${step(3, 'MCP server', 'dc-mcp')}
    <p class="dc-text">A tiny MCP server with no dependencies. It runs with Node over stdio and answers with the same data as the docs. It ships in the repo under <code>mcp/server.mjs</code>: clone it from <a class="dc-link" href="${GITHUB}" target="_blank" rel="noopener">GitHub</a> and point your agent at the file.</p>
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead><tr><th>Tool</th><th>Returns</th></tr></thead>
        <tbody>${MCP_TOOLS.map(([t, d]) => `<tr><td><code>${t}</code></td><td>${d}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="dc-label">Claude Code</p>
    ${cmd(`claude mcp add dissolve -- node ${SERVER}`)}
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
