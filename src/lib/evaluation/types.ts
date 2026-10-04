export const EVAL_PROMPT_VERSION = "atlas-evaluation-v1";

export const CONCLUSION_LABELS = [
  "potential_reuse_worth_investigating",
  "important_differences_require_review",
  "insufficient_evidence_to_assess",
  "evidence_argues_against_proposed_reuse",
] as const;

export type ConclusionLabel = (typeof CONCLUSION_LABELS)[number];

export const REUSE_ASSESSMENTS = [
  "potentially_reusable",
  "needs_adaptation",
  "insufficient_information",
  "evidence_argues_against_reuse",
] as const;

export type ReuseAssessmentLabel = (typeof REUSE_ASSESSMENTS)[number];

export const RESEARCH_OBJECTIVE_EXAMPLES = [
  "Plan a natural-history study",
  "Assess whether study methods could be adapted",
  "Find a registry collaboration opportunity",
  "Explore a shared preclinical research approach",
] as const;

export type EvidenceKind = "source_passage" | "curator_summary" | "asset_record";

export type EvaluationEvidenceRecord = {
  evidence_id: string;
  kind: EvidenceKind;
  edge_id?: string;
  node_id?: string;
  source_url: string | null;
  title?: string | null;
  supporting_passage: string;
  publication_date?: string | null;
  retrieval_date?: string | null;
  evidence_type?: string | null;
  genotype_context?: string | null;
  population_context?: string | null;
  species?: string | null;
  experimental_context?: string | null;
  limitations?: string | null;
  contradictory_evidence?: string | null;
  relationship_status?: string | null;
  claim_summary?: string | null;
  endpoint_labels?: string[];
  /** True when this text is curator-authored, not a verbatim abstract. */
  is_curator_summary: boolean;
};

export type PathStep = {
  edge_id: string;
  source: string;
  target: string;
  type: string;
  relationship_status: string;
};

export type EvaluationEvidencePackage = {
  dataset_id: string;
  disease_node_id: string;
  asset_node_id: string;
  research_objective: string;
  evidence_version: string;
  disease: {
    id: string;
    label: string;
    type: string;
    plain_language?: string;
    does_not?: string;
    genotype_scope?: string;
  };
  asset: {
    id: string;
    label: string;
    type: string;
    plain_language?: string;
    access_info?: string;
    source_url?: string | null;
    asset_kind?: string;
    designed_for?: Record<string, string | null | undefined>;
    curated_relevance?: string;
    curated_may_be_reusable?: string[];
    curated_what_differs?: string[];
    curated_needs_expert_review?: string[];
    curated_adaptation_status?: string;
  };
  connecting_paths: PathStep[][];
  related_context_nodes: {
    id: string;
    type: string;
    label: string;
    note?: string;
  }[];
  evidence: EvaluationEvidenceRecord[];
  missing_information: string[];
  insufficient: boolean;
  insufficient_reason?: string;
};

export type ModelReuseElement = {
  element: string;
  assessment: ReuseAssessmentLabel | string;
  rationale: string;
  important_differences: string[];
  evidence_ids: string[];
  must_verify_before_proceeding: string;
};

export type ModelUnknownQuestion = {
  unknown: string;
  why_it_matters: string;
  resolvable_by: string;
};

export type ModelNextAction = {
  action: string;
  role_or_organization: string;
  information_needed: string;
  decision_enabled: string;
};

export type ModelEvaluation = {
  assessment_id: string;
  conclusion_label: ConclusionLabel | string;
  opportunity_summary: string;
  why_relevant: {
    documented_findings: { claim: string; evidence_ids: string[] }[];
    ai_interpretation: string;
    proposed_opportunity: string;
  };
  reuse_elements: ModelReuseElement[];
  unknown_questions: ModelUnknownQuestion[];
  recommended_next_step: {
    milestone: string;
    actions: ModelNextAction[];
  };
  potential_time_savings: string;
  evidence_limitations_explanation: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "reject" | "flag";
};

export type ValidatedEvaluation = ModelEvaluation & {
  conclusion_label: ConclusionLabel;
  validation: {
    accepted: boolean;
    issues: ValidationIssue[];
    flagged_claims: string[];
  };
  origin: "ai_generated";
  review_status: "not_reviewed";
};

export type EvaluationResult = {
  status:
    | "ok"
    | "insufficient_evidence"
    | "unavailable"
    | "disabled"
    | "error"
    | "cancelled"
    | "missing_asset";
  cached?: boolean;
  model?: string;
  prompt_version?: string;
  generated_at?: string;
  disease_node_id: string;
  asset_node_id: string;
  research_objective: string;
  evidence_ids: string[];
  evidence_version?: string;
  evidence_scope_summary?: string;
  assessment: ValidatedEvaluation | null;
  message?: string;
  missing_information?: string[];
  /** Explicit label when serving a saved example (never live). */
  saved_example?: boolean;
};

export type CollaborationBrief = {
  targetDisease: string;
  researchObjective: string;
  selectedAsset: string;
  rationaleAndCitations: string[];
  potentialReuse: string[];
  requiredAdaptations: string[];
  unresolvedQuestions: string[];
  proposedFirstDiscussion: string;
  aiStatusNote: string;
  generatedAt: string;
  conclusionLabel: string;
};
