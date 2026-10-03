# Remaining scientific and data gaps

Generated: 2026-10-03T21:39:35+00:00

## Scientific gaps

1. **Genotype granularity in trials** — Anchor SCD trial reports severe sickle cell disease with VOC criteria; mapping every outcome specifically to HbSS requires eligibility/genotype tables beyond PubMed abstracts.
2. **Asset transfer** — JAX Townes is SCD-oriented; no curated positive evidence here that it is an appropriate β-thalassemia model.
3. **Phenotype frequencies** — Discovery OLS text-search annotations lack HPO frequency/onset; they remain unreviewed and out of the default curated view.
4. **Collaborator availability** — Publications and organizations identify *possible* stakeholders only; no contact commitments are inferred.
5. **HbS/β-thalassemia** — Optional extension disease node exists in config but is not fully journey-elaborated.
6. **Direct HBB editing vs BCL11A editing** — Interface must continue to state that exa-cel edits BCL11A enhancer, not HBB.

## Data / engineering gaps

1. Original local Hack Nation folder was not present in this workspace; collector was rebuilt to public-API sources.
2. NIH RePORTER / ClinicalTrials payloads depend on live API availability at collection time.
3. Some organization pages may block or alter content for automated clients; usability flags are recorded.
4. No graph database; JSON files are the source of truth for the local prototype.
5. Credentials intentionally unused; sources requiring keys were deferred.

## What is automated vs manual

| Step | Mode |
|---|---|
| ClinVar / PubMed / ClinicalTrials / RePORTER / OLS fetch | Automated |
| Raw caching + checksums | Automated |
| Discovery graph transform | Automated |
| Anchor claim extraction (PMID 38657265 / 38661449) | Manual review in `curate.py` |
| Organization/model relevance | Semi-automated page usability + manual relationship framing |
| Default curated UI view | Curated layer only |
