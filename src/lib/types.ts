import type { GraphData, GraphEdge, GraphNode, Journey } from "@/lib/graph";

export type SearchEntry = {
  id: string;
  label: string;
  category: string;
  disambiguation_note: string;
  synonyms: string[];
};

export type DemoStage = {
  id: string;
  label: string;
  summary: string;
  node_ids: string[];
  edge_ids: string[];
};

export type AssetAssessment = {
  asset_id: string;
  asset_kind: string;
  title: string;
  description: string;
  owner: string;
  source_url: string;
  designed_for: {
    disease?: string | null;
    genotype?: string | null;
    population?: string | null;
    species?: string | null;
  };
  access: string;
  relevance_to_journey: string;
  comparison: {
    may_be_reusable: string[];
    what_differs: string[];
    needs_expert_review: string[];
    adaptation_status: string;
    validation_question: string;
  };
};

export type DemoExperience = {
  product_one_liner: string;
  viewer: string;
  example_searches: { label: string; query: string }[];
  search_entries: SearchEntry[];
  category_legend: { id: string; label: string; color: string }[];
  stages: DemoStage[];
  edge_plain_language: Record<string, string>;
  asset_assessments: AssetAssessment[];
  registry_gap: {
    status: string;
    explanation: string;
    missing_evidence: string[];
    next_question: string;
  };
  unsupported_search: {
    sources_searched: string[];
    coverage_note: string;
  };
  proposal_defaults: {
    research_question: string;
    proposed_next_step: string;
    partner_gap_if_unknown: string;
  };
};

export type AtlasData = {
  curated: GraphData;
  discovery: GraphData;
  journey: Journey & {
    stages?: DemoStage[];
    registry_gap?: DemoExperience["registry_gap"];
    proposal_defaults?: DemoExperience["proposal_defaults"];
  };
  demo: DemoExperience;
};

export type ProposalDraft = {
  diseaseLabel: string;
  researchQuestion: string;
  connectionSummary: string;
  proposedResource: string;
  partnerLabel: string;
  evidenceBullets: string[];
  differences: string[];
  uncertainties: string[];
  partnerQuestions: string[];
  nextStep: string;
};

export type { GraphData, GraphEdge, GraphNode, Journey };
