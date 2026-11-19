#!/bin/sh
# Builds packages/dissolve-ui: the React Native engine (lib, from src/dissolve), the CLI in bin, and
# the whole registry the CLI copies from (React Native components at the root, React in registry/web).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/packages/dissolve-ui"
rm -rf "$PKG/src" "$PKG/lib" "$PKG/registry"
cp -R "$ROOT/src/dissolve" "$PKG/src"
cp "$ROOT/LICENSE" "$PKG/LICENSE"
cp -R "$ROOT/registry" "$PKG/registry"
chmod +x "$PKG/bin/dissolve.mjs"
cd "$ROOT"
npx tsc -p "$PKG/tsconfig.build.json"
echo "built $(find "$PKG/lib" -name '*.js' | wc -l | tr -d ' ') js files"

# TypeScript prints ComponentRef<typeof View> as the RN version it was built against
# ("View"), which is a component function in newer React Native typings. Rewrite those
# refs to the version agnostic form so the hooks type check on every RN version.
# sed -i.bak works with both BSD (macOS) and GNU (Linux CI) sed.
find "$PKG/lib" -name '*.d.ts' -exec sed -i.bak \
  -e 's#RefObject<View | null>#RefObject<import("react").ComponentRef<typeof import("react-native").View> | null>#g' {} +
find "$PKG/lib" -name '*.d.ts.bak' -delete
if grep -rq 'RefObject<View | null>' "$PKG/lib"; then echo "unrewritten View refs left" && exit 1; fi
echo "d.ts refs rewritten"

# Package README: the repo README, with imports pointing at the npm name and
# repo-relative links made absolute.
sed -e "s#from '@/dissolve'#from 'dissolve-ui'#g" \
    -e 's#](\([A-Z_]*\.md[^)]*\))#](https://github.com/rs-4/dissolve/blob/main/\1)#g' \
    -e 's#](LICENSE)#](https://github.com/rs-4/dissolve/blob/main/LICENSE)#g' \
    -e 's#](mcp/\([^)]*\))#](https://github.com/rs-4/dissolve/blob/main/mcp/\1)#g' \
    -e 's#](docs/\([^)]*\))#](https://github.com/rs-4/dissolve/blob/main/docs/\1)#g' \
    -e 's#](web/\([^)]*\))#](https://github.com/rs-4/dissolve/blob/main/web/\1)#g' \
    "$ROOT/README.md" > "$PKG/README.md"
echo "built dissolve-ui: $(node -p "require('$ROOT/registry/index.json').components.length") components, $(ls "$PKG/registry/web" | grep -c '\.tsx$') with a web version"
