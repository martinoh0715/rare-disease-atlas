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

function displayMeta(
  nodeMap: Map<string, GraphNode>,
  edge?: GraphEdge,
  node?: GraphNode | null
): { display_title?: string; display_identifier?: string; title?: string } {
  const n =
    node ||
    (edge
      ? nodeMap.get(edge.source)?.type === "publication" ||
        nodeMap.get(edge.source)?.type === "clinical_study"
        ? nodeMap.get(edge.source)
        : nodeMap.get(edge.target)?.type === "publication" ||
            nodeMap.get(edge.target)?.type === "clinical_study"
          ? nodeMap.get(edge.target)
          : nodeMap.get(edge.source)
      : null);
  if (!n) return {};
  const pmid = (n.pmid as string | undefined) || undefined;
  const nct =
    (n.nct_id as string | undefined) ||
    (n.id.startsWith("nct:") ? n.id.slice(4) : undefined);
  const official = (n.official_title as string | undefined) || undefined;
  return {
    title: official || n.label,
    display_title: official || n.label,
    display_identifier: pmid
      ? `PMID:${pmid}`
      : nct
        ? `NCT${nct.replace(/^NCT/i, "")}`
        : n.id,
  };
}

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

function packageMentionsSpecificProtocolDetail(
  evidence: EvaluationEvidenceRecord[]
): {
  hasEligibilityDetail: boolean;
  hasEndpointDetail: boolean;
} {
  const text = evidence.map((e) => e.supporting_passage).join("\n");
  // Require protocol-style eligibility definitions — not bare “eligibility criteria”
  // mentions, age-band journey notes, or efficacy result windows.
  const hasEligibilityDetail =
    /\b(inclusion|exclusion)\s+criteria\b[\s\S]{0,120}\b(must|required|at least|history of|diagnosed)\b/i.test(
      text
    ) ||
    /\b(history of|experienced)\s+(at least\s+)?\d+\s+(severe\s+)?(vocs?|vaso-occlusive crises)\b/i.test(
      text
    ) ||
    /\beligible if\b[\s\S]{0,80}\d+/i.test(text);
  // Protocol endpoint specifications — not “12 consecutive months” efficacy results alone.
  const hasEndpointDetail =
    /\b(primary|secondary)\s+(endpoint|outcome)\b[\s\S]{0,160}\b(defined|definition|measured|assessed as)\b/i.test(
      text
    ) ||
    /\bendpoint\s+definition\b/i.test(text) ||
    /\b(outcome|endpoint)\s+measured\s+as\b/i.test(text) ||
    /\btransfusion independence\s+defined\b/i.test(text);
  return { hasEligibilityDetail, hasEndpointDetail };
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
    const meta = displayMeta(nodeMap, edge);
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
        title: meta.title,
        display_title: meta.display_title,
        display_identifier: meta.display_identifier,
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
        title: meta.title,
        display_title: meta.display_title,
        display_identifier: meta.display_identifier,
        is_curator_summary: true,
      });
    }
  }

  // Pull publication/study abstracts and main findings for nodes on the path.
  for (const id of contextIds) {
    const n = nodeMap.get(id);
    if (!n) continue;
    if (!["publication", "clinical_study"].includes(n.type)) continue;
    const meta = displayMeta(nodeMap, undefined, n);
    if (typeof n.abstract === "string" && isUsefulPassage(n.abstract)) {
      pushEvidence(evidence, seen, {
        evidence_id: `ev:node:${n.id}:abstract`,
        kind: "source_passage",
        node_id: n.id,
        source_url: (n.source_url as string | undefined) || null,
        title: meta.title,
        display_title: meta.display_title,
        display_identifier: meta.display_identifier,
        supporting_passage: clean(n.abstract).slice(0, 1400),
        publication_date: (n.pubdate as string | undefined) || null,
        retrieval_date: (n.retrieval_date as string | undefined) || null,
        is_curator_summary: false,
        claim_summary: "Stored abstract on publication/study node",
      });
    }
    const findings = n.main_findings;
    if (Array.isArray(findings)) {
      const joined = findings.map((f) => clean(String(f))).filter(Boolean).join(" | ");
      if (isUsefulPassage(joined)) {
        pushEvidence(evidence, seen, {
          evidence_id: `ev:node:${n.id}:main_findings`,
          kind: "source_passage",
          node_id: n.id,
          source_url: (n.source_url as string | undefined) || null,
          title: meta.title,
          display_title: meta.display_title,
          display_identifier: meta.display_identifier,
          supporting_passage: joined.slice(0, 1200),
          is_curator_summary: false,
          claim_summary: "Stored main_findings on publication node",
        });
      }
    }
  }

  // Asset node / assessment records
  if (asset) {
    const bits = [
      clean(asset.plain_language),
      clean(asset.notes),
      clean(asset.access_info),
    ].filter(Boolean);
    const assetMeta = displayMeta(nodeMap, undefined, asset);
    if (bits.length) {
      pushEvidence(evidence, seen, {
        evidence_id: `ev:node:${asset.id}`,
        kind: "asset_record",
        node_id: asset.id,
        source_url: (asset.source_url as string | undefined) || null,
        title: assetMeta.title || asset.label,
        display_title: assetMeta.display_title || asset.label,
        display_identifier: assetMeta.display_identifier,
        supporting_passage: bits.join(" | ").slice(0, 900),
        is_curator_summary: true,
        claim_summary: "Asset node record from curated dataset",
      });
    }
  }

  if (assessment) {
    const packed = [
      assessment.description,
      `Access note: ${assessment.access}`,
      `Relevance: ${assessment.relevance_to_journey}`,
      `May be reusable (high-level journey note, not protocol text): ${assessment.comparison.may_be_reusable.join("; ")}`,
      `What differs: ${assessment.comparison.what_differs.join("; ")}`,
      `Needs expert review: ${assessment.comparison.needs_expert_review.join("; ")}`,
      `Adaptation status: ${assessment.comparison.adaptation_status}`,
      `Validation question: ${assessment.comparison.validation_question}`,
      `Designed for disease: ${assessment.designed_for.disease || "(unspecified)"}`,
      `Designed for genotype note: ${assessment.designed_for.genotype || "(unspecified)"}`,
      `Designed for population note: ${assessment.designed_for.population || "(unspecified)"}`,
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
      display_title: assessment.title,
      display_identifier: assessment.asset_id.startsWith("nct:")
        ? assessment.asset_id.slice(4)
        : assessment.asset_id,
      supporting_passage: packed.slice(0, 1400),
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
  if (
    assessment &&
    /not established|unknown|not claimed|no automatic|does not grant access/i.test(
      assessment.access + " " + assessment.comparison.adaptation_status
    )
  ) {
    missing_information.push(
      "Access permission, licensing, or collaboration willingness is not established in the stored records."
    );
  }

  const detailFlags = packageMentionsSpecificProtocolDetail(evidence);
  if (!detailFlags.hasEligibilityDetail) {
    missing_information.push(
      "Specific eligibility criteria text (inclusion/exclusion definitions, numeric VOC history thresholds, genotype rules) is not present in the stored evidence package—only high-level mentions."
    );
  }
  if (!detailFlags.hasEndpointDetail) {
    missing_information.push(
      "Specific outcome/endpoint definitions from the protocol are not present as reusable measurement specifications in the stored evidence package."
    );
  }
  if (
    /natural[- ]history|observational|registry/i.test(researchObjective) &&
    /clinical_study|study_protocol|intervention/i.test(
      asset?.type || assessment?.asset_kind || ""
    )
  ) {
    missing_information.push(
      "Objective appears observational/natural-history oriented while the asset is an interventional study record; purpose, treatment exposure, and outcome interpretation differences need explicit review."
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
        missing: missing_information,
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
