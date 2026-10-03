# Rare Disease Atlas

Local prototype for an evidence-backed rare-disease knowledge graph. Curated demonstration datasets:

1. **HBB hemoglobinopathies** — HbSS / β-thalassemia journey with HbF–BCL11A research bridge  
2. **ARID1B-related disorders** — ARID1B-RD / CSS1 spectrum with haploinsufficiency biology, CARE4ARID1B, and FAR  

This is **not** medical advice and does **not** generate treatment recommendations.

## Quick start

```bash
npm install
npm run sync-data
npm run dev         # http://127.0.0.1:43123
```

Validate both curated slices:

```bash
npm run validate              # HBB
python3 research/arid1b/validate.py
python3 scripts/regression_check.py
```

Rebuild ARID1B curated outputs:

```bash
npm run graph:arid1b
npm run sync-data
```

Optional HBB full refresh (reuses cached `research/hbb/raw/` by default):

```bash
npm run pipeline
```

## What you get

| Deliverable | Location |
|---|---|
| HBB curated graph + review log | `research/hbb/output/` → `public/data/hbb/` |
| ARID1B curated graph + review log | `research/arid1b/output/` → `public/data/arid1b/` |
| Dataset catalog | `public/data/catalog.json` |
| Candidate comparison | `docs/CANDIDATE_COMPARISON.md` |
| HBB baseline record | `docs/HBB_BASELINE.md` |
| Add a third dataset | `docs/ADD_DATASET.md` |
| Demo script | `docs/DEMO.md` |

## Conceptual model (enforced in curation)

- Disease cluster ≠ variant cluster ≠ gene-centered collection  
- Predicted consequence ≠ experimental functional effect ≠ disease mechanism  
- Similar symptoms ≠ shared mechanisms ≠ shared treatments  
- Relationships may branch or be missing; no mandatory linear chain  

## Project layout

| Path | Role |
|---|---|
| `research/hbb/` | Original HBB collect/curate/validate pipeline |
| `research/arid1b/` | ARID1B curated extension |
| `public/data/<dataset>/` | UI-consumed JSON per dataset |
| `src/` | Next.js local interface (multi-dataset search + graph) |
| `scripts/sync-data.sh` | Copies research outputs + writes catalog |
| `scripts/regression_check.py` | Dual-dataset acceptance checks |

## Notes

- Private patient data is out of scope.
- AI-checked / curator-checked material is **not** labeled expert-reviewed.
- HBB and ARID1B remain separate unless a source supports a connection (none invented here).
