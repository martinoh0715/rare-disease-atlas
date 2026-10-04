import {
  CONCLUSION_LABELS,
  REUSE_ASSESSMENTS,
  type CollaborationBrief,
  type EvaluationEvidencePackage,
  type ModelEvaluation,
  type ModelReuseElement,
  type ValidatedEvaluation,
  type ValidationIssue,
} from "@/lib/evaluation/types";

const APPROVAL_OR_AVAILABILITY =
  /\b(expert[- ]approved|clinically validated|partner has agreed|will collaborate|guaranteed|proven treatment)\b/i;
const QUANTIFIED_SAVINGS =
  /\b(\d+\s*x|10×|ten times|\$\d|\d+\s*(weeks|months|years)\s+saved)\b/i;
const WITHOUT_MODIFICATION = /\bwithout modification\b/i;
const GENERIC_ELEMENT =
  /^(eligibility criteria|outcomes?|endpoints?|voc[- ]related endpoints?|study methods?|protocol|methods?)$/i;
const GENERIC_DETAIL_MISSING =
  /details not present|not present in supplied evidence|not available in (the )?evidence|not specified|no specific .+ (definition|criterion|criteria)/i;
const EFFICACY_RESULT =
  /\b(free from vaso-occlusive|efficacy|transfusion independence|were free from)\b/i;

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function allEvidenceIds(pkg: EvaluationEvidencePackage): Set<string> {
  return new Set(pkg.evidence.map((e) => e.evidence_id));
}

function packageText(pkg: EvaluationEvidencePackage): string {
  return pkg.evidence.map((e) => e.supporting_passage).join("\n");
}

/** Detect percentages in generated text that drop denominators present in evidence. */
export function lostQuantitativeQualifierIssues(
  generatedText: string,
  evidenceText: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const src = evidenceText;
  // Patterns like: Of 30 patients ... 29 (97%)
  const denomMatches = [
    ...src.matchAll(
      /\bof\s+(\d+)\s+patients[^.%]{0,80}?(\d+)\s*\((\d{1,3})%\)/gi
    ),
    ...src.matchAll(
      /\b(\d+)\s+of\s+(\d+)\s+(?:patients|participants)[^.%]{0,40}?\((\d{1,3})%\)/gi
    ),
  ];
  for (const m of denomMatches) {
    const percent = m[3];
    const a = m[1];
    const b = m[2];
    if (!percent) continue;
    // Do not use a trailing \b after "%": "%" is already a non-word character.
    const pctRe = new RegExp(`(?<!\\d)${percent}%(?!\\d)`);
    if (!pctRe.test(generatedText)) continue;
    const hasDenoms =
      generatedText.includes(a) && generatedText.includes(b);
    const hasFollowUp = /sufficient follow-up|consecutive months|evaluable/i.test(
      generatedText
    );
    const sourceHasFollowUp = /sufficient follow-up|consecutive months|evaluable/i.test(
      m[0]
    );
    if (!hasDenoms || (sourceHasFollowUp && !hasFollowUp)) {
      issues.push({
        code: "lost_quantitative_qualifier",
        message: `Generated text uses ${percent}% without preserving the source denominator/qualifier (${m[0].slice(0, 120)})`,
        severity: "flag",
      });
    }
  }
  // Also catch bare "97% of patients" when source has 29 of 30 style phrasing nearby in package
  if (
    /\b\d{1,3}%\s+of\s+patients\b/i.test(generatedText) &&
    /\b\d+\s+of\s+\d+\b/.test(src) &&
    !/\b\d+\s+of\s+\d+\b/.test(generatedText)
  ) {
    issues.push({
      code: "lost_quantitative_qualifier",
      message:
        'Generated text uses “% of patients” without the source “N of M” denominator',
      severity: "flag",
    });
  }
  return issues;
}

function isGenericReuseElement(el: ModelReuseElement): boolean {
  if (GENERIC_ELEMENT.test(el.element.trim())) return true;
  if (!required(el.documented_detail)) return true;
  if (GENERIC_DETAIL_MISSING.test(el.documented_detail)) return true;
  if (!required(el.supporting_passage_excerpt)) return true;
  if (el.supporting_passage_excerpt.trim().length < 40) return true;
  return false;
}

function usesEfficacyAsReuseRationale(el: ModelReuseElement): boolean {
  return (
    EFFICACY_RESULT.test(el.rationale) ||
    EFFICACY_RESULT.test(el.supporting_passage_excerpt || "") ||
    EFFICACY_RESULT.test(el.documented_detail || "")
  );
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

function coerceReuseElements(
  elements: ModelReuseElement[],
  issues: ValidationIssue[]
): ModelReuseElement[] {
  return elements.map((el) => {
    const next = { ...el };
    const genericLabel = GENERIC_ELEMENT.test(next.element.trim());
    if (
      (next.assessment === "potentially_reusable" ||
        next.assessment === "needs_adaptation") &&
      (isGenericReuseElement(next) || usesEfficacyAsReuseRationale(next))
    ) {
      issues.push({
        code: "generic_or_efficacy_reuse",
        message: `Reuse element "${next.element}" lacked a specific documented detail or relied on efficacy results; coerced to insufficient_information`,
        severity: "flag",
      });
      next.assessment = "insufficient_information";
      if (!required(next.documented_detail) || !GENERIC_DETAIL_MISSING.test(next.documented_detail)) {
        if (isGenericReuseElement(next) || !required(next.documented_detail)) {
          next.documented_detail =
            "Details not present in supplied evidence";
        }
      }
      if (!required(next.supporting_passage_excerpt)) {
        next.supporting_passage_excerpt =
          "No specific criterion/outcome definition excerpt was available in the evidence package.";
      }
      next.rationale =
        `${next.rationale} The package does not contain enough specific protocol text to evaluate transferability of this element; an efficacy or high-level mention is not sufficient.`.trim();
    }
    // Clarify generic labels even when already insufficient_information
    if (
      genericLabel &&
      (GENERIC_DETAIL_MISSING.test(next.documented_detail || "") ||
        !required(next.documented_detail) ||
        (next.documented_detail || "").trim().length < 24)
    ) {
      next.element = `Unspecified ${next.element.trim().toLowerCase()} (details missing from stored evidence)`;
      if (!required(next.documented_detail)) {
        next.documented_detail = "Details not present in supplied evidence";
      }
      if (!required(next.relevance_to_objective)) {
        next.relevance_to_objective =
          "Cannot judge relevance to the objective until specific criterion/measurement text is obtained.";
      }
    }
    return next;
  });
}

function isGenericRegulatoryAction(action: {
  action?: string;
  role_or_organization?: string;
  information_needed?: string;
  decision_enabled?: string;
}): boolean {
  const blob = [
    action.action,
    action.role_or_organization,
    action.information_needed,
    action.decision_enabled,
  ].join(" ");
  return /\bregulatory (experts?|affairs)\b/i.test(blob);
}

function concreteDocumentChecklistAction(
  pkg: EvaluationEvidencePackage
): ModelEvaluation["recommended_next_step"]["actions"][number] {
  const assetLabel = pkg.asset.label || pkg.asset_node_id;
  const ident =
    pkg.asset.source_url ||
    pkg.asset_node_id.replace(/^nct:/, "NCT") ||
    "the selected asset";
  return {
    action: `Pull the public registry eligibility and outcome-measure fields for ${assetLabel} (${ident}) into a side-by-side comparison against the stated research objective`,
    role_or_organization:
      "Study-methods reviewer (clinical research methods / biostatistics)",
    information_needed:
      "Registry inclusion/exclusion text, outcome definitions/schedules, and the community objective wording",
    decision_enabled:
      "Whether any documented measurement or selection rule is appropriate to adapt, what modifications would be required, and which documents remain missing",
  };
}

function sanitizeNextStep(
  step: ModelEvaluation["recommended_next_step"],
  pkg: EvaluationEvidencePackage,
  evidenceBlob: string,
  issues: ValidationIssue[]
): ModelEvaluation["recommended_next_step"] {
  const next = {
    milestone: step?.milestone || "",
    actions: [...(step?.actions || [])],
  };
  if (WITHOUT_MODIFICATION.test(next.milestone)) {
    next.milestone =
      "Assess whether any documented design elements are appropriate for the community objective and what adaptations would be required";
  } else if (
    !required(next.milestone) ||
    /\b(clarify|consult)\b/i.test(next.milestone)
  ) {
    next.milestone =
      "Inventory missing study documents and prepare a methods-reviewer comparison against the community objective";
  }

  const evidenceHasRegulatoryIssue =
    /\b(IND|IDE|FDA|EMA|IRB|ethics)\b/i.test(evidenceBlob);
  let actions = next.actions.filter((a) => {
    if (!evidenceHasRegulatoryIssue && isGenericRegulatoryAction(a)) {
      issues.push({
        code: "generic_regulatory",
        message:
          "Removed generic regulatory-expert action without a specific regulatory issue in the evidence",
        severity: "flag",
      });
      return false;
    }
    return true;
  });

  actions = actions.map((a) => {
    const copy = { ...a };
    if (WITHOUT_MODIFICATION.test(copy.decision_enabled || "")) {
      copy.decision_enabled =
        "Whether reuse is appropriate and what adaptations would be required";
    }
    if (
      !required(copy.information_needed) ||
      /^(n\/a|none|unknown)$/i.test(copy.information_needed.trim())
    ) {
      copy.information_needed =
        "Specific public protocol/registry fields still missing from the stored evidence package";
    }
    if (
      !required(copy.role_or_organization) ||
      /\bregulatory experts?\b/i.test(copy.role_or_organization)
    ) {
      copy.role_or_organization =
        "Study-methods reviewer (clinical research methods / biostatistics)";
    }
    return copy;
  });

  if (actions.length === 0) {
    actions = [concreteDocumentChecklistAction(pkg)];
  }
  next.actions = actions;
  return next;
}

function proportionateConclusion(
  model: ModelEvaluation,
  pkg: EvaluationEvidencePackage,
  reuseElements: ModelReuseElement[],
  issues: ValidationIssue[]
): ValidatedEvaluation["conclusion_label"] {
  let conclusion =
    (CONCLUSION_LABELS.includes(
      model.conclusion_label as (typeof CONCLUSION_LABELS)[number]
    )
      ? model.conclusion_label
      : "insufficient_evidence_to_assess") as ValidatedEvaluation["conclusion_label"];

  const protocolGaps = pkg.missing_information.some((m) =>
    /eligibility|endpoint|outcome definition|protocol detail|follow-up schedule|specific/i.test(
      m
    )
  );
  const specificPositive = reuseElements.some(
    (e) =>
      (e.assessment === "potentially_reusable" ||
        e.assessment === "needs_adaptation") &&
      !isGenericReuseElement(e) &&
      !usesEfficacyAsReuseRationale(e)
  );

  if (
    conclusion === "potential_reuse_worth_investigating" &&
    (protocolGaps || !specificPositive)
  ) {
    issues.push({
      code: "conclusion_overconfident",
      message:
        "Downgraded conclusion: protocol details are missing or no specific reusable element was evidenced",
      severity: "flag",
    });
    conclusion = protocolGaps
      ? "important_differences_require_review"
      : "insufficient_evidence_to_assess";
  }
  return conclusion;
}

export function validateEvaluation(
  model: ModelEvaluation,
  pkg: EvaluationEvidencePackage
): ValidatedEvaluation {
  const issues: ValidationIssue[] = [];
  const evidenceIds = allEvidenceIds(pkg);
  const evidenceBlob = packageText(pkg);

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
  if (!Array.isArray(model.top_summary_limitations)) {
    issues.push({
      code: "missing_top_limitations",
      message: "top_summary_limitations array is required",
      severity: "reject",
    });
  } else if (
    model.top_summary_limitations.length === 0 &&
    pkg.missing_information.length > 0
  ) {
    issues.push({
      code: "empty_top_limitations",
      message:
        "top_summary_limitations empty despite package missing_information",
      severity: "flag",
    });
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
  if (!model.study_design_comparison) {
    issues.push({
      code: "missing_study_design_comparison",
      message: "study_design_comparison is required",
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
    if (!required(el.documented_detail) || !required(el.relevance_to_objective)) {
      issues.push({
        code: "missing_reuse_specificity",
        message: `Reuse element "${el.element}" needs documented_detail and relevance_to_objective`,
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
    model.recommended_next_step?.milestone,
    ...(model.top_summary_limitations || []),
    ...(model.recommended_next_step?.actions || []).flatMap((a) => [
      a.action,
      a.role_or_organization,
      a.information_needed,
      a.decision_enabled,
    ]),
  ].join(" ");

  const qualifierIssues = lostQuantitativeQualifierIssues(blob, evidenceBlob);
  issues.push(...qualifierIssues);

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
      message:
        "Quantified time/cost savings are not allowed without sourced estimates",
      severity: "flag",
    });
  }
  if (WITHOUT_MODIFICATION.test(blob)) {
    issues.push({
      code: "without_modification",
      message:
        'Avoid “adapted without modification”; ask whether reuse is appropriate and what adaptations are required',
      severity: "reject",
    });
  }
  const flagged_claims = weakSupportFlags(model, pkg);
  for (const f of flagged_claims) {
    issues.push({ code: "weak_support", message: f, severity: "flag" });
  }

  let cleanedFindings = findings.filter((f) => {
    const weak = flagged_claims.some(
      (flag) =>
        (f.evidence_ids || []).some((eid) => flag.includes(eid)) &&
        flag.startsWith("Weak")
    );
    const lostQualifier =
      lostQuantitativeQualifierIssues(f.claim, evidenceBlob).length > 0;
    if (lostQualifier) {
      issues.push({
        code: "dropped_unqualified_finding",
        message: `Dropped finding that lost quantitative context: ${f.claim.slice(0, 100)}`,
        severity: "flag",
      });
    }
    return !weak && !lostQualifier;
  });

  // If the model omitted or lost qualified quantitative findings, restore a
  // background efficacy/context passage with its original denominators.
  if (cleanedFindings.length === 0) {
    const quant = pkg.evidence.find(
      (e) =>
        e.kind === "source_passage" &&
        /\b\d+\s*\(\d{1,3}%\)|\b\d+\s+of\s+\d+\b/.test(e.supporting_passage)
    );
    if (quant) {
      cleanedFindings = [
        {
          claim: quant.supporting_passage.slice(0, 400),
          evidence_ids: [quant.evidence_id],
        },
      ];
      issues.push({
        code: "restored_qualified_finding",
        message:
          "Restored a source passage with full quantitative qualifiers as background (not reuse proof)",
        severity: "flag",
      });
    }
  }

  const reuse_elements = coerceReuseElements(
    (model.reuse_elements || []).map((e) => ({
      ...e,
      documented_detail: e.documented_detail || "",
      supporting_passage_excerpt: e.supporting_passage_excerpt || "",
      relevance_to_objective: e.relevance_to_objective || "",
      important_differences: e.important_differences || [],
    })),
    issues
  );

  let top_summary_limitations = [...(model.top_summary_limitations || [])];
  for (const m of pkg.missing_information) {
    if (
      /eligibility|endpoint|outcome|protocol|access|observational|natural-history/i.test(
        m
      ) &&
      !top_summary_limitations.some((t) => t.includes(m.slice(0, 40)))
    ) {
      top_summary_limitations.push(m);
    }
  }
  if (qualifierIssues.length) {
    const srcQuote = pkg.evidence.find((e) =>
      /\d+\s*\(\d+%\)|\d+\s+of\s+\d+/i.test(e.supporting_passage)
    )?.supporting_passage;
    top_summary_limitations.push(
      srcQuote
        ? `Quantitative claims must keep source qualifiers. Example from evidence: “${srcQuote.slice(0, 180)}”`
        : "Quantitative claims must keep source denominators, populations, and follow-up qualifiers."
    );
  }
  if (top_summary_limitations.length === 0) {
    top_summary_limitations = [
      model.evidence_limitations_explanation ||
        "Detailed protocol fields may be incomplete in the stored evidence package.",
    ];
  }

  let opportunity_summary = model.opportunity_summary || "";
  if (
    qualifierIssues.length &&
    /\b\d{1,3}%\b/.test(opportunity_summary) &&
    !/\b\d+\s+of\s+\d+\b/.test(opportunity_summary)
  ) {
    opportunity_summary = `${opportunity_summary} (Important: any percentage cited from the evidence must retain its original denominator and follow-up qualifier; see limitations.)`;
  }

  let proposed_opportunity = model.why_relevant?.proposed_opportunity || "";
  const protocolGaps = pkg.missing_information.some((m) =>
    /eligibility|endpoint|outcome definition|protocol/i.test(m)
  );
  if (
    protocolGaps &&
    /\b(reuse|adapt|use)\b[\s\S]{0,40}\b(eligibility|endpoint|VOC-related)\b/i.test(
      proposed_opportunity
    )
  ) {
    proposed_opportunity =
      "Before proposing adaptation, obtain the missing public registry eligibility and outcome-measure text and compare each documented element to the natural-history objective with a study-methods reviewer.";
    issues.push({
      code: "softened_opportunity",
      message:
        "Softened proposed opportunity that assumed endpoint/eligibility reuse despite missing protocol details",
      severity: "flag",
    });
  }

  // Age-band / population notes without full VOC thresholds should not be
  // treated as ready-to-adapt eligibility packages.
  for (const el of reuse_elements) {
    if (
      /age band|ages?\s+\d+/i.test(el.element + " " + el.documented_detail) &&
      /severe VOC history|VOC history/i.test(el.documented_detail) &&
      !/\b\d+\s+(severe\s+)?(voc|vaso-occlusive)/i.test(el.documented_detail) &&
      (el.assessment === "needs_adaptation" ||
        el.assessment === "potentially_reusable")
    ) {
      el.assessment = "insufficient_information";
      el.rationale = `${el.rationale} The stored note gives an age band and mentions severe VOC history but does not define numeric VOC thresholds or full inclusion/exclusion text, so transferability cannot yet be assessed.`.trim();
      issues.push({
        code: "partial_population_note",
        message: `Downgraded "${el.element}" to insufficient_information: age/VOC note lacks protocol thresholds`,
        severity: "flag",
      });
    }
  }

  const conclusion_label = proportionateConclusion(
    { ...model, opportunity_summary },
    pkg,
    reuse_elements,
    issues
  );

  const recommended_next_step = sanitizeNextStep(
    model.recommended_next_step || { milestone: "", actions: [] },
    pkg,
    evidenceBlob,
    issues
  );

  const reject = issues.some((i) => i.severity === "reject");

  return {
    ...model,
    opportunity_summary,
    top_summary_limitations,
    why_relevant: {
      documented_findings: cleanedFindings,
      ai_interpretation: model.why_relevant?.ai_interpretation || "",
      proposed_opportunity,
    },
    reuse_elements,
    study_design_comparison: model.study_design_comparison || {
      purpose_differences: "",
      participant_selection_differences: "",
      treatment_exposure_differences: "",
      outcome_interpretation_differences: "",
      missing_information: [],
    },
    unknown_questions: model.unknown_questions || [],
    recommended_next_step,
    conclusion_label,
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
        const title = rec.display_title || rec.title || id;
        const ident = rec.display_identifier
          ? ` ${rec.display_identifier}`
          : "";
        return rec.source_url
          ? `${title}${ident} (${id}) → ${rec.source_url}`
          : `${title}${ident} (${id})`;
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

  const potentialReuse = assessment.reuse_elements.map(
    (e) =>
      `${e.element} [${e.assessment.replace(/_/g, " ")}]: detail=${e.documented_detail}; relevance=${e.relevance_to_objective}; rationale=${e.rationale} [${cite(e.evidence_ids)}]`
  );

  const requiredAdaptations = [
    ...assessment.top_summary_limitations.map((l) => `Limitation: ${l}`),
    ...assessment.reuse_elements.flatMap((e) => [
      ...e.important_differences.map((d) => `${e.element}: ${d}`),
      e.must_verify_before_proceeding
        ? `${e.element}: verify — ${e.must_verify_before_proceeding}`
        : "",
    ]),
    ...((assessment.study_design_comparison?.missing_information || []).map(
      (m) => `Study-design gap: ${m}`
    )),
  ].filter(Boolean);

  const unresolvedQuestions = assessment.unknown_questions.map(
    (q) =>
      `${q.unknown} (why: ${q.why_it_matters}; resolve via: ${q.resolvable_by})`
  );

  const first = assessment.recommended_next_step.actions[0];
  const proposedFirstDiscussion = first
    ? `${assessment.recommended_next_step.milestone} First action: ${first.action} (role: ${first.role_or_organization}; needs: ${first.information_needed}; enables: ${first.decision_enabled})`
    : assessment.recommended_next_step.milestone ||
      "Identify missing study documents and prepare methods-reviewer questions.";

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
      "AI-generated assessment — not reviewed. Not an established graph relationship, approval, or treatment recommendation. Limitations above must be preserved in any share-out.",
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

## Potential reuse / element-level notes
${b.potentialReuse.map((x) => `- ${x}`).join("\n") || "- (none documented)"}

## Required adaptations / limitations / verification
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
