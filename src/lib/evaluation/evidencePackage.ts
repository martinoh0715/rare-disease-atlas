import { createHash } from "crypto";
import { findConnectingPaths } from "@/lib/evaluation/assets";
import type {
  EvaluationEvidencePackage,
  EvaluationEvidenceRecord,
} from "@/lib/evaluation/types";
import type { GraphData, GraphEdge, GraphNode } from "@/lib/graph";
import { relationshipStatusOf } from "@/lib/graph";
import type { AssetAssessment } from "@/lib/types";

function clean(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isUsefulPassage(text: string): boolean {
  const t = clean(text);
  if (t.length < 40) return false;
  if (/^(pmid|nct|http)/i.test(t) && t.length < 80) return false;
  return true;
}

function neighbors(graph: GraphData, id: string): GraphEdge[] {
  return graph.edges.filter((e) => e.source === id || e.target === id);
}

export { findConnectingPaths, listCandidateAssets } from "@/lib/evaluation/assets";

function pushEvidence(
  list: EvaluationEvidenceRecord[],
  seen: Set<string>,
  rec: EvaluationEvidenceRecord
) {
  if (seen.has(rec.evidence_id)) return;
  if (
    !isUsefulPassage(rec.supporting_passage) &&
    !rec.source_url &&
    !rec.limitations
  ) {
    return;
  }
  seen.add(rec.evidence_id);
  list.push(rec);
}

export function buildEvaluationEvidencePackage(options: {
  datasetId: string;
  graph: GraphData;
  diseaseNodeId: string;
  assetNodeId: string;
  researchObjective?: string;
  assetAssessments?: AssetAssessment[];
  maxEvidence?: number;
}): EvaluationEvidencePackage {
  const {
    datasetId,
    graph,
    diseaseNodeId,
    assetNodeId,
    researchObjective = "",
    assetAssessments = [],
    maxEvidence = 28,
  } = options;
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(graph.edges.map((e) => [e.id, e]));
  const disease = nodeMap.get(diseaseNodeId);
  const asset = nodeMap.get(assetNodeId);
  const assessment = assetAssessments.find((a) => a.asset_id === assetNodeId);

  if (!disease || disease.type !== "disease") {
    return emptyPackage(
      datasetId,
      diseaseNodeId,
      assetNodeId,
      researchObjective,
      "Target must be a disease or disease subgroup node."
    );
  }
  if (!asset && !assessment) {
    return emptyPackage(
      datasetId,
      diseaseNodeId,
      assetNodeId,
      researchObjective,
      "Selected research asset was not found in the curated graph or asset list."
    );
  }

  const connecting_paths = findConnectingPaths(
    graph,
    diseaseNodeId,
    assetNodeId
  );
  const pathEdgeIds = new Set(
    connecting_paths.flatMap((p) => p.map((s) => s.edge_id))
  );

  const contextIds = new Set<string>([diseaseNodeId, assetNodeId]);
  for (const e of neighbors(graph, diseaseNodeId)) {
    const other = e.source === diseaseNodeId ? e.target : e.source;
    const n = nodeMap.get(other);
    if (
      n &&
      [
        "gene",
        "variant",
        "allele",
        "genotype",
        "mechanism",
        "biological_process",
        "phenotype",
        "protein",
      ].includes(n.type)
    ) {
      contextIds.add(n.id);
      pathEdgeIds.add(e.id);
    }
  }
  for (const e of neighbors(graph, assetNodeId)) {
    pathEdgeIds.add(e.id);
    contextIds.add(e.source);
    contextIds.add(e.target);
  }

  const evidence: EvaluationEvidenceRecord[] = [];
  const seen = new Set<string>();
  const missing_information: string[] = [];

  for (const edgeId of pathEdgeIds) {
    const edge = edgeMap.get(edgeId);
    if (!edge) continue;
    // Curated hypotheses are not independent scientific evidence.
    if (relationshipStatusOf(edge) === "hypothesis") {
      missing_information.push(
        `Path edge ${edge.id} is a curated hypothesis, not independent evidence.`
      );
      continue;
    }
    const passage = clean(edge.evidence?.supporting_passage);
    const curatorPlain = clean(edge.plain_language);
    if (passage) {
      pushEvidence(evidence, seen, {
        evidence_id: `ev:${edge.id}:passage`,
        kind: "source_passage",
        edge_id: edge.id,
        source_url: edge.evidence?.source_url || null,
        supporting_passage: passage,
        publication_date: edge.evidence?.publication_date ?? null,
        retrieval_date: edge.evidence?.retrieval_date ?? null,
        evidence_type: edge.evidence?.evidence_type ?? null,
        genotype_context: edge.evidence?.genotype_context ?? null,
        population_context: edge.evidence?.population_context ?? null,
        species: edge.evidence?.species ?? null,
        experimental_context: edge.evidence?.experimental_context ?? null,
        limitations:
          clean(edge.evidence?.limitations || edge.limitations) || null,
        contradictory_evidence:
          clean(edge.evidence?.contradictory_evidence) || null,
        relationship_status: relationshipStatusOf(edge),
        claim_summary: curatorPlain || null,
        endpoint_labels: [
          nodeMap.get(edge.source)?.label,
          nodeMap.get(edge.target)?.label,
        ].filter(Boolean) as string[],
        is_curator_summary: false,
      });
    }
    if (curatorPlain && curatorPlain !== passage) {
      pushEvidence(evidence, seen, {
        evidence_id: `ev:${edge.id}:curator`,
        kind: "curator_summary",
        edge_id: edge.id,
        source_url: edge.evidence?.source_url || null,
        supporting_passage: curatorPlain,
        claim_summary: "Curator-written summary (not a verbatim abstract)",
        relationship_status: relationshipStatusOf(edge),
        is_curator_summary: true,
      });
    }
  }

  // Asset node / assessment records
  if (asset) {
    const bits = [
      clean(asset.plain_language),
      clean(asset.notes),
      clean(asset.access_info),
    ].filter(Boolean);
    if (bits.length) {
      pushEvidence(evidence, seen, {
        evidence_id: `ev:node:${asset.id}`,
        kind: "asset_record",
        node_id: asset.id,
        source_url: (asset.source_url as string | undefined) || null,
        title: asset.label,
        supporting_passage: bits.join(" | ").slice(0, 900),
        is_curator_summary: true,
        claim_summary: "Asset node record from curated dataset",
      });
    }
    if (typeof asset.abstract === "string" && isUsefulPassage(asset.abstract)) {
      pushEvidence(evidence, seen, {
        evidence_id: `ev:node:${asset.id}:abstract`,
        kind: "source_passage",
        node_id: asset.id,
        source_url: (asset.source_url as string | undefined) || null,
        title: asset.label,
        supporting_passage: clean(asset.abstract).slice(0, 1200),
        is_curator_summary: false,
        claim_summary: "Stored abstract text on asset/publication node",
      });
    }
  }

  if (assessment) {
    const packed = [
      assessment.description,
      `Access note: ${assessment.access}`,
      `Relevance: ${assessment.relevance_to_journey}`,
      `May be reusable: ${assessment.comparison.may_be_reusable.join("; ")}`,
      `What differs: ${assessment.comparison.what_differs.join("; ")}`,
      `Needs expert review: ${assessment.comparison.needs_expert_review.join("; ")}`,
      `Adaptation status: ${assessment.comparison.adaptation_status}`,
      `Validation question: ${assessment.comparison.validation_question}`,
    ]
      .map(clean)
      .filter(Boolean)
      .join(" | ");
    pushEvidence(evidence, seen, {
      evidence_id: `ev:assessment:${assessment.asset_id}`,
      kind: "asset_record",
      node_id: assessment.asset_id,
      source_url: assessment.source_url || null,
      title: assessment.title,
      supporting_passage: packed.slice(0, 1200),
      is_curator_summary: true,
      claim_summary:
        "Curated asset assessment (journey metadata; not a publication abstract)",
      genotype_context: assessment.designed_for.genotype || null,
      population_context: assessment.designed_for.population || null,
      species: assessment.designed_for.species || null,
    });
  }

  // Disease context notes
  const diseaseBits = [
    clean(disease.plain_language),
    disease.does_not ? `Does not: ${disease.does_not}` : "",
    disease.genotype_scope ? `Genotype scope: ${disease.genotype_scope}` : "",
  ].filter(isUsefulPassage);
  if (diseaseBits.length) {
    pushEvidence(evidence, seen, {
      evidence_id: `ev:node:${disease.id}`,
      kind: "curator_summary",
      node_id: disease.id,
      source_url: (disease.source_url as string | undefined) || null,
      supporting_passage: diseaseBits.join(" | ").slice(0, 800),
      is_curator_summary: true,
      claim_summary: "Disease context from curated node",
    });
  }

  const related_context_nodes = [...contextIds]
    .map((id) => nodeMap.get(id))
    .filter(Boolean)
    .filter((n) => (n as GraphNode).id !== diseaseNodeId && (n as GraphNode).id !== assetNodeId)
    .slice(0, 16)
    .map((n) => ({
      id: (n as GraphNode).id,
      type: (n as GraphNode).type,
      label: (n as GraphNode).label,
      note: clean((n as GraphNode).does_not || (n as GraphNode).notes) || undefined,
    }));

  const sourcePassages = evidence.filter(
    (e) => e.kind === "source_passage" && isUsefulPassage(e.supporting_passage)
  );
  if (!connecting_paths.length) {
    missing_information.push(
      "No short curated graph path was found between the disease and this asset."
    );
  }
  if (sourcePassages.length < 1) {
    missing_information.push(
      "No specific source passages were available on the disease–asset path."
    );
  }
  if (assessment && /not established|unknown|not claimed|no automatic/i.test(assessment.access + assessment.comparison.adaptation_status)) {
    missing_information.push(
      "Access permission, licensing, or collaboration willingness is not established in the stored records."
    );
  }

  const trimmed = evidence.slice(0, maxEvidence);
  const insufficient =
    sourcePassages.length < 1 &&
    !trimmed.some((e) => e.kind === "asset_record" && isUsefulPassage(e.supporting_passage));

  const evidence_version = createHash("sha256")
    .update(
      JSON.stringify({
        datasetId,
        diseaseNodeId,
        assetNodeId,
        ids: trimmed.map((e) => e.evidence_id).sort(),
        passages: trimmed.map((e) => e.supporting_passage),
      })
    )
    .digest("hex")
    .slice(0, 16);

  return {
    dataset_id: datasetId,
    disease_node_id: diseaseNodeId,
    asset_node_id: assetNodeId,
    research_objective: researchObjective.trim(),
    evidence_version,
    disease: {
      id: disease.id,
      label: disease.label,
      type: disease.type,
      plain_language: clean(disease.plain_language) || undefined,
      does_not: clean(disease.does_not) || undefined,
      genotype_scope: clean(disease.genotype_scope) || undefined,
    },
    asset: {
      id: asset?.id || assessment!.asset_id,
      label: assessment?.title || asset?.label || assetNodeId,
      type: asset?.type || assessment?.asset_kind || "research_asset",
      plain_language: clean(asset?.plain_language) || undefined,
      access_info: clean(assessment?.access || asset?.access_info) || undefined,
      source_url:
        assessment?.source_url ||
        (asset?.source_url as string | undefined) ||
        null,
      asset_kind: assessment?.asset_kind,
      designed_for: assessment?.designed_for,
      curated_relevance: assessment?.relevance_to_journey,
      curated_may_be_reusable: assessment?.comparison.may_be_reusable,
      curated_what_differs: assessment?.comparison.what_differs,
      curated_needs_expert_review: assessment?.comparison.needs_expert_review,
      curated_adaptation_status: assessment?.comparison.adaptation_status,
    },
    connecting_paths,
    related_context_nodes,
    evidence: trimmed,
    missing_information,
    insufficient,
    insufficient_reason: insufficient
      ? "Stored evidence is too thin to assess reuse: missing specific source passages and usable asset records on the disease–asset path."
      : undefined,
  };
}

function emptyPackage(
  datasetId: string,
  diseaseNodeId: string,
  assetNodeId: string,
  researchObjective: string,
  reason: string
): EvaluationEvidencePackage {
  return {
    dataset_id: datasetId,
    disease_node_id: diseaseNodeId,
    asset_node_id: assetNodeId,
    research_objective: researchObjective,
    evidence_version: "invalid",
    disease: { id: diseaseNodeId, label: diseaseNodeId, type: "unknown" },
    asset: { id: assetNodeId, label: assetNodeId, type: "unknown" },
    connecting_paths: [],
    related_context_nodes: [],
    evidence: [],
    missing_information: [reason],
    insufficient: true,
    insufficient_reason: reason,
  };
}
