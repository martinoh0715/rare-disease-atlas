# Rare Disease Atlas

Local prototype for an evidence-backed rare-disease knowledge graph. The first curated slice covers **HBB-related hemoglobin disorders**, with one complete patient-group research journey from search → biology → studies/assets → sourced next-step brief.

Focus of the curated demo:
- Sickle cell anemia (**HbSS**) and the **HbS** allele
- **Beta-thalassemia** (genetic categories kept distinct from transfusion dependence / severity)
- Shared **HbF / BCL11A** biology, with interventions, studies, and publications kept as separate node types

This is **not** medical advice. These conditions already have treatments. The prototype does **not** claim a 10× acceleration without measurements.

## Quick start

```bash
npm install
npm run sync-data   # copies research outputs into public/data
npm run dev         # http://127.0.0.1:43123
```

Optional full refresh (reuses cached `research/hbb/raw/` snapshots by default):

```bash
npm run pipeline
npm run validate
npm run dev
```

## What you get

1. **Curated graph** — `research/hbb/output/curated-graph.json`
2. **Review log** — inclusion/exclusion decisions in `research/hbb/output/review-log.json`
3. **Discovery layer** — broader automated graph in `graph.json` / `nodes.jsonl` / `edges.jsonl`
4. **Local UI** — search, large focused graph, source panel, resources, next-step brief
5. **Demo walkthrough** — `docs/DEMO.md`
6. **Gaps** — `research/hbb/output/gaps.md`

## Research journey (default)

`disease/genotype (HbSS)` → `HbF / BCL11A mechanism` → `exa-cel intervention` → `clinical studies + publications` → `organizations + JAX Townes model` → `validation research question`

Important non-claim: **exagamglogene autotemcel edits the BCL11A erythroid enhancer, not HBB.** Studies and papers are separate nodes linked by sourced relationships.

## Project layout

| Path | Role |
|---|---|
| `research/hbb/` | Collection, curation, validation |
| `research/hbb/config/diseases.json` | Disease-specific configuration |
| `research/hbb/seed.json` | Unchecked earlier sketch (kept separate) |
| `src/` | Next.js local interface |
| `public/data/` | UI-consumed JSON exports |
| `docs/DEMO.md` | Short demo script |

## Automated vs manual

| Step | Mode |
|---|---|
| Public API collection + raw caching | Automated |
| Discovery graph build | Automated |
| Anchor claim extraction / journey framing | Manual review in `curate.py` |
| Default UI view | Curated layer only |

## Notes on the original Hack Nation folder

This cloud workspace started empty. The collector/graph/UI were rebuilt here from the challenge brief and public sources. If you later copy local `raw/` snapshots from another machine, place them under `research/hbb/raw/` — the collector will reuse them and avoid overwriting.
