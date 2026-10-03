/**
 * Fixture-labeled unit tests for AI hypothesis validation + evidence bundling.
 * These fixtures are for automated tests only — never shown as live results.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { relationshipStatusOf, type GraphData, type GraphEdge } from "../src/lib/graph";
import { buildEvidenceBundle } from "../src/lib/hypothesis/evidenceBundle";
import type {
  EvidenceBundle,
  ModelHypothesisResponse,
} from "../src/lib/hypothesis/types";
import { validateModelResponse } from "../src/lib/hypothesis/validate";

const fixturePath = path.join(
  process.cwd(),
  "src/lib/hypothesis/fixtures/sample-bundle.json"
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as EvidenceBundle & {
  _label: string;
};

assert.match(fixture._label, /FIXTURE ONLY/i);

const graph: GraphData = {
  generated_at: "fixture",
  layer: "curated",
  nodes: fixture.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
  })),
  edges: [
    {
      id: "edge:fixture:hbf:scd",
      source: "mechanism:hbf_reactivation",
      target: "disease:scd_hbst",
      type: "mechanism_relevant_to_disease",
      relationship_status: "established",
      evidence: {
        source_url: "https://pubmed.ncbi.nlm.nih.gov/38661449/",
        supporting_passage:
          "BCL11A enhancer editing raises fetal hemoglobin in sickle cell disease clinical studies; this describes SCD-specific protocol context.",
      },
    },
    {
      id: "edge:fixture:hbf:thal",
      source: "mechanism:hbf_reactivation",
      target: "disease:beta_thal_genetic",
      type: "mechanism_relevant_to_disease",
      relationship_status: "established",
      evidence: {
        source_url: "https://pubmed.ncbi.nlm.nih.gov/38657265/",
        supporting_passage:
          "Transfusion-dependent beta-thalassemia gene therapy publications also discuss fetal hemoglobin induction via related editing strategies.",
        contradictory_evidence:
          "Model systems and genotype inclusion criteria differ across SCD and TDT programs.",
      },
    },
    {
      id: "edge:missing-status",
      source: "disease:scd_hbst",
      target: "asset:jax_townes",
      type: "associated_with",
      // intentionally missing relationship_status
      evidence: {
        supporting_passage:
          "Public pages associate the Townes strain catalog entry with sickle-cell research use cases in general terms.",
        source_url: "https://www.jax.org/strain/013071",
      },
    } as GraphEdge,
  ],
};

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

// 1) Missing status ⇒ unreviewed
{
  const edge = graph.edges.find((e) => e.id === "edge:missing-status")!;
  assert.equal(relationshipStatusOf(edge), "unreviewed");
  section("missing relationship_status means unreviewed");
}

// 2) Evidence bundle from HBB-like graph
{
  const bundle = buildEvidenceBundle({
    datasetId: "hbb",
    graph,
    selectedNodeId: "mechanism:hbf_reactivation",
    researchQuestion: "cross-community question",
  });
  assert.equal(bundle.insufficient, false);
  assert.ok(bundle.evidence.length >= 2);
  assert.ok(bundle.evidence.every((e) => e.evidence_id.startsWith("ev:")));
  section("evidence bundle retrieves passages without inventing URLs");
}

// 3) Valid proposal accepted
{
  const raw: ModelHypothesisResponse = {
    evidence_limitations_explanation: "",
    hypotheses: [
      {
        hypothesis_id: "ai:hyp:fixture:1",
        source_node_id: "mechanism:hbf_reactivation",
        target_node_id: "asset:jax_townes",
        proposed_relationship_type: "proposed_experiment",
        title: "Validate whether Townes answers an HbF cross-disease question",
        plain_language_summary:
          "Shared HbF discussion across SCD and TDT motivates asking whether an SCD mouse asset is even in scope — as a hypothesis to test, not a fact.",
        established_premises: [
          {
            claim:
              "BCL11A enhancer editing raises fetal hemoglobin in sickle cell disease clinical studies",
            evidence_ids: ["ev:edge:fixture:hbf:scd"],
          },
          {
            claim:
              "Townes mouse models sickle-cell pathophysiology on public strain pages",
            evidence_ids: ["ev:edge:fixture:townes"],
          },
        ],
        scientific_rationale:
          "Premises show HbF is discussed in SCD contexts and Townes is an SCD-oriented asset; a validation experiment is needed before any cross-disease reuse claim.",
        relevant_differences: [
          "SCD pathophysiology models are not automatically suitable for beta-thalassemia questions.",
        ],
        counterevidence: [
          "Model systems and genotype inclusion criteria differ across SCD and TDT programs.",
        ],
        missing_evidence: [
          "No sourced experiment demonstrating Townes utility for a specific TDT endpoint.",
        ],
        validation_question:
          "Does the proposed HbF question require an SCD model, a beta-thalassemia model, or a human-cell system?",
        proposed_next_step:
          "List genotype-aware endpoints and ask whether Townes is in scope before any protocol adaptation.",
        generation_status: "proposed",
      },
    ],
  };
  const { accepted, held } = validateModelResponse(raw, fixture, graph);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].origin, "ai_generated");
  assert.equal(accepted[0].review_status, "not_reviewed");
  assert.equal(accepted[0].relationship_status, "hypothesis");
  assert.equal(held.length, 0);
  section("valid sourced proposal accepted with AI provenance fields");
}

// 4) Fabricated evidence id rejected
{
  const raw: ModelHypothesisResponse = {
    evidence_limitations_explanation: "",
    hypotheses: [
      {
        hypothesis_id: "ai:hyp:bad:ev",
        source_node_id: "mechanism:hbf_reactivation",
        target_node_id: "asset:jax_townes",
        proposed_relationship_type: "proposed_experiment",
        title: "Bad evidence",
        plain_language_summary: "Uses a fabricated evidence id.",
        established_premises: [
          {
            claim: "Invented claim",
            evidence_ids: ["ev:not-in-bundle"],
          },
        ],
        scientific_rationale: "Should be rejected.",
        relevant_differences: ["n/a"],
        counterevidence: [],
        missing_evidence: [],
        validation_question: "n/a",
        proposed_next_step: "n/a",
        generation_status: "proposed",
      },
    ],
  };
  const { accepted, held } = validateModelResponse(raw, fixture, graph);
  assert.equal(accepted.length, 0);
  assert.equal(held.length, 1);
  assert.ok(
    held[0].validation.issues.some((i) => i.code === "fabricated_evidence")
  );
  section("fabricated evidence IDs rejected");
}

// 5) Unknown node rejected
{
  const raw: ModelHypothesisResponse = {
    evidence_limitations_explanation: "",
    hypotheses: [
      {
        hypothesis_id: "ai:hyp:bad:node",
        source_node_id: "mechanism:hbf_reactivation",
        target_node_id: "disease:invented",
        proposed_relationship_type: "proposed_shared_mechanism",
        title: "Invented node",
        plain_language_summary: "Targets a missing node.",
        established_premises: [
          {
            claim:
              "BCL11A enhancer editing raises fetal hemoglobin in sickle cell disease clinical studies",
            evidence_ids: ["ev:edge:fixture:hbf:scd"],
          },
        ],
        scientific_rationale: "Should be rejected.",
        relevant_differences: [],
        counterevidence: [],
        missing_evidence: [],
        validation_question: "n/a",
        proposed_next_step: "n/a",
        generation_status: "proposed",
      },
    ],
  };
  const { accepted, held } = validateModelResponse(raw, fixture, graph);
  assert.equal(accepted.length, 0);
  assert.ok(held[0].validation.issues.some((i) => i.code === "unknown_target"));
  section("unknown node IDs rejected");
}

// 6) Duplicate established relationship rejected
{
  const raw: ModelHypothesisResponse = {
    evidence_limitations_explanation: "",
    hypotheses: [
      {
        hypothesis_id: "ai:hyp:dup",
        source_node_id: "mechanism:hbf_reactivation",
        target_node_id: "disease:scd_hbst",
        proposed_relationship_type: "mechanism_relevant_to_disease",
        title: "Restate established",
        plain_language_summary: "Should not count as discovery.",
        established_premises: [
          {
            claim:
              "BCL11A enhancer editing raises fetal hemoglobin in sickle cell disease clinical studies",
            evidence_ids: ["ev:edge:fixture:hbf:scd"],
          },
        ],
        scientific_rationale: "Duplicate.",
        relevant_differences: [],
        counterevidence: [],
        missing_evidence: [],
        validation_question: "n/a",
        proposed_next_step: "n/a",
        generation_status: "proposed",
      },
    ],
  };
  // allowed list will reject type first; also test established pair with allowed type
  const raw2: ModelHypothesisResponse = {
    evidence_limitations_explanation: "",
    hypotheses: [
      {
        ...raw.hypotheses[0],
        proposed_relationship_type: "proposed_shared_mechanism",
        hypothesis_id: "ai:hyp:dup2",
      },
    ],
  };
  const badType = validateModelResponse(raw, fixture, graph);
  assert.ok(
    badType.held[0].validation.issues.some((i) => i.code === "bad_type")
  );
  const dup = validateModelResponse(raw2, fixture, graph);
  // held due to existing_pair (undirected established link)
  assert.equal(dup.accepted.length, 0);
  assert.ok(
    dup.held[0].validation.issues.some(
      (i) => i.code === "existing_pair" || i.code === "duplicate_established"
    )
  );
  section("restating established links held/rejected");
}

// 7) Insufficient bundle
{
  const emptyGraph: GraphData = {
    generated_at: "fixture",
    layer: "curated",
    nodes: [
      { id: "disease:scd_hbst", type: "disease", label: "SCD" },
      { id: "gene:hbb", type: "gene", label: "HBB" },
    ],
    edges: [
      {
        id: "edge:title-only",
        source: "disease:scd_hbst",
        target: "gene:hbb",
        type: "gene_associated_with_disease",
        relationship_status: "established",
        evidence: {
          supporting_passage: "HBB",
          source_url: "https://example.com",
        },
      },
    ],
  };
  const bundle = buildEvidenceBundle({
    datasetId: "hbb",
    graph: emptyGraph,
    selectedNodeId: "disease:scd_hbst",
  });
  assert.equal(bundle.insufficient, true);
  section("insufficient evidence (title/keyword stubs) yields no invention path");
}

console.log("\nAll hypothesis validation tests passed.\n");
