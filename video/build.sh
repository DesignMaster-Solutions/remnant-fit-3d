#!/bin/sh
# Builds the HyperFrames project for the gameplay film: the real game page plus video/director.js.
# Usage: video/build.sh <seconds>. Three.js is served from node_modules so the render needs no CDN.
set -e
cd "$(dirname "$0")/.."
D=video/film
rm -rf "$D"
mkdir -p "$D/lib/three/build" "$D/lib/three/examples"
cp -R public/. "$D/"
cp video/director.js "$D/"
cp node_modules/three/build/three.module.js node_modules/three/build/three.core.js "$D/lib/three/build/"
cp -R node_modules/three/examples/jsm "$D/lib/three/examples/"
python3 - "$1" <<'PY'
import sys, re
p = "video/film/index.html"; s = open(p).read()
s = s.replace("https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js", "./lib/three/build/three.module.js")
s = s.replace("https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/", "./lib/three/examples/jsm/")
seed = """<script>window.__FILM = true;
(() => { let a = 20261102; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();</script>
<style>html,body{width:1920px;height:1080px}</style>
</head>"""
s = s.replace("</head>", seed, 1)
s = s.replace("<body>", f'<body>\n<div id="root" data-composition-id="remnant" data-start="0" data-duration="{sys.argv[1]}" data-width="1920" data-height="1080">', 1)
s = s.replace('<script type="module" src="game.js"></script>', '<script type="module" src="game.js"></script>\n<script type="module" src="director.js"></script>\n</div>')
open(p, "w").write(s)
PY
echo "built $D"
