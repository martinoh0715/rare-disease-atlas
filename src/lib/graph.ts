import type { DemoExperience, SearchEntry } from "@/lib/types";

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
  reporting_basis?: string | null;
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
  plain_language?: string;
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

export function legendCategoryForType(type: string): string {
  switch (type) {
    case "disease":
      return "disease";
    case "gene":
    case "protein":
    case "variant":
    case "allele":
    case "genotype":
      return "gene_variant";
    case "mechanism":
    case "biological_process":
    case "hypothesis":
      return "mechanism";
    case "intervention":
      return "intervention";
    case "clinical_study":
      return "study";
    case "publication":
      return "publication";
    case "phenotype":
      return "phenotype";
    case "organization":
    case "research_asset":
    case "institution":
    case "research_question":
      return "organization_asset";
    case "grant":
      return "study";
    default:
      return "phenotype";
  }
}

export function typeColor(
  type: string,
  legend?: DemoExperience["category_legend"]
): string {
  const cat = legendCategoryForType(type);
  const fromLegend = legend?.find((l) => l.id === cat)?.color;
  if (fromLegend) return fromLegend;
  switch (cat) {
    case "disease":
      return "#1d4ed8";
    case "gene_variant":
      return "#0f766e";
    case "mechanism":
      return "#b45309";
    case "intervention":
      return "#be123c";
    case "study":
      return "#7c3aed";
    case "publication":
      return "#0e7490";
    case "phenotype":
      return "#57534e";
    case "organization_asset":
      return "#ea580c";
    default:
      return "#475569";
  }
}

export type SearchHit = {
  entry: SearchEntry;
  score: number;
  matchReason: string;
  datasetId?: string;
  datasetLabel?: string;
};

export function searchDemoEntries(
  entries: SearchEntry[],
  query: string,
  meta?: { datasetId?: string; datasetLabel?: string }
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const label = entry.label.toLowerCase();
    const wrap = (score: number, matchReason: string): SearchHit => ({
      entry,
      score,
      matchReason,
      datasetId: meta?.datasetId,
      datasetLabel: meta?.datasetLabel,
    });
    if (label === q) {
      hits.push(wrap(100, "Exact label match"));
      continue;
    }
    if (entry.synonyms.some((s) => s.toLowerCase() === q)) {
      hits.push(wrap(95, "Synonym match"));
      continue;
    }
    if (label.startsWith(q) || entry.synonyms.some((s) => s.toLowerCase().startsWith(q))) {
      hits.push(wrap(80, "Starts with query"));
      continue;
    }
    if (label.includes(q) || entry.synonyms.some((s) => s.toLowerCase().includes(q))) {
      hits.push(wrap(60, "Partial match"));
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
}

export function searchAcrossDatasets(
  datasets: {
    id: string;
    label: string;
    entries: SearchEntry[];
  }[],
  query: string
): SearchHit[] {
  const hits = datasets.flatMap((d) =>
    searchDemoEntries(d.entries, query, {
      datasetId: d.id,
      datasetLabel: d.label,
    })
  );
  return hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.label.localeCompare(b.entry.label) ||
      (a.datasetId || "").localeCompare(b.datasetId || "")
  );
}

export function needsDisambiguation(hits: SearchHit[]): boolean {
  if (hits.length <= 1) return false;
  // Ambiguous if top hits are close in score (e.g. sickle cell vs HbSS)
  return hits.length > 1 && hits[0].score - hits[1].score < 20;
}

export function neighborhood(
  graph: GraphData,
  nodeId: string,
  options?: { maxEdges?: number; includeIds?: Set<string> }
): { nodes: GraphNode[]; edges: GraphEdge[]; truncated: boolean } {
  const maxEdges = options?.maxEdges ?? 12;
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  let all = graph.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );
  if (options?.includeIds?.size) {
    const preferred = all.filter(
      (e) =>
        options.includeIds!.has(e.id) ||
        options.includeIds!.has(e.source) ||
        options.includeIds!.has(e.target)
    );
    const rest = all.filter((e) => !preferred.includes(e));
    all = [...preferred, ...rest];
  }
  const ranked = [...all].sort((a, b) => {
    const score = (e: GraphEdge) => {
      let s = 0;
      if (options?.includeIds?.has(e.id)) s += 8;
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

export function pathNeighborhood(
  graph: GraphData,
  nodeIds: string[],
  edgeIds: string[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(graph.edges.map((e) => [e.id, e]));
  const edges = edgeIds.map((id) => edgeMap.get(id)).filter(Boolean) as GraphEdge[];
  const ids = new Set(nodeIds);
  edges.forEach((e) => {
    ids.add(e.source);
    ids.add(e.target);
  });
  return {
    nodes: [...ids].map((id) => nodeMap.get(id)!).filter(Boolean),
    edges,
  };
}

export function relationshipLabel(type: string): string {
  return type.replace(/_/g, " ");
}
