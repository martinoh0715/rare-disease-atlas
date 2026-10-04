import {
  CONCLUSION_LABELS,
  REUSE_ASSESSMENTS,
  type CollaborationBrief,
  type EvaluationEvidencePackage,
  type ModelEvaluation,
  type ValidatedEvaluation,
  type ValidationIssue,
} from "@/lib/evaluation/types";

const APPROVAL_OR_AVAILABILITY =
  /\b(expert[- ]approved|clinically validated|partner has agreed|will collaborate|guaranteed|proven treatment)\b/i;
const QUANTIFIED_SAVINGS =
  /\b(\d+\s*x|10×|ten times|\$\d|\d+\s*(weeks|months|years)\s+saved)\b/i;

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function allEvidenceIds(pkg: EvaluationEvidencePackage): Set<string> {
  return new Set(pkg.evidence.map((e) => e.evidence_id));
}

function collectCitedIds(model: ModelEvaluation): string[] {
  const ids: string[] = [];
  for (const f of model.why_relevant?.documented_findings || []) {
    ids.push(...(f.evidence_ids || []));
  }
  for (const el of model.reuse_elements || []) {
    ids.push(...(el.evidence_ids || []));
  }
  return ids;
}

function weakSupportFlags(
  model: ModelEvaluation,
  pkg: EvaluationEvidencePackage
): string[] {
  const flags: string[] = [];
  const byId = new Map(pkg.evidence.map((e) => [e.evidence_id, e]));
  for (const f of model.why_relevant?.documented_findings || []) {
    for (const eid of f.evidence_ids || []) {
      const rec = byId.get(eid);
      if (!rec) continue;
      if (rec.is_curator_summary) {
        flags.push(
          `Finding cites curator summary ${eid}; keep labeled as curator summary, not abstract.`
        );
      }
      const tokens = f.claim
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 4)
        .slice(0, 8);
      const passage = rec.supporting_passage.toLowerCase();
      const overlap = tokens.filter((t) => passage.includes(t)).length;
      if (tokens.length >= 3 && overlap < 1) {
        flags.push(`Weak passage support for claim via ${eid}`);
      }
    }
  }
  return flags;
}

export function validateEvaluation(
  model: ModelEvaluation,
  pkg: EvaluationEvidencePackage
): ValidatedEvaluation {
  const issues: ValidationIssue[] = [];
  const evidenceIds = allEvidenceIds(pkg);

  if (!required(model.assessment_id)) {
    issues.push({
      code: "missing_id",
      message: "assessment_id is required",
      severity: "reject",
    });
  }
  if (
    !CONCLUSION_LABELS.includes(
      model.conclusion_label as (typeof CONCLUSION_LABELS)[number]
    )
  ) {
    issues.push({
      code: "bad_conclusion",
      message: `Invalid conclusion_label: ${model.conclusion_label}`,
      severity: "reject",
    });
  }
  for (const field of ["opportunity_summary", "potential_time_savings"] as const) {
    if (!required(model[field])) {
      issues.push({
        code: "missing_field",
        message: `Missing ${field}`,
        severity: "reject",
      });
    }
  }
  if (!model.why_relevant || !required(model.why_relevant.ai_interpretation)) {
    issues.push({
      code: "missing_interpretation",
      message: "why_relevant.ai_interpretation is required",
      severity: "reject",
    });
  }
  if (!required(model.why_relevant?.proposed_opportunity)) {
    issues.push({
      code: "missing_opportunity",
      message: "why_relevant.proposed_opportunity is required",
      severity: "reject",
    });
  }

  const findings = model.why_relevant?.documented_findings || [];
  if (
    model.conclusion_label !== "insufficient_evidence_to_assess" &&
    findings.length === 0
  ) {
    issues.push({
      code: "missing_findings",
      message: "Documented findings with evidence_ids are required",
      severity: "reject",
    });
  }
  for (const f of findings) {
    if (!required(f.claim) || !f.evidence_ids?.length) {
      issues.push({
        code: "bad_finding",
        message: "Each documented finding needs claim and evidence_ids",
        severity: "reject",
      });
      continue;
    }
    for (const eid of f.evidence_ids) {
      if (!evidenceIds.has(eid)) {
        issues.push({
          code: "fabricated_evidence",
          message: `Unknown evidence id: ${eid}`,
          severity: "reject",
        });
      }
    }
  }

  for (const el of model.reuse_elements || []) {
    if (
      !REUSE_ASSESSMENTS.includes(
        el.assessment as (typeof REUSE_ASSESSMENTS)[number]
      )
    ) {
      issues.push({
        code: "bad_reuse_assessment",
        message: `Invalid reuse assessment: ${el.assessment}`,
        severity: "reject",
      });
    }
    if (!required(el.element) || !required(el.rationale)) {
      issues.push({
        code: "bad_reuse_element",
        message: "Reuse element needs element and rationale",
        severity: "reject",
      });
    }
    for (const eid of el.evidence_ids || []) {
      if (!evidenceIds.has(eid)) {
        issues.push({
          code: "fabricated_evidence",
          message: `Unknown evidence id in reuse element: ${eid}`,
          severity: "reject",
        });
      }
    }
  }

  if (
    !model.recommended_next_step?.milestone ||
    !model.recommended_next_step.actions?.length
  ) {
    if (model.conclusion_label !== "insufficient_evidence_to_assess") {
      issues.push({
        code: "missing_next_step",
        message: "Recommended next step with actions is required",
        severity: "reject",
      });
    }
  }

  const blob = [
    model.opportunity_summary,
    model.why_relevant?.ai_interpretation,
    model.why_relevant?.proposed_opportunity,
    model.potential_time_savings,
    ...(model.recommended_next_step?.actions || []).map((a) => a.action),
  ].join(" ");
  if (APPROVAL_OR_AVAILABILITY.test(blob)) {
    issues.push({
      code: "availability_or_approval_claim",
      message: "Assessment claims approval or partner availability",
      severity: "reject",
    });
  }
  if (QUANTIFIED_SAVINGS.test(model.potential_time_savings || "")) {
    issues.push({
      code: "quantified_savings",
      message: "Quantified time/cost savings are not allowed without sourced estimates",
      severity: "flag",
    });
  }

  const flagged_claims = weakSupportFlags(model, pkg);
  for (const f of flagged_claims) {
    issues.push({ code: "weak_support", message: f, severity: "flag" });
  }

  // Drop weakly supported documented findings rather than showing them as facts.
  const cleanedFindings = findings.filter((f) => {
    const weak = flagged_claims.some((flag) =>
      (f.evidence_ids || []).some((eid) => flag.includes(eid) && flag.startsWith("Weak"))
    );
    return !weak;
  });

  const reject = issues.some((i) => i.severity === "reject");
  const conclusion =
    (CONCLUSION_LABELS.includes(
      model.conclusion_label as (typeof CONCLUSION_LABELS)[number]
    )
      ? model.conclusion_label
      : "insufficient_evidence_to_assess") as ValidatedEvaluation["conclusion_label"];

  return {
    ...model,
    why_relevant: {
      documented_findings: cleanedFindings,
      ai_interpretation: model.why_relevant?.ai_interpretation || "",
      proposed_opportunity: model.why_relevant?.proposed_opportunity || "",
    },
    reuse_elements: model.reuse_elements || [],
    unknown_questions: model.unknown_questions || [],
    recommended_next_step: model.recommended_next_step || {
      milestone: "",
      actions: [],
    },
    conclusion_label: conclusion,
    validation: {
      accepted: !reject,
      issues,
      flagged_claims,
    },
    origin: "ai_generated",
    review_status: "not_reviewed",
  };
}

export function buildCollaborationBrief(
  assessment: ValidatedEvaluation,
  pkg: EvaluationEvidencePackage,
  generatedAt: string
): CollaborationBrief {
  const cite = (ids: string[]) =>
    ids
      .map((id) => {
        const rec = pkg.evidence.find((e) => e.evidence_id === id);
        if (!rec) return id;
        return rec.source_url ? `${id} → ${rec.source_url}` : id;
      })
      .join("; ");

  const rationaleAndCitations = assessment.why_relevant.documented_findings.map(
    (f) => `${f.claim} [${cite(f.evidence_ids)}]`
  );
  rationaleAndCitations.push(
    `AI interpretation (not reviewed): ${assessment.why_relevant.ai_interpretation}`
  );
  rationaleAndCitations.push(
    `Proposed opportunity (not reviewed): ${assessment.why_relevant.proposed_opportunity}`
  );

  const potentialReuse = assessment.reuse_elements
    .filter((e) => e.assessment === "potentially_reusable" || e.assessment === "needs_adaptation")
    .map(
      (e) =>
        `${e.element}: ${e.assessment.replace(/_/g, " ")} — ${e.rationale} [${cite(e.evidence_ids)}]`
    );

  const requiredAdaptations = assessment.reuse_elements
    .filter(
      (e) =>
        e.assessment === "needs_adaptation" ||
        e.assessment === "evidence_argues_against_reuse" ||
        e.important_differences.length
    )
    .flatMap((e) => [
      ...e.important_differences.map((d) => `${e.element}: ${d}`),
      e.must_verify_before_proceeding
        ? `${e.element}: verify — ${e.must_verify_before_proceeding}`
        : "",
    ])
    .filter(Boolean);

  const unresolvedQuestions = assessment.unknown_questions.map(
    (q) => `${q.unknown} (why: ${q.why_it_matters}; resolve via: ${q.resolvable_by})`
  );

  const first = assessment.recommended_next_step.actions[0];
  const proposedFirstDiscussion = first
    ? `${assessment.recommended_next_step.milestone} First action: ${first.action} (role: ${first.role_or_organization}; needs: ${first.information_needed}; enables: ${first.decision_enabled})`
    : assessment.recommended_next_step.milestone ||
      "Identify a feasibility check with a documented organization contact page.";

  return {
    targetDisease: pkg.disease.label,
    researchObjective: pkg.research_objective || "(not specified)",
    selectedAsset: pkg.asset.label,
    rationaleAndCitations,
    potentialReuse,
    requiredAdaptations,
    unresolvedQuestions,
    proposedFirstDiscussion,
    aiStatusNote:
      "AI-generated assessment — not reviewed. Not an established graph relationship, approval, or treatment recommendation.",
    generatedAt,
    conclusionLabel: assessment.conclusion_label.replace(/_/g, " "),
  };
}

export function formatCollaborationBriefMarkdown(b: CollaborationBrief): string {
  return `# Collaboration brief

## Target disease
${b.targetDisease}

## Research objective
${b.researchObjective}

## Selected asset
${b.selectedAsset}

## Assessment conclusion
${b.conclusionLabel}

## Rationale and citations
${b.rationaleAndCitations.map((x) => `- ${x}`).join("\n") || "- (none)"}

## Potential reuse
${b.potentialReuse.map((x) => `- ${x}`).join("\n") || "- (none documented)"}

## Required adaptations / verification
${b.requiredAdaptations.map((x) => `- ${x}`).join("\n") || "- (none listed)"}

## Unresolved questions
${b.unresolvedQuestions.map((x) => `- ${x}`).join("\n") || "- (none listed)"}

## Proposed first discussion or feasibility check
${b.proposedFirstDiscussion}

---
${b.aiStatusNote}
Generated at: ${b.generatedAt}
This atlas does not send messages or contact organizations automatically.
`;
}

export function citedIdsInModel(model: ModelEvaluation): string[] {
  return [...new Set(collectCitedIds(model))];
}
