// Snapshot of the repo's star history for the site (web/gh-stars.json): the GitHub API only lists
// stargazers with their dates to authenticated callers, so the page cannot fetch them itself.
// Runs with the gh CLI when it is logged in; otherwise the existing snapshot stays as is.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'gh-stars.json');
try {
  const raw = execFileSync('gh', ['api', '--paginate', '-H', 'Accept: application/vnd.github.star+json', 'repos/rs-4/dissolve/stargazers?per_page=100', '--jq', '.[].starred_at'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const at = raw.split('\n').filter(Boolean).map((s) => Date.parse(s)).filter(Number.isFinite).sort((a, b) => a - b);
  writeFileSync(OUT, JSON.stringify({ t: Date.now(), at }) + '\n');
  console.log(`star history: ${at.length} stars in web/gh-stars.json`);
} catch {
  console.log('star history: gh unavailable, web/gh-stars.json left as is');
}
