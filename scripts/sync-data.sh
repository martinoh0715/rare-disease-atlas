#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sync_dataset() {
  local id="$1"
  local src="$ROOT/research/$id/output"
  local dest="$ROOT/public/data/$id"
  mkdir -p "$dest"
  for f in curated-graph.json journeys.json review-log.json graph.json \
           gaps.md quality-report.json collection-summary.md demo-experience.json; do
    if [[ -f "$src/$f" ]]; then
      cp "$src/$f" "$dest/$f"
    fi
  done
  echo "Synced $id -> public/data/$id"
}

sync_dataset hbb
sync_dataset arid1b
sync_dataset gata6
sync_dataset odc1

python3 - <<PY
import json
from pathlib import Path
root = Path(r"$ROOT")
# Fill journey_status on older demos if missing
for ds, status, note in [
    ("hbb", "complete", "Full research-to-action path with studies, orgs, assets, and proposal defaults."),
    ("arid1b", "complete", "Full path with CARE4ARID1B, FAR, and endpoint-readiness question."),
]:
    p = root / "research" / ds / "output" / "demo-experience.json"
    if not p.exists():
        continue
    data = json.loads(p.read_text())
    data.setdefault("journey_status", status)
    data.setdefault("journey_status_note", note)
    p.write_text(json.dumps(data, indent=2) + "\n")
    dest = root / "public" / "data" / ds / "demo-experience.json"
    if dest.parent.exists():
        dest.write_text(json.dumps(data, indent=2) + "\n")

catalog = {
  "product_name": "Rare Disease Atlas",
  "product_one_liner": "Search a rare disease and follow sourced connections to related biology, communities, and research assets.",
  "default_dataset_id": "hbb",
  "datasets": [
    {
      "id": "hbb",
      "label": "HBB hemoglobinopathies",
      "path": "hbb",
      "focus_gene": "HBB",
      "default_focus_id": "disease:hbss",
      "journey_status": "complete",
      "description": "Sickle cell / β-thalassemia demonstration with HbF–BCL11A research bridge."
    },
    {
      "id": "arid1b",
      "label": "ARID1B-related disorders",
      "path": "arid1b",
      "focus_gene": "ARID1B",
      "default_focus_id": "disease:arid1b_rd",
      "journey_status": "complete",
      "description": "ARID1B-RD / CSS1 spectrum with haploinsufficiency biology, CARE4ARID1B, and FAR."
    },
    {
      "id": "gata6",
      "label": "GATA6-related disorders",
      "path": "gata6",
      "focus_gene": "GATA6",
      "default_focus_id": "disease:gata6_spectrum",
      "journey_status": "partial",
      "description": "GATA6 spectrum with haploinsufficiency biology and registry assets; dedicated foundation gap explicit."
    },
    {
      "id": "odc1",
      "label": "ODC1 / Bachmann-Bupp syndrome",
      "path": "odc1",
      "focus_gene": "ODC1",
      "default_focus_id": "disease:babs",
      "journey_status": "complete",
      "description": "BABS gain-of-function path with investigational DFMO/ICPD; LoF and cancer contexts separated."
    }
  ]
}
(root / "public" / "data" / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n")
print("Wrote public/data/catalog.json")
PY
