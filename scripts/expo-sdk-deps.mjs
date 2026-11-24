#!/usr/bin/env node
/**
 * Prints the `name@version` list that moves this repo to another Expo SDK, the versions
 * `npx expo install --fix` would pick: expo itself, every dependency of package.json that the SDK
 * bundles (react, react-native, Skia, Reanimated, worklets, Gesture Handler, expo-*...), and the
 * @types/react of the SDK's default template.
 *
 *   npm install --no-save $(node scripts/expo-sdk-deps.mjs 58)
 *
 * CI uses it to typecheck the engine and the registry against each supported SDK. The expo tarball
 * (bundledNativeModules.json) is read in a temp dir; nothing in the repo changes.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sdk = Number(process.argv[2]);
if (!Number.isInteger(sdk)) {
  console.error('usage: node scripts/expo-sdk-deps.mjs <sdk>   (for example 58)');
  process.exit(1);
}

const npm = (...args) => execFileSync('npm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const view = (spec, field) => {
  const out = npm('view', spec, field, '--json').trim();
  return out ? JSON.parse(out) : undefined;
};

const versions = [view(`expo@~${sdk}.0.0`, 'version')].flat().filter(Boolean);
const expo = versions.at(-1);
if (!expo) {
  console.error(`no expo release for SDK ${sdk}`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), `expo-sdk-${sdk}-`));
let bundled;
try {
  const file = JSON.parse(npm('pack', `expo@${expo}`, '--json', '--pack-destination', tmp))[0].filename;
  execFileSync('tar', ['xzf', join(tmp, file), '-C', tmp, 'package/bundledNativeModules.json']);
  bundled = JSON.parse(readFileSync(join(tmp, 'package', 'bundledNativeModules.json'), 'utf8'));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ours = { ...pkg.dependencies, ...pkg.devDependencies };
const out = [`expo@${expo}`];
for (const name of Object.keys(ours)) if (bundled[name]) out.push(`${name}@${bundled[name]}`);

// Types are not in bundledNativeModules: take them from the SDK's default template.
const types = view(`expo-template-default@sdk-${sdk}`, 'devDependencies')?.['@types/react'];
if (types) for (const name of ['@types/react', '@types/react-dom']) if (ours[name]) out.push(`${name}@${types}`);

console.log(out.join(' '));
