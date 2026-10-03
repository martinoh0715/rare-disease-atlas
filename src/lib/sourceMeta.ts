import type { GraphEdge, GraphNode } from "@/lib/graph";

export type SourceCard = {
  title: string;
  organization: string;
  linkLabel: string;
  url: string | null;
};

export type EdgeSummary = {
  takeaway: string;
  abstract: string | null;
  findings: string[];
  caveat: string | null;
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

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function evidenceNode(
  edge: GraphEdge,
  nodeMap: Map<string, GraphNode>
): GraphNode | null {
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  const rank = (n?: GraphNode | null) => {
    if (!n) return -1;
    switch (n.type) {
      case "publication":
        return 5;
      case "clinical_study":
        return 4;
      case "research_asset":
        return 3;
      case "organization":
        return 2;
      case "intervention":
        return 1;
      default:
        return 0;
    }
  };
  return rank(sourceNode) >= rank(targetNode)
    ? sourceNode || targetNode || null
    : targetNode || sourceNode || null;
}

export function sourceCardForEdge(
  edge: GraphEdge,
  nodeMap: Map<string, GraphNode>
): SourceCard {
  const ev = edge.evidence;
  const url = ev?.source_url || null;
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  const primary = evidenceNode(edge, nodeMap);

  let title =
    (sourceNode?.type === "publication" && sourceNode.label) ||
    (targetNode?.type === "publication" && targetNode.label) ||
    (sourceNode?.type === "clinical_study" &&
      ((sourceNode.official_title as string | undefined) || sourceNode.label)) ||
    (targetNode?.type === "clinical_study" &&
      ((targetNode.official_title as string | undefined) || targetNode.label)) ||
    primary?.label ||
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

  const isArticleLike =
    primary?.type === "publication" ||
    primary?.type === "clinical_study" ||
    Boolean(url && (url.includes("pubmed") || url.includes("nejm") || url.includes("clinicaltrials")));

  return {
    title: String(title),
    organization,
    linkLabel: isArticleLike ? String(title) : "Open source page",
    url,
  };
}

export function importantSummaryForEdge(
  edge: GraphEdge,
  nodeMap: Map<string, GraphNode>,
  plainFallback?: string
): EdgeSummary {
  const primary = evidenceNode(edge, nodeMap);
  const takeaway = clean(
    edge.plain_language ||
      plainFallback ||
      edge.evidence?.supporting_passage ||
      "No short summary is available for this link yet."
  );

  const abstractRaw =
    (typeof primary?.abstract === "string" && primary.abstract) ||
    (typeof primary?.plain_language === "string" &&
      ["publication", "clinical_study", "intervention", "research_asset"].includes(
        primary.type
      ) &&
      primary.plain_language) ||
    null;

  // Prefer the full curated abstract; fall back to a longer evidence passage.
  const abstract = abstractRaw
    ? clean(abstractRaw)
    : edge.evidence?.supporting_passage
      ? clean(edge.evidence.supporting_passage)
      : null;

  const findingsFromNode = Array.isArray(primary?.main_findings)
    ? (primary!.main_findings as string[]).map((f) => clean(String(f)))
    : [];

  const passage = edge.evidence?.supporting_passage
    ? clean(edge.evidence.supporting_passage)
    : null;

  const findings =
    findingsFromNode.length > 0
      ? findingsFromNode
      : passage && passage !== takeaway && passage !== abstract
        ? [passage]
        : [];

  const lim = edge.evidence?.limitations || edge.limitations || null;
  const caveat = lim ? clean(String(lim)) : null;

  return { takeaway, abstract, findings, caveat };
}
