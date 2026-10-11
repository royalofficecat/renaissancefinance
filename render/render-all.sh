#!/usr/bin/env bash
# Renders every frame in chunks of 240, each in a fresh browser, skipping frames already on disk.
set -u
cd "$(dirname "$0")/.."
mkdir -p out/frames
TOTAL=1920; CHUNK=240
for ((a=0; a<TOTAL; a+=CHUNK)); do
  b=$((a+CHUNK-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  for attempt in 1 2 3; do
    node render/capture.mjs --frames $a-$b --resume --out out/frames 2>&1 | grep -v "GL Driver\|PCFSoft\|GPOS\|^⚡\|^  scene/dist" && break
    echo "chunk $a-$b failed (attempt $attempt), retrying"
  done
done
echo "ALL FRAMES DONE: $(ls out/frames/*.png | wc -l) files"
