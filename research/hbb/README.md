# HBB hemoglobinopathy evidence graph

Evidence-backed knowledge graph slice for Hack-Nation’s rare-disease challenge, focused on:

- Sickle cell anemia (**HbSS**)
- **Beta-thalassemia** (genetic subtypes vs transfusion-dependence / severity labels)
- Optional later: HbS/β-thalassemia

HBB is the starting gene, not a hard boundary. Related genes/processes (for example BCL11A / fetal hemoglobin regulation) are included only with sourced edges.

## Important scientific constraints

- These conditions already have treatments. Do not describe them as untreated.
- Do not invent therapeutic discoveries or claim “10× faster” without measurements.
- **exa-cel edits BCL11A’s erythroid enhancer, not HBB.**
- Broad sickle cell disease ≠ HbSS; trait ≠ disease; genetic β-thalassemia ≠ transfusion dependence.

## Layout

| Path | Purpose |
|---|---|
| `config/diseases.json` | Disease-specific configuration (extensibility) |
| `collect.py` | Public-data collector (no API keys) |
| `build_graph.py` | Discovery graph transform |
| `curate.py` | Curated graph, journey, review log |
| `raw/` | Cached original source responses (not overwritten by default) |
| `output/` | Records, graphs, exports, gaps |
| `seed.json` | Earlier manual sketch; kept separate until claims are checked |
| `manifest.json` | Source file checksums / timestamps |

## Collect (public sources)

```bash
python3 research/hbb/collect.py
python3 research/hbb/build_graph.py
python3 research/hbb/curate.py
```

Re-running `collect.py` **reuses** existing `raw/` snapshots unless you change the script to force refresh.

## Output artifacts

- `output/records.json` — normalized collected records
- `output/graph.json` / `nodes.jsonl` / `edges.jsonl` — discovery layer
- `output/curated-graph.json` — default UI graph
- `output/review-log.json` — inclusion/exclusion decisions
- `output/journeys.json` — patient-group leader research journey
- `output/gaps.md` — scientific and data gaps
- `output/collection-summary.md` / `quality-report.json` — collection QA

## Extending to another disease

1. Add disease entries in `config/diseases.json`.
2. Extend collector queries (keep raw caching).
3. Add curated claims in `curate.py` with full evidence objects.
4. Optionally add a journey in `output/journeys.json` (via curate).

Do not scatter disease-specific logic through the Next.js UI; read graph JSON instead.
