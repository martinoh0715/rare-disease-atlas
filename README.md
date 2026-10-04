# Rare Disease Atlas

Local prototype for an evidence-backed rare-disease knowledge graph. Curated demonstration datasets:

1. **HBB hemoglobinopathies** — complete path (HbF–BCL11A bridge)  
2. **ARID1B-related disorders** — complete path (CARE4ARID1B + FAR)  
3. **GATA6-related disorders** — partial path (registry/testing assets; dedicated foundation gap explicit)  
4. **ODC1 / Bachmann-Bupp** — complete path for established GoF BABS; LoF/cancer separated  

This is **not** medical advice and does **not** generate treatment recommendations.

## Quick start

```bash
npm install
npm run sync-data
npm run dev         # http://127.0.0.1:43123
```

## Evaluate research opportunity (optional)

The workspace includes **Evaluate research opportunity**: a patient-organization
leader selects a disease and a related study/registry/publication/model, then
receives a sourced AI assessment of relevance, potential reuse, differences,
unknowns, and a next step — plus an editable **Prepare collaboration brief**
export. Assessments are **AI-generated — not reviewed**, are not written into
curated graph JSON, and do **not** create dotted edges.

Secure local setup:

1. Copy `.env.example` to `.env.local` (gitignored).
2. Set `OPENAI_API_KEY` in `.env.local` only — never commit it, never put it in
   `NEXT_PUBLIC_*` variables, and never paste it into chat.
3. Optionally set `OPENAI_MODEL` (default `gpt-4o-2024-08-06`).
4. Optionally set `ATLAS_DISABLE_EVALUATION=true` to disable live calls.
5. Restart `npm run dev`.

If the key is missing, the UI shows an honest unavailable state and does **not**
fabricate assessments. Cache: `.cache/ai-evaluations/` (gitignored).

```bash
npm run test:evaluation   # fixture-labeled evaluation tests
```

Validate all curated slices:

```bash
npm run validate
npm run validate:arid1b
npm run validate:gata6
npm run validate:odc1
npm run regression
```

Rebuild extension datasets:

```bash
npm run graph:all
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
