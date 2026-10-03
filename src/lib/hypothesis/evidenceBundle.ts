import { createHash } from "crypto";
import type { GraphData, GraphEdge, GraphNode } from "@/lib/graph";
import { relationshipStatusOf } from "@/lib/graph";
import type { EvidenceBundle, EvidenceRecord } from "@/lib/hypothesis/types";

function clean(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isPassageUseful(passage: string): boolean {
  const t = clean(passage);
  if (t.length < 40) return false;
  // Titles / keyword-only stubs are insufficient.
  if (/^(pmid|nct|http)/i.test(t) && t.length < 80) return false;
  return true;
}

function neighborEdgeScore(edge: GraphEdge, selectedId: string): number {
  let s = 0;
  if (edge.source === selectedId || edge.target === selectedId) s += 5;
  const rs = relationshipStatusOf(edge);
  if (rs === "established") s += 3;
  if (rs === "hypothesis") s += 1;
  if (edge.evidence?.supporting_passage) s += 2;
  if (edge.evidence?.contradictory_evidence) s += 2;
  if (edge.evidence?.limitations) s += 1;
  if (edge.evidence?.source_url) s += 1;
  return s;
}

/**
 * Build an evidence bundle from the curated graph around a selected entity.
 * Prefers specific passages; does not invent citations.
 */
export function buildEvidenceBundle(options: {
  datasetId: string;
  graph: GraphData;
  selectedNodeId: string;
  researchQuestion?: string;
  maxEvidence?: number;
}): EvidenceBundle {
  const {
    datasetId,
    graph,
    selectedNodeId,
    researchQuestion = "",
    maxEvidence = 24,
  } = options;
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const selected = nodeMap.get(selectedNodeId);
  if (!selected) {
    return {
      dataset_id: datasetId,
      selected_node_id: selectedNodeId,
      research_question: researchQuestion,
      evidence_version: "missing-node",
      nodes: [],
      evidence: [],
      established_edges: [],
      insufficient: true,
      insufficient_reason: `Selected node ${selectedNodeId} is not in the curated graph.`,
    };
  }

  const oneHop = graph.edges
    .filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
    .sort(
      (a, b) =>
        neighborEdgeScore(b, selectedNodeId) -
        neighborEdgeScore(a, selectedNodeId)
    );

  const neighborIds = new Set<string>([selectedNodeId]);
  oneHop.forEach((e) => {
    neighborIds.add(e.source);
    neighborIds.add(e.target);
  });

  // Light two-hop for mechanisms / publications / assets linked to neighbors.
  const twoHop = graph.edges.filter((e) => {
    if (neighborIds.has(e.source) && !neighborIds.has(e.target)) {
      const t = nodeMap.get(e.target);
      return (
        t &&
        [
          "mechanism",
          "biological_process",
          "publication",
          "clinical_study",
          "research_asset",
          "organization",
          "intervention",
          "phenotype",
          "hypothesis",
        ].includes(t.type)
      );
    }
    if (neighborIds.has(e.target) && !neighborIds.has(e.source)) {
      const s = nodeMap.get(e.source);
      return (
        s &&
        [
          "mechanism",
          "biological_process",
          "publication",
          "clinical_study",
          "research_asset",
          "organization",
          "intervention",
          "phenotype",
          "hypothesis",
        ].includes(s.type)
      );
    }
    return false;
  });

  const candidateEdges = [...oneHop, ...twoHop];
  const evidence: EvidenceRecord[] = [];
  const seen = new Set<string>();

  for (const edge of candidateEdges) {
    const passage = clean(edge.evidence?.supporting_passage);
    const limitations = clean(edge.evidence?.limitations || edge.limitations);
    const counter = clean(edge.evidence?.contradictory_evidence);
    const url = edge.evidence?.source_url || null;
    const useful =
      isPassageUseful(passage) ||
      isPassageUseful(limitations) ||
      isPassageUseful(counter);
    if (!useful && !url) continue;

    const evidenceId = `ev:${edge.id}`;
    if (seen.has(evidenceId)) continue;
    seen.add(evidenceId);

    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    evidence.push({
      evidence_id: evidenceId,
      edge_id: edge.id,
      source_url: url,
      supporting_passage: passage || limitations || counter || "(no passage)",
      publication_date: edge.evidence?.publication_date ?? null,
      retrieval_date: edge.evidence?.retrieval_date ?? null,
      evidence_type: edge.evidence?.evidence_type ?? null,
      genotype_context: edge.evidence?.genotype_context ?? null,
      population_context: edge.evidence?.population_context ?? null,
      species: edge.evidence?.species ?? null,
      experimental_context: edge.evidence?.experimental_context ?? null,
      limitations: limitations || null,
      contradictory_evidence: counter || null,
      relationship_status: relationshipStatusOf(edge),
      claim_summary: clean(edge.plain_language) || null,
      endpoint_labels: [src?.label, tgt?.label].filter(Boolean) as string[],
    });
    if (evidence.length >= maxEvidence) break;
  }

  // Also pull node-level notes / does_not / uncertainties as context records.
  for (const id of neighborIds) {
    const n = nodeMap.get(id);
    if (!n) continue;
    const bits = [
      clean(n.plain_language),
      clean(n.notes),
      clean(n.does_not ? `Does not: ${n.does_not}` : ""),
      ...(n.uncertainties || []).map((u) => clean(String(u))),
    ].filter((t) => isPassageUseful(t));
    if (!bits.length) continue;
    const evidenceId = `ev:node:${n.id}`;
    if (seen.has(evidenceId)) continue;
    seen.add(evidenceId);
    evidence.push({
      evidence_id: evidenceId,
      node_id: n.id,
      source_url: (n.source_url as string | undefined) || null,
      supporting_passage: bits.join(" | ").slice(0, 800),
      limitations: null,
      contradictory_evidence: null,
      claim_summary: n.label,
      endpoint_labels: [n.label],
    });
    if (evidence.length >= maxEvidence) break;
  }

  const nodes = [...neighborIds]
    .map((id) => nodeMap.get(id))
    .filter(Boolean)
    .map((n) => ({
      id: (n as GraphNode).id,
      type: (n as GraphNode).type,
      label: (n as GraphNode).label,
      notes: clean((n as GraphNode).does_not || (n as GraphNode).notes) || undefined,
    }));

  const established_edges = graph.edges
    .filter(
      (e) =>
        neighborIds.has(e.source) &&
        neighborIds.has(e.target) &&
        relationshipStatusOf(e) === "established"
    )
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      relationship_status: "established",
    }));

  const usefulPassages = evidence.filter((e) =>
    isPassageUseful(e.supporting_passage)
  );
  const insufficient = usefulPassages.length < 2;
  const evidence_version = createHash("sha256")
    .update(
      JSON.stringify({
        datasetId,
        selectedNodeId,
        ids: evidence.map((e) => e.evidence_id).sort(),
        passages: evidence.map((e) => e.supporting_passage),
      })
    )
    .digest("hex")
    .slice(0, 16);

  return {
    dataset_id: datasetId,
    selected_node_id: selectedNodeId,
    research_question: researchQuestion.trim(),
    evidence_version,
    nodes,
    evidence,
    established_edges,
    insufficient,
    insufficient_reason: insufficient
      ? "Fewer than two specific evidence passages are available around this entity. Titles or keyword-only stubs are not enough to propose a connection."
      : undefined,
  };
}
