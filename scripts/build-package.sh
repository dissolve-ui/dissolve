#!/bin/sh
# Builds packages/react-native-dissolve from the library source in src/dissolve.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/packages/react-native-dissolve"
rm -rf "$PKG/src" "$PKG/lib" "$PKG/mcp" "$PKG/registry"
cp -R "$ROOT/src/dissolve" "$PKG/src"
cp "$ROOT/LICENSE" "$PKG/LICENSE"
cp -R "$ROOT/registry" "$PKG/registry"
cd "$ROOT"
npx tsc -p "$PKG/tsconfig.build.json"
echo "built $(find "$PKG/lib" -name '*.js' | wc -l | tr -d ' ') js files"

# TypeScript prints ComponentRef<typeof View> as the RN version it was built against
# ("View"), which is a component function in newer React Native typings. Rewrite those
# refs to the version agnostic form so the hooks type check on every RN version.
find "$PKG/lib" -name '*.d.ts' -exec sed -i '' \
  -e 's#RefObject<View | null>#RefObject<import("react").ComponentRef<typeof import("react-native").View> | null>#g' {} +
if grep -rq 'RefObject<View | null>' "$PKG/lib"; then echo "unrewritten View refs left" && exit 1; fi
echo "d.ts refs rewritten"

# Package README: the repo README, with imports pointing at the npm name and
# repo-relative links made absolute.
sed -e "s#from '@/dissolve'#from 'react-native-dissolve'#g" \
    -e 's#](CHANGELOG.md)#](https://github.com/rs-4/dissolve/blob/main/CHANGELOG.md)#g' \
    -e 's#](LICENSE)#](https://github.com/rs-4/dissolve/blob/main/LICENSE)#g' \
    -e 's#](mcp/\([^)]*\))#](https://github.com/rs-4/dissolve/blob/main/mcp/\1)#g' \
    -e 's#](docs/\([^)]*\))#](https://github.com/rs-4/dissolve/blob/main/docs/\1)#g' \
    "$ROOT/README.md" > "$PKG/README.md"
echo "readme copied"
