#!/bin/sh
# Raw Lux3D GLB (5-6 MB) -> public/models (about 1 MB): WebP textures at 1024 px, geometry left as generated.
set -e
cd "$(dirname "$0")/.."
for f in "$@"; do
  n=$(basename "$f" .glb)
  gltf-transform optimize "$f" "public/models/$n.glb" --compress false --texture-compress webp --texture-size 1024 >/dev/null
  echo "$n $(du -k "public/models/$n.glb" | cut -f1) KB"
done
