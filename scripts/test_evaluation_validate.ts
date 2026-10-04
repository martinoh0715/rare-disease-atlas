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
  research_objective: "Assess whether study methods could be adapted",
  evidence_version: "fixture-eval-v1",
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
      source_url: "https://clinicaltrials.gov/study/NCT03745287",
      supporting_passage:
        "CLIMB SCD-121 enrolls participants with sickle cell disease genotypes including HbSS and evaluates gene-editing outcomes in a defined protocol.",
      is_curator_summary: false,
    },
    {
      evidence_id: "ev:assessment:nct:NCT03745287",
      kind: "asset_record",
      source_url: "https://clinicaltrials.gov/study/NCT03745287",
      supporting_passage:
        "Access note: Public registry page only. Eligibility and outcomes are protocol-specific; willingness to collaborate is not established.",
      is_curator_summary: true,
    },
  ],
  missing_information: [
    "Access permission, licensing, or collaboration willingness is not established in the stored records.",
  ],
  insufficient: false,
};

// 1) Supported assessment with valid citations
{
  const model: ModelEvaluation = {
    assessment_id: "eval:fixture:1",
    conclusion_label: "important_differences_require_review",
    opportunity_summary:
      "CLIMB SCD-121 is relevant to HbSS communities as a documented SCD gene-editing study design, but eligibility and access limits require review before reuse.",
    why_relevant: {
      documented_findings: [
        {
          claim:
            "CLIMB SCD-121 enrolls participants with sickle cell disease genotypes including HbSS",
          evidence_ids: ["ev:edge:fixture:path:passage"],
        },
      ],
      ai_interpretation:
        "The public protocol is disease-aligned with HbSS, so methods may inform planning discussions without implying transferability.",
      proposed_opportunity:
        "Review which outcome measures or eligibility patterns could inform a community natural-history or methods discussion.",
    },
    reuse_elements: [
      {
        element: "Eligibility criteria",
        assessment: "needs_adaptation",
        rationale:
          "The trial’s genotype inclusion is SCD-specific and may not map to another community’s question without redesign.",
        important_differences: [
          "Gene-editing interventional eligibility differs from observational natural-history needs.",
        ],
        evidence_ids: ["ev:edge:fixture:path:passage"],
        must_verify_before_proceeding:
          "Confirm whether the community question needs interventional or observational eligibility language.",
      },
    ],
    unknown_questions: [
      {
        unknown: "Whether any methods materials beyond the public registry page are shareable",
        why_it_matters: "Public existence does not establish access to full protocols or datasets",
        resolvable_by: "ClinicalTrials.gov record contacts / study sponsor public desk (role, not a named person invented here)",
      },
    ],
    recommended_next_step: {
      milestone: "Complete a feasibility review of public CLIMB SCD-121 fields against the community question",
      actions: [
        {
          action: "Extract public eligibility and outcome fields into a comparison table",
          role_or_organization: "Patient-organization research lead with a clinical methods advisor",
          information_needed: "Community research objective and genotype scope",
          decision_enabled: "Whether to pursue methods adaptation or a different asset",
        },
      ],
    },
    potential_time_savings:
      "Reusing publicly described outcome definitions might avoid drafting those fields from scratch; acceleration has not been quantified.",
    evidence_limitations_explanation: "",
  };
  const v = validateEvaluation(model, fixturePkg);
  assert.equal(v.validation.accepted, true);
  assert.equal(v.origin, "ai_generated");
  assert.equal(v.review_status, "not_reviewed");
  section("supported assessment with valid citations accepted");
}

// 2) Insufficient evidence package from thin graph slice
{
  const thin: GraphData = {
    generated_at: "t",
    layer: "curated",
    nodes: [
      { id: "disease:hbss", type: "disease", label: "HbSS" },
      { id: "nct:NCT03745287", type: "clinical_study", label: "Study" },
    ],
    edges: [],
  };
  const pkg = buildEvaluationEvidencePackage({
    datasetId: "hbb",
    graph: thin,
    diseaseNodeId: "disease:hbss",
    assetNodeId: "nct:NCT03745287",
  });
  assert.equal(pkg.insufficient, true);
  assert.ok(pkg.missing_information.length >= 1);
  section("insufficient evidence yields missing-information questions");
}

// 3) Invalid evidence references rejected
{
  const model: ModelEvaluation = {
    assessment_id: "eval:bad",
    conclusion_label: "potential_reuse_worth_investigating",
    opportunity_summary: "Bad",
    why_relevant: {
      documented_findings: [
        { claim: "Invented", evidence_ids: ["ev:not-real"] },
      ],
      ai_interpretation: "x",
      proposed_opportunity: "y",
    },
    reuse_elements: [],
    unknown_questions: [],
    recommended_next_step: {
      milestone: "m",
      actions: [
        {
          action: "a",
          role_or_organization: "r",
          information_needed: "i",
          decision_enabled: "d",
        },
      ],
    },
    potential_time_savings: "Acceleration has not been quantified.",
    evidence_limitations_explanation: "",
  };
  const v = validateEvaluation(model, fixturePkg);
  assert.equal(v.validation.accepted, false);
  assert.ok(
    v.validation.issues.some((i) => i.code === "fabricated_evidence")
  );
  section("invalid evidence references rejected");
}

// 4) Differences prevent positive-only conclusion path in fixture reuse element
{
  const model: ModelEvaluation = {
    assessment_id: "eval:diff",
    conclusion_label: "evidence_argues_against_proposed_reuse",
    opportunity_summary:
      "Public access notes argue against treating the registry page as a reusable private protocol.",
    why_relevant: {
      documented_findings: [
        {
          claim:
            "Access note: Public registry page only. Eligibility and outcomes are protocol-specific; willingness to collaborate is not established.",
          evidence_ids: ["ev:assessment:nct:NCT03745287"],
        },
      ],
      ai_interpretation: "Existence ≠ access.",
      proposed_opportunity: "Treat as public methods reconnaissance only.",
    },
    reuse_elements: [
      {
        element: "Full protocol package",
        assessment: "evidence_argues_against_reuse",
        rationale: "Only a public registry page is documented in the package.",
        important_differences: ["No verified access to internal protocol materials"],
        evidence_ids: ["ev:assessment:nct:NCT03745287"],
        must_verify_before_proceeding: "Do not assume sponsor materials are available.",
      },
    ],
    unknown_questions: [
      {
        unknown: "Whether any redacted methods summary can be requested",
        why_it_matters: "Changes whether reuse is even discussable",
        resolvable_by: "Study public contact role on ClinicalTrials.gov",
      },
    ],
    recommended_next_step: {
      milestone: "Decide to limit work to public-fields review",
      actions: [
        {
          action: "Document public-only constraint in the brief",
          role_or_organization: "Patient-organization research lead",
          information_needed: "Community objective",
          decision_enabled: "Stop or continue public-methods review",
        },
      ],
    },
    potential_time_savings: "Acceleration has not been quantified.",
    evidence_limitations_explanation: "",
  };
  const v = validateEvaluation(model, fixturePkg);
  assert.equal(v.validation.accepted, true);
  assert.equal(v.conclusion_label, "evidence_argues_against_proposed_reuse");
  section("important differences / against-reuse conclusion accepted");
}

// 5) Public asset existence without verified access remains in missing info
{
  const pkg = buildEvaluationEvidencePackage({
    datasetId: "hbb",
    graph: hbbGraph,
    diseaseNodeId: "disease:hbss",
    assetNodeId: "nct:NCT03745287",
    assetAssessments: hbbDemo.asset_assessments,
  });
  assert.ok(pkg.evidence.length > 0);
  assert.ok(
    pkg.missing_information.some((m) => /access|collaborat/i.test(m)) ||
      pkg.asset.access_info
  );
  section("public asset package preserves access caveats");
}

// 6) Candidate assets listed; gene is not silently a disease
{
  const assets = listCandidateAssets(
    hbbGraph,
    "disease:hbss",
    hbbDemo.asset_assessments
  );
  assert.ok(assets.length >= 1);
  const bad = buildEvaluationEvidencePackage({
    datasetId: "hbb",
    graph: hbbGraph,
    diseaseNodeId: "gene:HBB",
    assetNodeId: "nct:NCT03745287",
    assetAssessments: hbbDemo.asset_assessments,
  });
  assert.equal(bad.insufficient, true);
  section("disease required; assets offered from graph");
}

// 7) Missing relationship_status remains unreviewed
{
  const edge = {
    id: "e",
    source: "a",
    target: "b",
    type: "x",
  };
  assert.equal(relationshipStatusOf(edge), "unreviewed");
  section("missing relationship_status is unreviewed");
}

// 8) Export preserves citations and unreviewed status
{
  const model: ModelEvaluation = {
    assessment_id: "eval:export",
    conclusion_label: "important_differences_require_review",
    opportunity_summary: "Summary",
    why_relevant: {
      documented_findings: [
        {
          claim: "CLIMB SCD-121 enrolls participants with sickle cell disease genotypes including HbSS",
          evidence_ids: ["ev:edge:fixture:path:passage"],
        },
      ],
      ai_interpretation: "Interpretation",
      proposed_opportunity: "Opportunity",
    },
    reuse_elements: [],
    unknown_questions: [
      {
        unknown: "Access pathway",
        why_it_matters: "Blocks reuse",
        resolvable_by: "Public study contact role",
      },
    ],
    recommended_next_step: {
      milestone: "Feasibility check",
      actions: [
        {
          action: "Review public fields",
          role_or_organization: "Research lead",
          information_needed: "Objective",
          decision_enabled: "Go/no-go",
        },
      ],
    },
    potential_time_savings: "Acceleration has not been quantified.",
    evidence_limitations_explanation: "",
  };
  const v = validateEvaluation(model, fixturePkg);
  const brief = buildCollaborationBrief(v, fixturePkg, "2026-10-04T00:00:00Z");
  const md = formatCollaborationBriefMarkdown(brief);
  assert.match(md, /not reviewed/i);
  assert.match(md, /ev:edge:fixture:path:passage/);
  assert.match(md, /clinicaltrials\.gov/i);
  section("export preserves citations and unreviewed status");
}

// 9) Evaluation does not mutate curated datasets
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
