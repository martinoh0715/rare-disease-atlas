import type { GraphData } from "@/lib/graph";
import { relationshipStatusOf } from "@/lib/graph";
import {
  ALLOWED_PROPOSED_RELATIONSHIP_TYPES,
  type EvidenceBundle,
  type ModelHypothesis,
  type ModelHypothesisResponse,
  type ValidatedHypothesis,
  type ValidationIssue,
} from "@/lib/hypothesis/types";

const APPROVAL_CLAIM =
  /\b(expert[- ]approved|clinically validated|proven treatment|guaranteed|endorsed by (the )?(fda|ema))\b/i;

function requiredString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function premisesSupportFlags(
  hyp: ModelHypothesis,
  bundle: EvidenceBundle
): string[] {
  const flags: string[] = [];
  const byId = new Map(bundle.evidence.map((e) => [e.evidence_id, e]));
  for (const premise of hyp.established_premises || []) {
    for (const eid of premise.evidence_ids || []) {
      const rec = byId.get(eid);
      if (!rec) continue;
      const passage = (rec.supporting_passage || "").toLowerCase();
      const claimTokens = premise.claim
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 4)
        .slice(0, 8);
      const overlap = claimTokens.filter((t) => passage.includes(t)).length;
      if (claimTokens.length >= 3 && overlap < 1) {
        flags.push(
          `Premise may not be supported by cited passage ${eid}: "${premise.claim.slice(0, 80)}"`
        );
      }
      if (rec.contradictory_evidence) {
        flags.push(
          `Cited evidence ${eid} also records contradictory evidence that must remain visible.`
        );
      }
    }
  }
  return flags;
}

export function validateModelResponse(
  raw: ModelHypothesisResponse,
  bundle: EvidenceBundle,
  graph: GraphData
): { accepted: ValidatedHypothesis[]; held: ValidatedHypothesis[] } {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const evidenceIds = new Set(bundle.evidence.map((e) => e.evidence_id));
  const establishedPairs = new Set(
    graph.edges
      .filter((e) => relationshipStatusOf(e) === "established")
      .map((e) => `${e.source}::${e.target}::${e.type}`)
  );
  const establishedUndirected = new Set(
    graph.edges
      .filter((e) => relationshipStatusOf(e) === "established")
      .flatMap((e) => [
        `${e.source}::${e.target}`,
        `${e.target}::${e.source}`,
      ])
  );

  const accepted: ValidatedHypothesis[] = [];
  const held: ValidatedHypothesis[] = [];
  const seen = new Set<string>();

  for (const hyp of raw.hypotheses || []) {
    const issues: ValidationIssue[] = [];

    if (!requiredString(hyp.hypothesis_id)) {
      issues.push({
        code: "missing_id",
        message: "hypothesis_id is required",
        severity: "reject",
      });
    }
    if (!nodeIds.has(hyp.source_node_id)) {
      issues.push({
        code: "unknown_source",
        message: `Unknown source_node_id: ${hyp.source_node_id}`,
        severity: "reject",
      });
    }
    if (!nodeIds.has(hyp.target_node_id)) {
      issues.push({
        code: "unknown_target",
        message: `Unknown target_node_id: ${hyp.target_node_id}`,
        severity: "reject",
      });
    }
    if (hyp.source_node_id === hyp.target_node_id) {
      issues.push({
        code: "self_loop",
        message: "Source and target must differ",
        severity: "reject",
      });
    }
    if (
      !ALLOWED_PROPOSED_RELATIONSHIP_TYPES.includes(
        hyp.proposed_relationship_type as (typeof ALLOWED_PROPOSED_RELATIONSHIP_TYPES)[number]
      )
    ) {
      issues.push({
        code: "bad_type",
        message: `Relationship type not allowed: ${hyp.proposed_relationship_type}`,
        severity: "reject",
      });
    }

    for (const field of [
      "title",
      "plain_language_summary",
      "scientific_rationale",
      "validation_question",
      "proposed_next_step",
    ] as const) {
      if (!requiredString(hyp[field])) {
        issues.push({
          code: "missing_field",
          message: `Missing required field: ${field}`,
          severity: "reject",
        });
      }
    }

    if (!Array.isArray(hyp.established_premises) || hyp.established_premises.length === 0) {
      issues.push({
        code: "missing_premises",
        message: "At least one established premise with evidence_ids is required",
        severity: "reject",
      });
    } else {
      for (const p of hyp.established_premises) {
        if (!requiredString(p.claim) || !p.evidence_ids?.length) {
          issues.push({
            code: "bad_premise",
            message: "Each premise needs a claim and evidence_ids",
            severity: "reject",
          });
          continue;
        }
        for (const eid of p.evidence_ids) {
          if (!evidenceIds.has(eid)) {
            issues.push({
              code: "fabricated_evidence",
              message: `Evidence id not in retrieved bundle: ${eid}`,
              severity: "reject",
            });
          }
        }
      }
    }

    const pairKey = `${hyp.source_node_id}::${hyp.target_node_id}::${hyp.proposed_relationship_type}`;
    if (establishedPairs.has(pairKey)) {
      issues.push({
        code: "duplicate_established",
        message: "Restates an established relationship of the same type",
        severity: "reject",
      });
    }
    // Soft hold if undirected pair already established under any type.
    if (
      establishedUndirected.has(`${hyp.source_node_id}::${hyp.target_node_id}`) &&
      !issues.some((i) => i.code === "duplicate_established")
    ) {
      issues.push({
        code: "existing_pair",
        message:
          "An established link already exists between these nodes; proposal held for review",
        severity: "hold",
      });
    }

    const blob = [
      hyp.title,
      hyp.plain_language_summary,
      hyp.scientific_rationale,
      hyp.proposed_next_step,
    ].join(" ");
    if (APPROVAL_CLAIM.test(blob)) {
      issues.push({
        code: "approval_claim",
        message: "Output claims expert approval or proven treatment",
        severity: "reject",
      });
    }

    if (hyp.generation_status === "insufficient_evidence") {
      issues.push({
        code: "model_insufficient",
        message: "Model marked insufficient evidence",
        severity: "reject",
      });
    }

    const dedupeKey = `${hyp.source_node_id}::${hyp.target_node_id}::${hyp.proposed_relationship_type}`;
    if (seen.has(dedupeKey)) {
      issues.push({
        code: "duplicate_proposal",
        message: "Duplicate proposal in the same response",
        severity: "reject",
      });
    }
    seen.add(dedupeKey);

    const evidence_support_flags = premisesSupportFlags(hyp, bundle);
    if (evidence_support_flags.length > 0) {
      issues.push({
        code: "weak_passage_support",
        message: evidence_support_flags[0],
        severity: "hold",
      });
    }

    const reject = issues.some((i) => i.severity === "reject");
    const hold = !reject && issues.some((i) => i.severity === "hold");
    const validated: ValidatedHypothesis = {
      ...hyp,
      relevant_differences: hyp.relevant_differences || [],
      counterevidence: hyp.counterevidence || [],
      missing_evidence: hyp.missing_evidence || [],
      validation: {
        accepted: !reject && !hold,
        issues,
        evidence_support_flags,
      },
      relationship_status: "hypothesis",
      origin: "ai_generated",
      review_status: "not_reviewed",
    };

    if (reject) {
      held.push(validated);
    } else if (hold) {
      held.push(validated);
    } else {
      accepted.push(validated);
    }
  }

  return {
    accepted: accepted.slice(0, 3),
    held,
  };
}

/** Convert a validated AI hypothesis into a display edge (not written to curated JSON). */
export function hypothesisToEdge(hyp: ValidatedHypothesis) {
  const primaryEvidenceId = hyp.established_premises[0]?.evidence_ids[0];
  return {
    id: hyp.hypothesis_id,
    source: hyp.source_node_id,
    target: hyp.target_node_id,
    type: hyp.proposed_relationship_type,
    relationship_status: "hypothesis" as const,
    origin: "ai_generated" as const,
    review_status: "not_reviewed" as const,
    layer: "ai_hypothesis",
    plain_language: hyp.plain_language_summary,
    limitations: [
      ...hyp.relevant_differences,
      ...hyp.missing_evidence,
    ].join(" "),
    evidence: {
      source_url: null,
      supporting_passage: hyp.scientific_rationale,
      evidence_type: "ai_generated_hypothesis",
      extraction_review_status: "not_reviewed",
      limitations: hyp.missing_evidence.join("; ") || null,
      contradictory_evidence: hyp.counterevidence.join("; ") || null,
      reporting_basis: "inferred_or_proposed",
      // Carry premise evidence ids for the panel (not as invented URLs).
      genotype_context: primaryEvidenceId
        ? `Grounded on retrieved evidence ids: ${hyp.established_premises
            .flatMap((p) => p.evidence_ids)
            .join(", ")}`
        : null,
    },
    ai_hypothesis: hyp,
  };
}
