import type { GraphData, GraphEdge, GraphNode } from "@/lib/graph";
import { relationshipStatusOf, relationshipLabel } from "@/lib/graph";
import type { AssetAssessment } from "@/lib/types";
import type { PathStep } from "@/lib/evaluation/types";

const ASSET_TYPES = new Set([
  "clinical_study",
  "research_asset",
  "publication",
  "organization",
  "intervention",
]);

/** Default hop budget covers the curated HbF→BCL11A→exa-cel→study bridge (5 hops). */
export const EVALUATION_PATH_MAX_HOPS = 5;

/**
 * Shortest curated paths from disease to asset.
 * Traversal is undirected for discovery; each PathStep keeps the edge's stored
 * source→target direction for explanations.
 */
export function findConnectingPaths(
  graph: GraphData,
  fromId: string,
  toId: string,
  maxHops = EVALUATION_PATH_MAX_HOPS,
  maxPaths = 4
): PathStep[][] {
  if (fromId === toId) return [];
  const adj = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e);
    adj.get(e.target)!.push(e);
  }
  const paths: PathStep[][] = [];
  const queue: { node: string; path: PathStep[] }[] = [
    { node: fromId, path: [] },
  ];
  const visitedDepth = new Map<string, number>([[fromId, 0]]);

  while (queue.length && paths.length < maxPaths) {
    const { node, path } = queue.shift()!;
    if (path.length >= maxHops) continue;
    for (const edge of adj.get(node) || []) {
      const next = edge.source === node ? edge.target : edge.source;
      const step: PathStep = {
        edge_id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        relationship_status: relationshipStatusOf(edge),
      };
      const nextPath = [...path, step];
      if (next === toId) {
        paths.push(nextPath);
        continue;
      }
      const depth = nextPath.length;
      const prev = visitedDepth.get(next);
      if (prev !== undefined && prev < depth) continue;
      visitedDepth.set(next, depth);
      queue.push({ node: next, path: nextPath });
    }
  }
  // Prefer paths with fewer hypothesis edges, then shorter paths.
  return paths.sort((a, b) => {
    const hyp = (p: PathStep[]) =>
      p.filter((s) => s.relationship_status === "hypothesis").length;
    const dh = hyp(a) - hyp(b);
    if (dh !== 0) return dh;
    return a.length - b.length;
  });
}

/** Plain-language explanation of a stored multi-hop path (edge directions preserved). */
export function explainConnectingPath(
  path: PathStep[],
  nodeMap: Map<string, GraphNode>,
  diseaseId: string,
  assetId: string
): string {
  if (!path.length) {
    return "No curated multi-hop path between this disease and research asset was found within the evaluation hop budget. Visual proximity on the graph does not establish a relationship.";
  }
  const labelOf = (id: string) => nodeMap.get(id)?.label || id;
  const parts: string[] = [];
  let cursor = diseaseId;
  for (const step of path) {
    const forward = step.source === cursor;
    const from = forward ? step.source : step.target;
    const to = forward ? step.target : step.source;
    const status =
      step.relationship_status === "hypothesis"
        ? " (curated hypothesis — not independent evidence)"
        : step.relationship_status === "unreviewed"
          ? " (unreviewed relationship)"
          : "";
    const directionNote = forward
      ? ""
      : " [shown against stored edge direction for discovery]";
    parts.push(
      `${labelOf(from)} —${relationshipLabel(step.type)}→ ${labelOf(to)}${status}${directionNote}`
    );
    cursor = to;
  }
  const hypCount = path.filter(
    (s) => s.relationship_status === "hypothesis"
  ).length;
  const footer =
    hypCount > 0
      ? ` Supported path ends before any hypothesis-only step for evidence packing; ${hypCount} hypothesis edge(s) on this chain are labeled and not treated as scientific proof.`
      : ` This ${path.length}-hop curated path connects ${labelOf(diseaseId)} to ${labelOf(assetId)}.`;
  return `${parts.join("; ")}.${footer}`;
}

export function listCandidateAssets(
  graph: GraphData,
  diseaseId: string,
  assessments: AssetAssessment[]
): {
  id: string;
  label: string;
  type: string;
  kind: string;
  connectionNote: string;
  hasPath: boolean;
}[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const out = new Map<
    string,
    {
      id: string;
      label: string;
      type: string;
      kind: string;
      connectionNote: string;
      hasPath: boolean;
    }
  >();

  for (const a of assessments) {
    const n = nodeMap.get(a.asset_id);
    const paths = findConnectingPaths(graph, diseaseId, a.asset_id);
    const explanation = paths.length
      ? explainConnectingPath(paths[0], nodeMap, diseaseId, a.asset_id)
      : `No curated path to this disease was found within ${EVALUATION_PATH_MAX_HOPS} hops.`;
    out.set(a.asset_id, {
      id: a.asset_id,
      label: a.title || n?.label || a.asset_id,
      type: n?.type || a.asset_kind,
      kind: a.asset_kind,
      connectionNote: `${explanation} ${a.relevance_to_journey}`,
      hasPath: paths.length > 0,
    });
  }

  for (const n of graph.nodes) {
    if (!ASSET_TYPES.has(n.type) || out.has(n.id)) continue;
    const paths = findConnectingPaths(graph, diseaseId, n.id);
    if (!paths.length) continue;
    out.set(n.id, {
      id: n.id,
      label: n.label,
      type: n.type,
      kind: n.type,
      connectionNote: explainConnectingPath(
        paths[0],
        nodeMap,
        diseaseId,
        n.id
      ),
      hasPath: true,
    });
  }

  return [...out.values()].sort((a, b) => {
    if (a.hasPath !== b.hasPath) return a.hasPath ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function listPartnerOrganizations(
  graph: GraphData,
  diseaseId: string,
  assessments: AssetAssessment[]
): {
  id: string;
  label: string;
  diseaseScope: string;
  sourceUrl: string | null;
  relevance: string;
  contactPage: string | null;
  willingnessUnknown: boolean;
}[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const partnerKinds = new Set([
    "patient_organization",
    "patient_registry",
    "research_center",
    "research_consortium",
  ]);
  const out: {
    id: string;
    label: string;
    diseaseScope: string;
    sourceUrl: string | null;
    relevance: string;
    contactPage: string | null;
    willingnessUnknown: boolean;
  }[] = [];

  for (const a of assessments) {
    if (!partnerKinds.has(a.asset_kind) && nodeMap.get(a.asset_id)?.type !== "organization") {
      continue;
    }
    const n = nodeMap.get(a.asset_id);
    const paths = findConnectingPaths(graph, diseaseId, a.asset_id);
    // Include orgs on a path OR explicitly assessed for the journey.
    if (!paths.length && a.asset_kind !== "patient_organization" && a.asset_kind !== "patient_registry") {
      continue;
    }
    out.push({
      id: a.asset_id,
      label: a.title || n?.label || a.asset_id,
      diseaseScope:
        a.designed_for.disease ||
        n?.plain_language ||
        "Disease scope not specified in curated record",
      sourceUrl: a.source_url || (n?.source_url as string | undefined) || null,
      relevance: a.relevance_to_journey || a.description,
      contactPage: a.source_url || (n?.source_url as string | undefined) || null,
      willingnessUnknown: /not established|not claimed|unknown|willingness/i.test(
        `${a.access} ${a.comparison.adaptation_status}`
      ),
    });
  }

  // Graph organizations not already listed
  for (const n of graph.nodes) {
    if (n.type !== "organization" || out.some((o) => o.id === n.id)) continue;
    const paths = findConnectingPaths(graph, diseaseId, n.id);
    if (!paths.length) continue;
    out.push({
      id: n.id,
      label: n.label,
      diseaseScope: n.plain_language || "See source page for community scope",
      sourceUrl: (n.source_url as string | undefined) || null,
      relevance: explainConnectingPath(paths[0], nodeMap, diseaseId, n.id),
      contactPage: (n.source_url as string | undefined) || null,
      willingnessUnknown: true,
    });
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}
