#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/public/data"
cp "$ROOT/research/hbb/output/curated-graph.json" \
   "$ROOT/research/hbb/output/journeys.json" \
   "$ROOT/research/hbb/output/review-log.json" \
   "$ROOT/research/hbb/output/graph.json" \
   "$ROOT/research/hbb/output/gaps.md" \
   "$ROOT/research/hbb/output/quality-report.json" \
   "$ROOT/research/hbb/output/collection-summary.md" \
   "$ROOT/research/hbb/output/demo-experience.json" \
   "$ROOT/public/data/"
echo "Synced research outputs to public/data"
