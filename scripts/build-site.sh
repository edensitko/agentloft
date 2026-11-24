#!/bin/sh
# Builds the public site: the landing page, and the office itself in demo mode under demo/.
set -eu
OUT="${1:-_site}"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$OUT"; mkdir -p "$OUT/demo/three/build" "$OUT/demo/three/examples"
cp "$ROOT/docs/index.html" "$OUT/"; cp -R "$ROOT/docs/images" "$OUT/images"; cp -R "$ROOT/docs/video" "$OUT/video"; cp -R "$ROOT/docs/lang" "$OUT/lang"
cp -R "$ROOT/public/." "$OUT/demo/"
cp "$ROOT"/node_modules/three/build/three.module.js "$ROOT"/node_modules/three/build/three.core.js "$OUT/demo/three/build/"
cp -R "$ROOT/node_modules/three/examples/jsm" "$OUT/demo/three/examples/jsm"
cp "$ROOT/LICENSE" "$ROOT/THIRD-PARTY-NOTICES.md" "$ROOT/node_modules/three/LICENSE" "$OUT/demo/three/" 2>/dev/null || true
cp "$ROOT/THIRD-PARTY-NOTICES.md" "$OUT/demo/"
