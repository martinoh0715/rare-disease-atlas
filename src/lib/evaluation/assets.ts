import type { GraphData, GraphEdge } from "@/lib/graph";
import { relationshipStatusOf } from "@/lib/graph";
import type { AssetAssessment } from "@/lib/types";
import type { PathStep } from "@/lib/evaluation/types";

const ASSET_TYPES = new Set([
  "clinical_study",
  "research_asset",
  "publication",
  "organization",
  "intervention",
]);

/** Shortest paths (≤3 hops) from disease to asset. Client-safe. */
export function findConnectingPaths(
  graph: GraphData,
  fromId: string,
  toId: string,
  maxHops = 3,
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
  return paths;
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
    out.set(a.asset_id, {
      id: a.asset_id,
      label: a.title || n?.label || a.asset_id,
      type: n?.type || a.asset_kind,
      kind: a.asset_kind,
      connectionNote:
        paths.length > 0
          ? `Connected in curated graph (${paths[0].length} hop${
              paths[0].length === 1 ? "" : "s"
            }). ${a.relevance_to_journey}`
          : `Listed as a journey asset; no short curated path to this disease was found. ${a.relevance_to_journey}`,
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
      connectionNote: `Connected in curated graph (${paths[0].length} hop${
        paths[0].length === 1 ? "" : "s"
      }).`,
      hasPath: true,
    });
  }

  return [...out.values()].sort((a, b) => {
    if (a.hasPath !== b.hasPath) return a.hasPath ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}
