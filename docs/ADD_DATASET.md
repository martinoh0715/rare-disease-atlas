# How to add a third curated dataset

This guide assumes the HBB, ARID1B, GATA6, and ODC1 slices already work. Goal: prove generalization, not maximize node count. Prefer copying `research/gata6/` or `research/odc1/` (shared helpers in `research/_shared/curate_lib.py`).

## 1. Create a research folder

```bash
mkdir -p research/<id>/{config,output,raw}
```

Copy patterns from `research/arid1b/`:

- `config/diseases.json` — seed genes, disease IDs, synonyms intent, inclusion/exclusion, representative variants, inheritance notes
- `curate.py` — builds curated graph + demo experience + review log
- `validate.py` — dataset-specific integrity checks
- `README.md` — scope and non-claims

Do **not** assume HBB recessive homozygous genotypes or ARID1B de novo heterozygous patterns. Encode inheritance/genotype context explicitly.

## 2. Curate a small journey

Minimum useful path:

`disease → relevant biology → research evidence → organization/asset → specific research question`

Rules:

- Every displayed scientific edge needs `evidence.source_url` and a supporting passage or structured-field reference.
- Keep predicted molecular consequence, experimental functional effect, and disease mechanism as separate concepts.
- Keep disease subtypes distinct when names overlap.
- Reject unsupported treatment claims; mark unresolved items in `review-log.json`.
- Do not invent cross-dataset edges to HBB/ARID1B unless a source supports them.
- Keep unreviewed search hits in the discovery layer only.

## 3. Evidence-review log

`output/review-log.json` must include accepted, rejected, and unresolved claims, with `expert_reviewed: false` unless a human expert actually reviewed them.

## 4. Wire into the catalog

1. Run `python3 research/<id>/curate.py && python3 research/<id>/validate.py`
2. Add a `sync_dataset <id>` call in `scripts/sync-data.sh`
3. Add an entry to the catalog JSON written by that script (`public/data/catalog.json`)
4. Extend `scripts/regression_check.py` with required searches/nodes for `<id>`
5. Run `bash scripts/sync-data.sh && python3 scripts/regression_check.py`

The UI loads every catalog dataset automatically (`src/app/page.tsx`). Search merges all `search_entries`. Selecting a hit switches dataset context and clears incompatible proposal selections.

## 5. Demo experience fields the UI expects

In `demo-experience.json`:

- `dataset_id`, `dataset_label`
- `default_focus_id`, `default_partner_id`, `default_asset_ids`
- `search_entries`, `example_searches`
- `stages` (`understand` / `explore` / `prepare`) with node/edge IDs present in the curated graph
- `asset_assessments`, `registry_gap`, `proposal_defaults`
- Optional: `landing_disclaimer`, unsupported-search templates

## 6. Verify locally

```bash
npm run sync-data
npm run validate          # HBB validator
python3 research/<id>/validate.py
python3 scripts/regression_check.py
npm run dev               # http://127.0.0.1:43123
```

Manual checks:

1. Search finds both old and new terms.
2. Graph/evidence panels render for the new disease.
3. Resources/partners match the selected dataset.
4. Proposal export cites the selected dataset’s evidence.
5. Previous datasets still work unchanged.
