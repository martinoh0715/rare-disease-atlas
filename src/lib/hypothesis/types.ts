export const PROMPT_VERSION = "atlas-hypothesis-v1";

export const ALLOWED_PROPOSED_RELATIONSHIP_TYPES = [
  "proposed_shared_mechanism",
  "proposed_assay_adaptation",
  "proposed_asset_adaptation",
  "proposed_cross_disease_connection",
  "potential_collaborator_for",
  "suggests_next_research_step",
  "proposed_experiment",
] as const;

export type ProposedRelationshipType =
  (typeof ALLOWED_PROPOSED_RELATIONSHIP_TYPES)[number];

export type GenerationStatus =
  | "proposed"
  | "insufficient_evidence"
  | "rejected_validation";

export type EstablishedPremise = {
  claim: string;
  evidence_ids: string[];
};

export type ModelHypothesis = {
  hypothesis_id: string;
  source_node_id: string;
  target_node_id: string;
  proposed_relationship_type: ProposedRelationshipType | string;
  title: string;
  plain_language_summary: string;
  established_premises: EstablishedPremise[];
  scientific_rationale: string;
  relevant_differences: string[];
  counterevidence: string[];
  missing_evidence: string[];
  validation_question: string;
  proposed_next_step: string;
  generation_status: GenerationStatus | string;
};

export type ModelHypothesisResponse = {
  hypotheses: ModelHypothesis[];
  evidence_limitations_explanation: string;
};

export type EvidenceRecord = {
  evidence_id: string;
  edge_id?: string;
  node_id?: string;
  source_url: string | null;
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
};

export type EvidenceBundle = {
  dataset_id: string;
  selected_node_id: string;
  research_question: string;
  evidence_version: string;
  nodes: { id: string; type: string; label: string; notes?: string }[];
  evidence: EvidenceRecord[];
  established_edges: {
    id: string;
    source: string;
    target: string;
    type: string;
    relationship_status: string;
  }[];
  insufficient: boolean;
  insufficient_reason?: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "reject" | "hold";
};

export type ValidatedHypothesis = ModelHypothesis & {
  validation: {
    accepted: boolean;
    issues: ValidationIssue[];
    evidence_support_flags: string[];
  };
  relationship_status: "hypothesis";
  origin: "ai_generated";
  review_status: "not_reviewed";
};

export type HypothesisExploreResult = {
  status:
    | "ok"
    | "insufficient_evidence"
    | "unavailable"
    | "error"
    | "cancelled";
  cached?: boolean;
  model?: string;
  prompt_version?: string;
  generated_at?: string;
  selected_node_id: string;
  research_question: string;
  evidence_ids: string[];
  evidence_version?: string;
  hypotheses: ValidatedHypothesis[];
  held: ValidatedHypothesis[];
  message?: string;
  evidence_limitations_explanation?: string;
};
