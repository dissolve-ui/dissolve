// The repo as a Claude Code plugin marketplace: .claude-plugin/marketplace.json lists one plugin,
// plugins/dissolve, whose manifest, MCP server and skill must agree with the rest of the repo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync, read, readJSON, registryIndex, ROOT } from './helpers.mjs';

const MARKET = join(ROOT, '.claude-plugin', 'marketplace.json');
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

describe('Claude Code plugin', () => {
  const market = readJSON(MARKET);
  const entry = market.plugins.find((p) => p.name === 'dissolve');
  const dir = join(ROOT, entry?.source ?? '');

  test('marketplace has a name, an owner and the dissolve plugin at a relative path', () => {
    assert.match(market.name, NAME_RE);
    assert.ok(market.owner?.name);
    assert.ok(market.description);
    assert.ok(entry, 'dissolve entry');
    assert.match(entry.source, /^\.\/[^.]/);
    assert.ok(!entry.source.includes('..'));
    assert.ok(existsSync(dir), `${entry.source} exists`);
  });

  test('plugin.json name matches the marketplace entry', () => {
    const manifest = readJSON(join(dir, '.claude-plugin', 'plugin.json'));
    assert.equal(manifest.name, entry.name);
    assert.match(manifest.name, NAME_RE);
    assert.ok(manifest.description);
  });

  test('.mcp.json runs the published MCP server package', () => {
    const { mcpServers } = readJSON(join(dir, '.mcp.json'));
    const pkg = readJSON(join(ROOT, 'packages', 'dissolve-ui-mcp', 'package.json'));
    const server = mcpServers.dissolve;
    assert.ok(server, 'server named dissolve, as in its serverInfo');
    assert.equal(server.command, 'npx');
    assert.deepEqual(server.args, ['-y', pkg.name]);
    assert.ok(pkg.bin[pkg.name], 'the package has a bin of its own name for npx');
  });

  test('the skill has frontmatter and names only real MCP tools', () => {
    const skill = read(join(dir, 'skills', 'dissolve', 'SKILL.md'));
    const fm = skill.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, 'frontmatter');
    assert.match(fm[1], /^name: dissolve$/m);
    assert.match(fm[1], /^description: .{40,}/m);
    const tools = [...read(join(ROOT, 'mcp', 'server.mjs')).matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map((m) => m[1]);
    for (const t of ['list_variants', 'get_variant', 'get_setup']) {
      assert.ok(tools.includes(t), `server has ${t}`);
      assert.ok(skill.includes(`\`${t}\``), `skill mentions ${t}`);
    }
    for (const m of skill.matchAll(/`([a-z]+_[a-z_]+)`/g)) assert.ok(tools.includes(m[1]), `${m[1]} is a tool of the MCP server`);
  });

  test('the skill lists every component of the registry', () => {
    const skill = read(join(dir, 'skills', 'dissolve', 'SKILL.md'));
    const missing = registryIndex().filter((c) => !skill.includes(`| \`${c.name}\` |`)).map((c) => c.name);
    assert.deepEqual(missing, [], 'add these to the table in plugins/dissolve/skills/dissolve/SKILL.md');
  });

  test('the README shows the install commands', () => {
    const readme = read(join(ROOT, 'README.md'));
    assert.ok(readme.includes(`/plugin marketplace add dissolve-ui/dissolve`));
    assert.ok(readme.includes(`/plugin install ${entry.name}@${market.name}`));
  });
});
