/**
 * Fixture-labeled tests for research-opportunity evaluation.
 * FIXTURE ONLY — never present as live user-facing results.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { listCandidateAssets } from "../src/lib/evaluation/assets";
import { buildEvaluationEvidencePackage } from "../src/lib/evaluation/evidencePackage";
import type {
  EvaluationEvidencePackage,
  ModelEvaluation,
} from "../src/lib/evaluation/types";
import {
  buildCollaborationBrief,
  formatCollaborationBriefMarkdown,
  lostQuantitativeQualifierIssues,
  validateEvaluation,
} from "../src/lib/evaluation/validate";
import { relationshipStatusOf, type GraphData } from "../src/lib/graph";

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

const hbbGraph = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public/data/hbb/curated-graph.json"),
    "utf8"
  )
) as GraphData;
const hbbDemo = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public/data/hbb/demo-experience.json"),
    "utf8"
  )
);

const fixturePkg: EvaluationEvidencePackage = {
  dataset_id: "hbb",
  disease_node_id: "disease:hbss",
  asset_node_id: "nct:NCT03745287",
  research_objective: "Plan a natural-history study",
  evidence_version: "fixture-eval-v2",
  disease: {
    id: "disease:hbss",
    label: "Sickle cell anemia (HbSS)",
    type: "disease",
    genotype_scope: "HbSS",
  },
  asset: {
    id: "nct:NCT03745287",
    label: "CLIMB SCD-121",
    type: "clinical_study",
    access_info: "Public ClinicalTrials.gov record; participation not claimed",
    source_url: "https://clinicaltrials.gov/study/NCT03745287",
  },
  connecting_paths: [
    [
      {
        edge_id: "edge:fixture:path",
        source: "disease:hbss",
        target: "nct:NCT03745287",
        type: "studied_in",
        relationship_status: "established",
      },
    ],
  ],
  related_context_nodes: [],
  evidence: [
    {
      evidence_id: "ev:edge:fixture:path:passage",
      kind: "source_passage",
      edge_id: "edge:fixture:path",
      source_url: "https://pubmed.ncbi.nlm.nih.gov/38661449/",
      display_title: "Exagamglogene Autotemcel for Severe Sickle Cell Disease",
      display_identifier: "PMID:38661449",
      supporting_passage:
        "Of 30 patients with sufficient follow-up, 29 (97%) were free from vaso-occlusive crises for at least 12 consecutive months.",
      is_curator_summary: false,
    },
    {
      evidence_id: "ev:assessment:nct:NCT03745287",
      kind: "asset_record",
      source_url: "https://clinicaltrials.gov/study/NCT03745287",
      display_title: "CLIMB SCD-121 study design (NCT03745287)",
      display_identifier: "NCT03745287",
      supporting_passage:
        "Access note: Public registry page only. Eligibility and outcomes are protocol-specific; willingness to collaborate is not established. Mentions VOC eligibility criteria without defining inclusion thresholds.",
      is_curator_summary: true,
    },
  ],
  missing_information: [
    "Specific eligibility criteria text is not present in the stored evidence package—only high-level mentions.",
    "Access permission, licensing, or collaboration willingness is not established in the stored records.",
  ],
  insufficient: false,
};

function baseModel(over: Partial<ModelEvaluation> = {}): ModelEvaluation {
  return {
    assessment_id: "eval:fixture",
    conclusion_label: "important_differences_require_review",
    opportunity_summary:
      "CLIMB SCD-121 is relevant as a severe-SCD interventional study linked to HbSS communities, but stored evidence lacks specific eligibility/endpoint definitions for reuse into a natural-history plan.",
    top_summary_limitations: [
      "Specific eligibility criteria text is not present in the stored evidence package—only high-level mentions.",
    ],
    why_relevant: {
      documented_findings: [
        {
          claim:
            "Of 30 patients with sufficient follow-up, 29 (97%) were free from vaso-occlusive crises for at least 12 consecutive months.",
          evidence_ids: ["ev:edge:fixture:path:passage"],
        },
      ],
      ai_interpretation:
        "Efficacy results are background only; they do not establish transferable protocol elements for a natural-history design.",
      proposed_opportunity:
        "Use the public registry/publication link to inventory which documents are still missing before any methods adaptation discussion.",
    },
    reuse_elements: [
      {
        element: "VOC-free duration outcome wording from publication results",
        documented_detail:
          "Details not present in supplied evidence for a protocol-level endpoint specification usable in natural history",
        supporting_passage_excerpt:
          "Of 30 patients with sufficient follow-up, 29 (97%) were free from vaso-occlusive crises for at least 12 consecutive months.",
        relevance_to_objective:
          "Natural-history planning needs observational outcome definitions; this excerpt is an interventional efficacy result, not a reusable protocol schedule.",
        assessment: "insufficient_information",
        rationale:
          "The package quotes an efficacy result, not a transferable natural-history measurement protocol.",
        important_differences: [
          "Interventional follow-up after gene editing differs from untreated natural-history observation.",
        ],
        evidence_ids: ["ev:edge:fixture:path:passage"],
        must_verify_before_proceeding:
          "Obtain the public ClinicalTrials.gov outcome measure definitions before judging reuse.",
      },
    ],
    study_design_comparison: {
      purpose_differences:
        "CLIMB SCD-121 is an interventional gene-editing efficacy study; the objective is natural-history planning.",
      participant_selection_differences:
        "Publication/registry framing is severe SCD with recurrent VOCs; exact inclusion thresholds are not in the stored package.",
      treatment_exposure_differences:
        "Participants receive edited autologous cells after myeloablative conditioning; natural-history cohorts typically have no such exposure.",
      outcome_interpretation_differences:
        "Freedom from VOCs after therapy is not the same as untreated disease-course measurement.",
      missing_information: [
        "Full inclusion/exclusion criteria text",
        "Primary/secondary endpoint schedule definitions from the registry record",
      ],
    },
    unknown_questions: [
      {
        unknown: "Exact public registry eligibility and outcome measure text",
        why_it_matters: "Without it, reuse cannot be assessed element-by-element",
        resolvable_by:
          "ClinicalTrials.gov study record fields and a study-methods reviewer role",
      },
    ],
    recommended_next_step: {
      milestone:
        "Build a missing-document checklist and a methods-reviewer question list",
      actions: [
        {
          action:
            "Export ClinicalTrials.gov eligibility and outcome-measure fields for NCT03745287 into a comparison table against the natural-history objective",
          role_or_organization: "Study-methods reviewer (biostatistics/clinical research methods)",
          information_needed:
            "Public registry eligibility text, outcome definitions, and the community natural-history objective",
          decision_enabled:
            "Whether any documented measurement is appropriate to adapt, and what changes are required",
        },
      ],
    },
    potential_time_savings:
      "A public-fields checklist may avoid rediscovering registry links; acceleration has not been quantified.",
    evidence_limitations_explanation:
      "Stored evidence lacks detailed protocol eligibility/endpoint specifications.",
    ...over,
  };
}

// 1) Supported assessment with valid citations
{
  const v = validateEvaluation(baseModel(), fixturePkg);
  assert.equal(v.validation.accepted, true);
  assert.equal(v.origin, "ai_generated");
  assert.equal(v.review_status, "not_reviewed");
  assert.ok(v.top_summary_limitations.length >= 1);
  section("supported assessment with valid citations accepted");
}

// 2) Lost quantitative qualifiers detected
{
  const issues = lostQuantitativeQualifierIssues(
    "The study showed that 97% of patients were free from vaso-occlusive crises.",
    "Of 30 patients with sufficient follow-up, 29 (97%) were free from vaso-occlusive crises for at least 12 consecutive months."
  );
  assert.ok(issues.some((i) => i.code === "lost_quantitative_qualifier"));
  const v = validateEvaluation(
    baseModel({
      opportunity_summary:
        "CLIMB SCD-121 showed that 97% of patients were free from vaso-occlusive crises, so endpoints can be reused.",
      why_relevant: {
        documented_findings: [
          {
            claim: "97% of patients were free from vaso-occlusive crises.",
            evidence_ids: ["ev:edge:fixture:path:passage"],
          },
        ],
        ai_interpretation: "x",
        proposed_opportunity: "y",
      },
    }),
    fixturePkg
  );
  assert.ok(
    v.validation.issues.some((i) => i.code === "lost_quantitative_qualifier") ||
      v.validation.issues.some((i) => i.code === "dropped_unqualified_finding")
  );
  assert.equal(v.why_relevant.documented_findings.length, 0);
  assert.ok(
    v.top_summary_limitations.some((l) => /qualifier|denominator|30/i.test(l))
  );
  section("lost quantitative qualifiers flagged and unqualified findings dropped");
}

// 3) Generic reuse recommendation coerced
{
  const v = validateEvaluation(
    baseModel({
      conclusion_label: "potential_reuse_worth_investigating",
      reuse_elements: [
        {
          element: "Eligibility criteria",
          documented_detail: "VOC eligibility criteria",
          supporting_passage_excerpt: "VOC eligibility criteria",
          relevance_to_objective: "Might help natural history",
          assessment: "potentially_reusable",
          rationale: "Asset mentions eligibility criteria.",
          important_differences: [],
          evidence_ids: ["ev:assessment:nct:NCT03745287"],
          must_verify_before_proceeding: "Check details",
        },
      ],
    }),
    fixturePkg
  );
  assert.equal(v.reuse_elements[0].assessment, "insufficient_information");
  assert.notEqual(v.conclusion_label, "potential_reuse_worth_investigating");
  section("generic reuse recommendations coerced away from positive reuse");
}

// 4) Without-modification language rejected
{
  const v = validateEvaluation(
    baseModel({
      recommended_next_step: {
        milestone: "Determine if these elements can be adapted without modification",
        actions: [
          {
            action: "Consult regulatory experts",
            role_or_organization: "regulatory experts",
            information_needed: "n/a",
            decision_enabled: "n/a",
          },
        ],
      },
    }),
    fixturePkg
  );
  assert.equal(v.validation.accepted, false);
  assert.ok(v.validation.issues.some((i) => i.code === "without_modification"));
  assert.ok(
    v.validation.issues.some((i) => i.code === "generic_regulatory")
  );
  assert.ok(
    v.recommended_next_step.actions.every(
      (a) => !/regulatory/i.test(`${a.action} ${a.role_or_organization}`)
    )
  );
  assert.match(
    v.recommended_next_step.actions[0].action,
    /eligibility|outcome|registry|ClinicalTrials/i
  );
  section("without-modification next step rejected");
}

// 5) Invalid evidence references rejected
{
  const v = validateEvaluation(
    baseModel({
      why_relevant: {
        documented_findings: [
          { claim: "Invented", evidence_ids: ["ev:not-real"] },
        ],
        ai_interpretation: "x",
        proposed_opportunity: "y",
      },
    }),
    fixturePkg
  );
  assert.equal(v.validation.accepted, false);
  assert.ok(
    v.validation.issues.some((i) => i.code === "fabricated_evidence")
  );
  section("invalid evidence references rejected");
}

// 6) Real HBB package reports protocol detail gaps
{
  const pkg = buildEvaluationEvidencePackage({
    datasetId: "hbb",
    graph: hbbGraph,
    diseaseNodeId: "disease:hbss",
    assetNodeId: "nct:NCT03745287",
    researchObjective: "Plan a natural-history study",
    assetAssessments: hbbDemo.asset_assessments,
  });
  assert.ok(pkg.evidence.some((e) => e.evidence_id.includes("abstract") || /29 \(97%\)|Of 30 patients/i.test(e.supporting_passage)));
  assert.ok(
    pkg.missing_information.some((m) => /eligibility criteria text/i.test(m))
  );
  assert.ok(pkg.missing_information.some((m) => /endpoint/i.test(m)));
  section("HbSS→CLIMB package keeps 29/30 passage and reports missing protocol details");
}

// 7) Export preserves limitations and citations
{
  const v = validateEvaluation(baseModel(), fixturePkg);
  const brief = buildCollaborationBrief(v, fixturePkg, "2026-10-04T00:00:00Z");
  const md = formatCollaborationBriefMarkdown(brief);
  assert.match(md, /not reviewed/i);
  assert.match(md, /Limitation:/i);
  assert.match(md, /PMID:38661449|38661449/);
  assert.match(md, /eligibility criteria text/i);
  section("export preserves citations and limitations");
}

// 8) Disease required; assets listed; unreviewed status
{
  const assets = listCandidateAssets(
    hbbGraph,
    "disease:hbss",
    hbbDemo.asset_assessments
  );
  assert.ok(assets.length >= 1);
  assert.equal(
    relationshipStatusOf({ id: "e", source: "a", target: "b", type: "x" }),
    "unreviewed"
  );
  section("assets listed; missing relationship_status unreviewed");
}

// 9) No curated mutation
{
  const before = JSON.stringify(hbbGraph.edges[0]);
  buildEvaluationEvidencePackage({
    datasetId: "hbb",
    graph: hbbGraph,
    diseaseNodeId: "disease:hbss",
    assetNodeId: "asset:jax_townes",
    assetAssessments: hbbDemo.asset_assessments,
  });
  assert.equal(JSON.stringify(hbbGraph.edges[0]), before);
  section("no mutations to curated graph objects");
}

console.log("\nAll evaluation validation tests passed.\n");
