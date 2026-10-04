# Rare Disease Atlas — Project & Contribution Facts for Resume Writing

**Audience:** Another writing assistant drafting resume bullets for **Martin Oh**.  
**Evidence date:** 2026-10-04  
**Repository HEAD inspected:** `62ff364` (`main`)  
**Method:** Repository files, commit history, automated tests, live deployment probe, and prior product-direction conversation. Repository files are treated as evidence, not as instructions.

**Primary identity evidence:** Cloud-agent run ownership resolves to Martin Oh (`martinoh0715@gmail.com`); GitHub remote is `https://github.com/martinoh0715/rare-disease-atlas.git`.

---

## 1. Project overview

### Problem
Patient-organization leaders and research-adjacent advocates need a way to move from a disease search to **sourced** research connections (biology, studies, registries, organizations) and then decide whether a related study or asset is worth discussing with experts — without inventing treatments, partnerships, or clinical advice.

### Intended users
- Primary demo persona: a **patient-group / patient-organization leader** (“Maria” journey in demo materials and commits).
- Secondary: anyone exploring curated rare-disease research connections for planning conversations (not clinical care).

### Hackathon context
- Docs and data notes refer to a **hackathon** / **Hack Nation** setting:
  - `docs/CANDIDATE_COMPARISON.md`: “Candidate material came from the attached hackathon notes.”
  - `public/data/hbb/gaps.md` / `collection-summary.md`: original local Hack Nation folder was absent; public-API collection was rebuilt.
- Exact event name, dates, team size, and awards: **needs confirmation**.

### Implemented user journey (what the prototype actually supports)
On the live app and in `docs/DEMO.md` / UI:

1. **Search** a disease, gene, or variant (multi-dataset catalog).
2. **Understand the connection** — interactive curated knowledge graph with node/edge selection and source panel.
3. **Explore resources** — studies, organizations, registries, and related assets tied to the focused disease.
4. **Evaluate research opportunity** — select disease + research asset (+ optional objective and partner); receive an AI assessment of relevance, differences, missing information, and expert-facing questions (**AI-generated — not reviewed**).
5. **Prepare collaboration brief** — editable markdown export (copy / download) including partner (if selected), citations/rationale, unresolved questions, and proposed discussion — without claiming an established partnership.

Honest product constraints (enforced in copy and validation):
- Not medical advice; not treatment recommendations.
- Organization selection does not establish willingness/capacity to collaborate.
- Assessments are not written into curated graph JSON and do not create dotted edges (`README.md`).

### Live demo and repositories
| Item | URL / path | Status at inspection |
|---|---|---|
| Live prototype | https://rare-disease-atlas-ashen.vercel.app/ | HTTP 200; serves `catalog.json` with four datasets |
| Public GitHub | https://github.com/martinoh0715/rare-disease-atlas | Remote present; `main` pushed through `62ff364` |
| Local / Origin remote | Origin-backed cloud git remote also present | Internal cloud remote; treat GitHub as public citation unless told otherwise |
| Demo VO MP4 | `maria_demo_vo_playable.mp4` (repo root) | Screen demo synced to narration (product demo artifact) |

---

## 2. Technical implementation

### Stack and deployment
| Layer | Evidence |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind + shadcn/ui primitives (`package.json`, `components.json`, `src/`) |
| Graph UI | Custom **SVG** force-style layout in `src/components/NetworkCanvas.tsx` (not D3/Cytoscape dependency) |
| Backend | Next.js Route Handlers (Node runtime): `src/app/api/evaluation/assess/route.ts` (+ residual `src/app/api/hypotheses/explore/route.ts`) |
| Data at runtime | Static JSON under `public/data/<dataset>/` (no graph database) |
| AI SDK | Official `openai` npm package (`openai` ^7.27.0) |
| Validation libs | Zod present in deps; evaluation uses a strict JSON Schema for Structured Outputs + custom `validateEvaluation` |
| Local/dev port | `43123` (`npm run dev`) |
| Production | Deployed on **Vercel** (live host confirms `server: Vercel`) |

**Not used (verified by absence in deps/code):** graph database (Neo4j etc.), embeddings, vector search, model training, or fine-tuning. Explicit note in `public/data/hbb/gaps.md`: “No graph database; JSON files are the source of truth.”

### Knowledge-graph structure
**Source of truth:** per-dataset `curated-graph.json` (`nodes[]`, `edges[]`) plus `demo-experience.json`, `journeys.json`, `review-log.json`, quality/gaps docs.

**Entity / node types observed in curated HBB graph** (representative; other datasets use overlapping types):  
`gene`, `protein`, `disease`, `publication`, `mechanism`, `biological_process`, `intervention`, `genotype`, `allele`, `variant`, `phenotype`, `hypothesis`, `organization`, `research_asset`, `clinical_study`, `research_question`.

**Relationships:** typed edges (e.g. `source_reports_association`, `mechanism_relevant_to_disease`, `study_investigates_intervention`, `organization_supports_community`, …).  
**Provenance / status fields** (`src/lib/graph.ts`):
- `relationship_status`: `established` | `hypothesis` | missing ⇒ treated as **unreviewed**
- `evidence` object with `source_url`, `supporting_passage`, dates, limitations, etc.
- UI distinguishes solid vs dashed (hypothesis) edges.

**Traversal for evaluation:** undirected BFS over curated edges in memory (`findConnectingPaths` in `src/lib/evaluation/assets.ts`), default **`EVALUATION_PATH_MAX_HOPS = 5`**, up to 4 paths; prefers fewer hypothesis edges, then shorter paths. Path explanations preserve stored edge direction.

### Data sources: ingested vs considered

#### HBB — actually collected (raw cache under `research/hbb/raw/`, checksummed in `research/hbb/manifest.json`)
Manifest lists **37** raw source files across:
- ClinVar (11)
- HPO / OLS-style phenotype pulls (10)
- PubMed (6)
- NIH RePORTER (4)
- ClinicalTrials.gov (3)
- Organization pages (2)
- Model page (1)

`public/data/hbb/collection-summary.md` discovery counts (raw collection, **not** curated graph size):
| Category | Count |
|---|---|
| Variants (ClinVar) | 75 |
| Phenotype annotations (discovery) | 149 |
| Publications (PubMed) | 42 |
| Clinical studies | 34 |
| Funded projects (NIH RePORTER) | 37 |
| Organizations / model pages | 3 |

Curation then shrinks this into a small demonstration graph (see §5). Anchor publications called out: PMID 38657265, PMID 38661449.

#### Extension datasets (ARID1B, GATA6, ODC1)
- Built primarily via Python curators (`research/<ds>/curate.py`) from curated notes + selected public anchors (ClinVar notes, publications, study/org pages).
- Candidate comparison documented in `docs/CANDIDATE_COMPARISON.md` (hackathon notes → source-checked → ARID1B selected first; GATA6/ODC1 later added as additional slices).
- **Not** a second full HBB-scale multi-API harvest for each gene (needs confirmation if any additional private notes existed outside repo).

#### Explicitly deferred / not claimed
- Sources requiring API keys deferred (`gaps.md`: “Credentials intentionally unused”).
- Private patient data out of scope (`README.md`).
- No invented cross-dataset edges between HBB and ARID1B (`README.md`).

### Supported disease/gene collections
From `public/data/catalog.json` (4 datasets):

| ID | Label | Journey status in catalog |
|---|---|---|
| `hbb` | HBB hemoglobinopathies | **partial** (SCDIC listed; partner willingness unverified) |
| `arid1b` | ARID1B-related disorders | **complete** |
| `gata6` | GATA6-related disorders | **partial** (dedicated foundation gap explicit) |
| `odc1` | ODC1 / Bachmann-Bupp | **complete** (for established GoF BABS; LoF/cancer separated) |

### OpenAI integration (research-opportunity evaluation)
Primary path: `POST /api/evaluation/assess` → `evaluateResearchOpportunity` (`src/lib/evaluation/generate.ts`).

| Concern | Implementation |
|---|---|
| Evidence retrieval | Deterministic package builder `buildEvaluationEvidencePackage` pulls passages/URLs from connecting path edges, asset/disease nodes, and optional `asset_assessments` — **not** vector retrieval |
| Multi-hop traversal | `findConnectingPaths` BFS, max 5 hops |
| Model | Default `gpt-4o-2024-08-06` (`OPENAI_MODEL` override); OpenAI **Responses API** with `text.format.type = json_schema`, `strict: true` |
| Prompt version | `atlas-evaluation-v6` (`EVAL_PROMPT_VERSION`) |
| Citation-reference validation | `validateEvaluation` rejects unknown `evidence_ids`, coerces overconfident reuse when protocol detail missing, strips unqualified quantitative claims, etc. (`src/lib/evaluation/validate.ts`; tested in `scripts/test_evaluation_validate.ts`) |
| Caching | SHA-256 key over dataset/disease/asset/objective/evidence/model/prompt; memory + `.cache/ai-evaluations/` (`src/lib/evaluation/cache.ts`) |
| Uncertainty handling | Conclusion labels include `important_differences_require_review` and `insufficient_evidence_to_assess`; reuse elements may be coerced to `insufficient_information`; UI disclaimers “AI assessment — not reviewed”; missing eligibility/endpoint detail detected heuristically in package builder |
| Rate limiting | 8 requests / IP / minute on assess route |
| Disable / no-key | `ATLAS_DISABLE_EVALUATION` or missing key → honest unavailable/disabled states; **no fabricated assessments** |

**Legacy hypothesis explore:** Added in `881399a`, UI replaced by evaluation in `363f2db`. Hypothesis API modules remain under `src/lib/hypothesis/` and `src/app/api/hypotheses/explore/` (not the primary product surface).

### Research-asset evaluation, registries, partners, brief export
- Candidate assets & partners from graph + `demo.asset_assessments` (`listCandidateAssets`, `listPartnerOrganizations`).
- HBB demo assessments include CLIMB SCD-121, CLIMB THAL-111, JAX Townes, CAF, SCDAA, **SCDIC** registry (`registry:scdic`).
- Partner willingness flagged unknown by default / copy (`willingnessUnknown`).
- Collaboration brief: `formatCollaborationBriefMarkdown` + modal (`CollaborationBriefModal`) with Copy / Download Markdown.

### Testing and production verification
| Check | Command / evidence | Result at inspection |
|---|---|---|
| Evaluation validator suite | `npm run test:evaluation` | **All passed** (10 named cases, including HbSS→CLIMB path retrieval, citation rejection, export) |
| Hypothesis validator suite | `npm run test:hypotheses` | Present; not re-run in this inspection pass (**needs confirmation** if still green after UI replacement) |
| Per-dataset Python validators | `npm run validate` (+ arid1b/gata6/odc1) | Invoked by regression |
| Multi-dataset regression | `npm run regression` | **REGRESSION OK** (HBB/ARID1B/GATA6/ODC1 search/graph/evidence/resources/proposal; requires `registry:scdic` on HBB) |
| Production | Live Vercel URL + catalog JSON | Reachable; four datasets served |

---

## 3. Contributions (ownership-aware)

**Important:** Nearly all git commits are authored as `Cursor Agent <cursoragent@cursor.com>`. That means **AI coding tools performed the implementation under direction**; it does **not** prove Martin hand-wrote every line. Do not claim sole manual authorship of the codebase from commit emails alone.

### A. Decisions and work explicitly attributable to Martin Oh
Evidence: product owner of the cloud agent / GitHub account; conversation history directing scope; repo naming and public GitHub under `martinoh0715`.

Strong, evidence-backed attributions (product / project leadership):
1. **Problem framing around a patient-organization leader journey** (“Maria”) — commits `fb59515`, `2fc0f27`, demo docs/VO work.
2. **Scope control for a hackathon prototype:** curated multi-gene atlas + honest gaps rather than an unbounded biomedical KG.
3. **Product decision to replace open-ended AI hypothesis exploration with grounded research-opportunity evaluation** — commit `363f2db` (“Replace AI hypothesis explore with research-opportunity evaluation”) after `881399a`.
4. **Direction to raise evaluation rigor** (specificity, missing protocol detail, no premature reuse language) — commits `726df30`, `7f764b8`, `28c3809`, prompt `atlas-evaluation-v6`.
5. **Maria E2E acceptance direction:** path retrieval for HbSS↔CLIMB THAL-111, partner selection, SCDIC registry honesty, collaboration brief — commit `2fc0f27`.
6. **Publishing / demo readiness:** public GitHub remote, Vercel deployment URL used for demos, screen-recorded VO demo artifact (`62ff364`).
7. **UI product choices:** remove numbered journey steps; keep independent Explore / Understand views (`051f881`, `1c7c191`).

### B. Implementation performed with AI coding tools under Martin’s direction
All substantive application commits on `main` (agent author). Includes:
- Next.js atlas UI, SVG graph, multi-dataset search.
- Python collect/curate/validate pipelines and sync scripts.
- OpenAI evaluation pipeline (package → structured output → validate → cache → brief).
- Test suites and regression harness.
- Dataset extensions ARID1B → GATA6/ODC1.
- Demo video export.

Safe resume phrasing pattern: *“Directed / designed / specified … implemented with AI-assisted development”* rather than *“personally coded every module.”*

### C. Teammate contributions
- **Andrew Fuentes — clinical-research expertise** (per Martin’s instruction for this report).  
  Do **not** invent additional engineering, product, or data-pipeline responsibilities for Andrew without confirmation.
- Any other teammates, mentors, or judges: **needs confirmation**.

### D. Ownership that needs Martin’s confirmation before resume claims
- Exact role title during the hackathon (solo builder vs team lead vs PM+builder).
- Which scientific curation judgments were Martin’s vs Andrew’s vs AI-suggested then accepted.
- Whether Martin personally ran public-API collection vs delegated fully to agents.
- Official hackathon name, placement, and whether “Hack Nation” is the preferred public name.
- Whether Vercel project / domain ownership is solely Martin’s.
- Whether residual hypothesis API should be described as deprecated internal code or still a feature.

---

## 4. Significant technical challenges

### 4.1 Transition from hypothesis generation to research-opportunity evaluation
- **Original problem:** Open-ended “AI hypothesis explore” risked speculative edges and weak actionability for a patient-org leader.
- **Solution:** Replaced UI panel with **Evaluate research opportunity** grounded in a retrieved evidence package; assessments are not written into curated graph JSON (`363f2db`, `README.md`).
- **Verification:** Evaluation test suite; demo script updated (`docs/DEMO.md`); production UI exposes Evaluate + brief, not hypothesis explore.
- **Remaining limitation:** Hypothesis API code still exists in repo; residual risk of confusion if described carelessly. Live assessments remain **not expert-reviewed**.

### 4.2 Graph-path retrieval for cross-disease study evaluation (HbSS → CLIMB THAL-111)
- **Original problem:** Visual graph proximity ≠ path; early hop budget too small → zero connecting paths for Maria’s cross-community study case (conversation + fix in `2fc0f27` / `EVALUATION_PATH_MAX_HOPS = 5` comment: covers HbF→BCL11A→exa-cel→study bridge).
- **Solution:** Undirected BFS with hop budget 5, path ranking that deprioritizes hypothesis edges, human-readable `explainConnectingPath`, package marks missing protocol detail.
- **Verification:** `npm run test:evaluation` cases *“HbSS→CLIMB THAL-111 retrieves a curated path…”* and *“HbSS→CLIMB package keeps 29/30 passage…”*; regression requires `registry:scdic` and CAF-related journey nodes.
- **Remaining limitation:** Paths can include unreviewed/hypothesis steps that must be labeled; thin ClinicalTrials text still yields “important differences / insufficient information” conclusions (by design).

### 4.3 Preventing overconfident AI reuse claims
- **Original problem:** Models assert reusable eligibility/endpoints from thin registry text or efficacy results.
- **Solution:** Prompt rules + post-validation coercion (`insufficient_information`), quantitative qualifier checks, rejection of invalid evidence IDs (`validate.ts`, commits `726df30`–`28c3809`).
- **Verification:** Fixture tests for lost qualifiers, generic reuse coercion, invalid citations, “without-modification” next-step rejection.
- **Remaining limitation:** Heuristic detection of protocol detail is imperfect; cache can serve prior assessments quickly (still validated outputs, not curator-written graph facts).

### 4.4 Multi-dataset integrity without a merged mega-graph
- **Original problem:** Extending beyond HBB without inventing cross-gene links or breaking HBB baseline searches.
- **Solution:** Separate curated JSON slices + `catalog.json`; regression forbids unexpected cross-gene contamination; candidate comparison doc for selection rationale.
- **Verification:** `npm run regression` OK across four datasets; HBB baseline searches preserved (`docs/HBB_BASELINE.md`, regression required queries).
- **Remaining limitation:** Journey completeness differs by collection (partial vs complete); GATA6 foundation gap remains explicit.

### 4.5 Provenance-honest UX under demo time pressure
- **Original problem:** Easy to overclaim partnerships, registries, or “complete” paths.
- **Solution:** Relationship status model; dashed hypothesis edges; catalog `journey_status`; SCDIC via BioLINCC-style asset; willingness-unknown partner copy; AI disclaimers.
- **Verification:** Regression on journey_status + required nodes; live demo VO exercised Maria path on production.
- **Remaining limitation:** Some organization/page automation is brittle; collaborator availability never inferred as confirmed.

---

## 5. Verified scope and results

### Product scope (what shipped)
- Deployed web prototype with search → curated graph → explore → AI evaluation → collaboration brief.
- Four gene-centered curated collections.
- Automated validation/regression plus evaluation unit tests.
- Public GitHub repository + Vercel deployment + demo video artifact.

### Curated graph sizes (count definition)
**Counted object:** nodes/edges arrays inside each `public/data/<dataset>/curated-graph.json` (UI-consumed curated layer).  
**Not counted as one graph:** summing across datasets does **not** mean a merged knowledge graph; collections are separate.

| Dataset | Nodes | Edges | Notes |
|---|---:|---:|---|
| HBB | **33** | **51** | File counts at HEAD; embedded `stats` still says 32/48 (stale field — do not prefer over array lengths) |
| ARID1B | 22 | 29 | |
| GATA6 | 23 | 25 | |
| ODC1 | 23 | 28 | |
| **Sum (separate collections)** | **101** | **133** | Useful only as “total curated objects across slices” |

HBB edges with some provenance-related field present: **36 / 51** (presence of `source_url` / `sources` / `evidence` / `provenance` keys — not a claim that all are expert-reviewed).

### Raw HBB collection vs curated (avoid double-counting)
- Raw discovery counts (75 variants, 42 pubs, etc.) describe **collector cache**, not UI graph size.
- Curated demonstration graph is intentionally small (~33 nodes).
- Do not add raw + curated counts.

### Tests (reproducible)
- Evaluation suite: **10** passing cases via `npm run test:evaluation` (inspection run).
- Regression: **PASS** via `npm run regression` (inspection run).
- Hypothesis suite exists (`scripts/test_hypothesis_validate.ts`); latest green status **needs confirmation** if cited.

### Real-world impact (do **not** claim without evidence)
| Claim type | Status |
|---|---|
| Deployed prototype | **Supported** |
| Users / adoption metrics | **No evidence** |
| Clinical validation / improved outcomes | **No evidence** (explicitly out of scope) |
| “10× faster research” or similar | **No evidence** |
| Awards / prizes | **Needs confirmation** |
| Real partnerships formed via the tool | **No evidence** (tool states willingness unknown) |

---

## 6. Resume-relevant evidence (strongest accomplishments)

Use these as the factual backbone for 5–8 bullets. Prefer “designed/directed + shipped” language.

1. **Shipped an evidence-grounded rare-disease research atlas for patient-org decision support**  
   Why it matters: end-to-end product, not a slideware KG.  
   Evidence: live Vercel app; `README.md`; commits `fb59515` → `2fc0f27`.

2. **Designed a multi-hop, provenance-aware evaluation workflow (package → structured LLM output → citation validation → brief)**  
   Why it matters: shows AI systems judgment, not just “called GPT.”  
   Evidence: `src/lib/evaluation/*`, `src/app/api/evaluation/assess/route.ts`, `EVAL_PROMPT_VERSION = atlas-evaluation-v6`, commit `363f2db`.

3. **Replaced speculative hypothesis generation with research-opportunity assessment that cannot invent graph edges**  
   Why it matters: safety/product integrity under AI hype.  
   Evidence: `363f2db` removing `HypothesisExplorePanel.tsx`; README non-mutation statement.

4. **Fixed and tested cross-disease path retrieval so HbSS leaders can assess β-thalassemia study designs (CLIMB THAL-111) with explicit missing-protocol honesty**  
   Why it matters: concrete technical + scientific product challenge.  
   Evidence: `EVALUATION_PATH_MAX_HOPS = 5` in `assets.ts`; tests in `scripts/test_evaluation_validate.ts`; commit `2fc0f27`.

5. **Scaled curated coverage from one hemoglobinopathy slice to four gene-centered collections with regression gates**  
   Why it matters: data productization + quality control.  
   Evidence: `catalog.json`; `scripts/regression_check.py` REGRESSION OK; commits `e649410`, `26e878c`.

6. **Encoded scientific non-claims into product behavior** (HbSS ≠ broad SCD; exa-cel edits BCL11A not HBB; animal ≠ human; no partnership inference)  
   Why it matters: domain-responsible AI/product work.  
   Evidence: `docs/HBB_BASELINE.md`, gaps docs, validation coercion rules, UI disclaimers.

7. **Built public reproducibility surface** (GitHub repo, validators, demo script, playable demo video)  
   Why it matters: hire-signal for ownership and communication.  
   Evidence: GitHub remote; `docs/DEMO.md`; `maria_demo_vo_playable.mp4` (`62ff364`).

8. **Integrated patient-registry and partner-selection honesty into the collaboration brief export**  
   Why it matters: bridges research assets to actionable next conversations without overclaiming.  
   Evidence: `registry:scdic` in demo/regression; `listPartnerOrganizations`; `formatCollaborationBriefMarkdown` in `validate.ts`; ResearchOpportunityPanel brief UI.

---

## 7. Suggested bullet angles (facts only — wording for the other assistant)

These are **not** final resume lines; they are constrained claims the writing assistant may polish:

- Directed design and delivery of a Vercel-deployed Next.js rare-disease knowledge atlas that lets patient-organization leaders search curated graphs and export a collaboration brief.
- Specified an OpenAI structured-output evaluation pipeline that retrieves multi-hop curated evidence, validates citation IDs, caches results, and refuses assessments when evidence is insufficient.
- Led the product pivot from open-ended AI hypothesis generation to grounded research-opportunity evaluation that does not write unverified edges into the knowledge graph.
- Extended the atlas from HBB into ARID1B, GATA6, and ODC1 curated collections with automated regression checks for search, evidence, and journey integrity.
- Collaborated with clinical-research expertise (Andrew Fuentes) while driving product scope, AI workflow design, implementation direction (AI-assisted), testing, deployment, and demo preparation. **(Confirm collaboration wording with Martin.)**

---

## 8. File / commit index for important claims

| Claim | Pointer |
|---|---|
| Product overview / runbook | `README.md` |
| Demo script | `docs/DEMO.md` |
| Dataset catalog | `public/data/catalog.json` |
| HBB baseline non-claims | `docs/HBB_BASELINE.md` |
| Extension selection rationale | `docs/CANDIDATE_COMPARISON.md` |
| No graph DB | `public/data/hbb/gaps.md` |
| Path hop budget = 5 | `src/lib/evaluation/assets.ts` |
| OpenAI structured eval | `src/lib/evaluation/generate.ts` |
| Citation validation | `src/lib/evaluation/validate.ts` |
| Eval API + rate limit | `src/app/api/evaluation/assess/route.ts` |
| Prompt version v6 | `src/lib/evaluation/types.ts` |
| Eval tests | `scripts/test_evaluation_validate.ts` |
| Regression | `scripts/regression_check.py` |
| Hypothesis → evaluation pivot | commit `363f2db` |
| Maria journey completion | commit `2fc0f27` |
| Initial Maria journey delivery | commit `fb59515` |
| ARID1B / GATA6+ODC1 extensions | commits `e649410`, `26e878c` |
| Live host | https://rare-disease-atlas-ashen.vercel.app/ |
| Public repo | https://github.com/martinoh0715/rare-disease-atlas |

---

## 9. Explicit “do not claim” list for the writing assistant

- Do not claim embeddings, RAG-over-vectors, graph DBs, or fine-tuning.
- Do not claim clinical validation, patient outcomes, or production clinical use.
- Do not claim partnerships formed, org willingness confirmed, or treatment efficacy.
- Do not claim Martin manually authored every line; commits are agent-authored under his direction.
- Do not invent awards, user counts, or “10×” productivity metrics.
- Do not expand Andrew Fuentes’s role beyond clinical-research expertise without confirmation.
- Distinguish **raw collection counts** from **curated graph counts**; never sum them as one inventory.

---

*End of evidence report. Uncertain items are marked **needs confirmation**.*
