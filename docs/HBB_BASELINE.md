# HBB baseline (preserve)

Recorded before the multi-dataset extension so regressions can detect breakage.

## Supported searches (11 curated entries)

| Entry ID | Label | Example queries |
|---|---|---|
| `disease:hbss` | Sickle cell anemia (HbSS) | sickle cell anemia, HbSS |
| `disease:scd_broad` | Sickle cell disease (broad) | sickle cell disease, SCD |
| `disease:sct` | Sickle cell trait | sickle cell trait, HbAS |
| `disease:beta_thal_genetic` | Beta-thalassemia (genetic) | beta-thalassemia |
| `disease:tdt` | Transfusion-dependent β-thalassemia | TDT |
| `disease:beta_thal_major` | Beta-thalassemia major | thalassemia major |
| `gene:HBB` | HBB | HBB, beta globin |
| `gene:BCL11A` | BCL11A | BCL11A |
| `allele:HbS` | HbS (βS) | c.20A>T, HbS |
| `allele:HbC` | HbC (βC) | c.19G>A, HbC |
| `mechanism:hbf_reactivation` | Fetal hemoglobin (HbF) reactivation | HbF, fetal hemoglobin |

## Demonstration path

1. **Understand** — HbSS → HbS/HBB → HbF/BCL11A → exa-cel → publications → TDT bridge hypothesis  
2. **Explore** — studies NCT03745287 / NCT03655678, SCDAA, CAF, JAX Townes (with reuse caveats)  
3. **Prepare** — validation research question + sourced proposal brief  

## Curated graph size (pre-extension)

- 32 nodes / 48 edges in `curated-graph.json`
- Default focus: `disease:hbss`
- Default proposal partners/assets: `org:caf`, `nct:NCT03655678`, `asset:jax_townes`

## Non-claims that must remain

- exa-cel edits BCL11A enhancer, **not** HBB
- HbSS ≠ broad SCD ≠ trait
- Genetic β-thalassemia ≠ transfusion-dependence labels
- Animal model ≠ human evidence
- No automatic treatment recommendations
