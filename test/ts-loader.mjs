// Module hooks so Node (with --experimental-strip-types) can import the engine's .ts files:
// extensionless relative imports resolve to .ts, and the native packages the variant files
// import are replaced by tiny stubs (only what runs on the JS side at import or in prepare).
// Register with: register('./ts-loader.mjs', import.meta.url)
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stub = (src) => `data:text/javascript,${encodeURIComponent(src)}`;

const STUBS = {
  // Skia.Surface is missing on purpose: pixel reads (palette) fail and take their fallback.
  '@shopify/react-native-skia': stub(`
    export const AlphaType = {};
    export const ColorType = {};
    export const Skia = {};
    export const rect = (x, y, width, height) => ({ x, y, width, height });
    export const makeImageFromView = async () => null;
  `),
  'expo-haptics': stub(`
    export const ImpactFeedbackStyle = {};
    export const impactAsync = () => {};
    export const selectionAsync = () => {};
  `),
  'react-native': stub(`
    export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
  `),
};

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  const parent = context.parentURL;
  if (parent?.endsWith('.ts') && specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    for (const ext of ['.ts', '/index.ts']) {
      const url = new URL(specifier + ext, parent);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  return next(specifier, context);
}
