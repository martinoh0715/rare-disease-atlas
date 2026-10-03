import type { GraphEdge, GraphNode } from "@/lib/graph";

export type SourceCard = {
  title: string;
  organization: string;
  summary: string;
  caveat: string | null;
  url: string | null;
};

function orgFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("pubmed.ncbi.nlm.nih.gov") || u.includes("nejm.org"))
    return "PubMed / peer-reviewed literature";
  if (u.includes("clinicaltrials.gov")) return "ClinicalTrials.gov";
  if (u.includes("jax.org")) return "The Jackson Laboratory";
  if (u.includes("sicklecelldisease.org"))
    return "Sickle Cell Disease Association of America";
  if (u.includes("thalassemia.org") || u.includes("web.archive.org"))
    return "Cooley's Anemia Foundation";
  if (u.includes("omim.org")) return "OMIM";
  if (u.includes("clinvar") || u.includes("ncbi.nlm.nih.gov/clinvar"))
    return "ClinVar / NCBI";
  if (u.includes("cdc.gov")) return "CDC";
  if (u.includes("hpo.jax.org")) return "Human Phenotype Ontology";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function truncate(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** One short takeaway + optional caveat for the Summary panel. */
export function importantSummaryForEdge(
  edge: GraphEdge,
  plainFallback?: string
): { summary: string; caveat: string | null } {
  const summary = truncate(
    edge.plain_language ||
      plainFallback ||
      edge.evidence?.supporting_passage ||
      "No short summary is available for this link yet."
  );
  const lim = edge.evidence?.limitations || edge.limitations || null;
  const caveat = lim ? truncate(String(lim), 120) : null;
  return { summary, caveat };
}

export function sourceCardForEdge(
  edge: GraphEdge,
  nodeMap: Map<string, GraphNode>,
  plainFallback?: string
): SourceCard {
  const ev = edge.evidence;
  const url = ev?.source_url || null;
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);

  // Prefer the evidence-bearing entity — never a terse "A ↔ B" connection name.
  let title =
    (sourceNode?.type === "publication" && sourceNode.label) ||
    (targetNode?.type === "publication" && targetNode.label) ||
    (sourceNode?.type === "clinical_study" && sourceNode.label) ||
    (targetNode?.type === "clinical_study" && targetNode.label) ||
    (sourceNode?.type === "intervention" && sourceNode.label) ||
    (targetNode?.type === "intervention" && targetNode.label) ||
    (sourceNode?.type === "organization" && sourceNode.label) ||
    (targetNode?.type === "organization" && targetNode.label) ||
    (sourceNode?.type === "research_asset" && sourceNode.label) ||
    (targetNode?.type === "research_asset" && targetNode.label) ||
    null;

  if (!title && url?.includes("pubmed")) {
    title = "Publication supporting this link";
  }
  if (!title) {
    title =
      orgFromUrl(url) ||
      sourceNode?.label ||
      targetNode?.label ||
      "Sourced reference";
  }

  const organization =
    orgFromUrl(url) ||
    (sourceNode?.type === "organization" && sourceNode.label) ||
    (targetNode?.type === "organization" && targetNode.label) ||
    "Source organization not identified";

  const { summary, caveat } = importantSummaryForEdge(edge, plainFallback);

  return { title, organization, summary, caveat, url };
}
