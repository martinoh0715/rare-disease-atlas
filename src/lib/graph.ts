export type Evidence = {
  source_url?: string | null;
  supporting_passage?: string | null;
  publication_date?: string | null;
  retrieval_date?: string | null;
  evidence_type?: string | null;
  extraction_review_status?: string | null;
  genotype_context?: string | null;
  population_context?: string | null;
  species?: string | null;
  experimental_context?: string | null;
  extraction_confidence?: string | null;
  evidence_strength?: string | null;
  limitations?: string | null;
  contradictory_evidence?: string | null;
};

export type GraphNode = {
  id: string;
  type: string;
  label: string;
  layer?: string;
  review_status?: string;
  plain_language?: string;
  source_url?: string;
  notes?: string;
  access_info?: string;
  page_usable?: boolean;
  species?: string;
  genotype_scope?: string;
  clinical_category?: string;
  clinical_significance?: string;
  clinvar_review_status?: string;
  canonical_allele?: string;
  hgvs_c?: string;
  hgvs_p_modern?: string;
  legacy_protein_numbering?: string;
  reference_transcript?: string;
  overall_status?: string;
  nct_id?: string;
  pmid?: string;
  pubdate?: string;
  journal?: string;
  does_not?: string;
  uncertainties?: string[];
  validation_questions?: string[];
  [key: string]: unknown;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  relationship_status?: string;
  review_status?: string;
  layer?: string;
  evidence?: Evidence;
  limitations?: string;
  [key: string]: unknown;
};

export type GraphData = {
  generated_at: string;
  layer: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats?: Record<string, unknown>;
  default_journey_id?: string;
};

export type Journey = {
  id: string;
  title: string;
  intended_user: string;
  plain_language: string;
  node_path: string[];
  edge_path: string[];
  answers: {
    relevant_communities: string[];
    existing_assets: string[];
    who_could_help: string[];
    next_step: string;
  };
};

export function isHypothesisEdge(edge: GraphEdge): boolean {
  return (
    edge.relationship_status === "hypothesis" ||
    edge.type === "proposed_cross_disease_connection" ||
    edge.type === "suggests_next_research_step" ||
    edge.type === "potential_collaborator_for"
  );
}

export function searchNodes(nodes: GraphNode[], query: string): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return nodes
    .filter((n) => {
      const hay = [
        n.id,
        n.label,
        n.type,
        n.canonical_allele,
        n.hgvs_c,
        n.pmid,
        n.nct_id,
        n.genotype_scope,
        String(n.hpo_id ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 25);
}

export function neighborhood(
  graph: GraphData,
  nodeId: string,
  options?: { maxEdges?: number }
): { nodes: GraphNode[]; edges: GraphEdge[]; truncated: boolean } {
  const maxEdges = options?.maxEdges ?? 18;
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const all = graph.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );
  // Prefer curated/established relationships, then keep a readable sample.
  const ranked = [...all].sort((a, b) => {
    const score = (e: GraphEdge) => {
      let s = 0;
      if (e.review_status === "curated") s += 4;
      if (e.relationship_status === "established") s += 3;
      if (e.relationship_status === "hypothesis") s += 2;
      if (e.evidence?.source_url) s += 1;
      return s;
    };
    return score(b) - score(a);
  });
  const truncated = ranked.length > maxEdges;
  const edges = ranked.slice(0, maxEdges);
  const ids = new Set<string>([nodeId]);
  edges.forEach((e) => {
    ids.add(e.source);
    ids.add(e.target);
  });
  return {
    nodes: [...ids].map((id) => nodeMap.get(id)!).filter(Boolean),
    edges,
    truncated,
  };
}

export function typeColor(type: string): string {
  switch (type) {
    case "disease":
      return "#9a3412";
    case "gene":
    case "protein":
      return "#1d4ed8";
    case "variant":
    case "allele":
    case "genotype":
      return "#7c2d12";
    case "mechanism":
    case "biological_process":
      return "#0f766e";
    case "publication":
    case "clinical_study":
    case "intervention":
      return "#6d28d9";
    case "organization":
    case "research_asset":
    case "institution":
      return "#a16207";
    case "hypothesis":
    case "research_question":
      return "#be185d";
    case "phenotype":
      return "#334155";
    default:
      return "#475569";
  }
}
