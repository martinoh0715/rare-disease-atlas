# ARID1B curated dataset

Second demonstration slice for Rare Disease Atlas.

## Scope

- Gene-centered ARID1B-related disorder (ARID1B-RD)
- Coffin-Siris syndrome 1 (CSS1) kept distinct from nonsyndromic ARID1B-ID
- Haploinsufficiency / BAF mechanism framing
- Representative ClinVar alleles with transcript context
- CARE4ARID1B natural-history study + FAR organization
- No approved treatment claims; no HBB cross-edges

## Commands

```bash
python3 research/arid1b/curate.py
python3 research/arid1b/validate.py
bash scripts/sync-data.sh
```

## Outputs

Written to `research/arid1b/output/` and synced to `public/data/arid1b/`.

See `docs/CANDIDATE_COMPARISON.md` for why ARID1B was selected over GATA6/ODC1, and `output/review-log.json` for accepted/rejected/unresolved claims.
