import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import type { GraphData } from "@/lib/graph";
import { evaluateResearchOpportunity } from "@/lib/evaluation/generate";
import type { AssetAssessment, DemoExperience } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  datasetId?: string;
  diseaseNodeId?: string;
  assetNodeId?: string;
  researchObjective?: string;
  refresh?: boolean;
};

const rateMap = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 8;
  const cur = rateMap.get(ip);
  if (!cur || now > cur.reset) {
    rateMap.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}

async function loadDataset(datasetId: string): Promise<{
  graph: GraphData;
  assessments: AssetAssessment[];
} | null> {
  const allowed = new Set(["hbb", "arid1b", "gata6", "odc1"]);
  if (!allowed.has(datasetId)) return null;
  try {
    const base = path.join(process.cwd(), "public", "data", datasetId);
    const graph = JSON.parse(
      await readFile(path.join(base, "curated-graph.json"), "utf8")
    ) as GraphData;
    const demo = JSON.parse(
      await readFile(path.join(base, "demo-experience.json"), "utf8")
    ) as DemoExperience;
    return { graph, assessments: demo.asset_assessments || [] };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(ip)) {
    return NextResponse.json(
      {
        status: "error",
        assessment: null,
        message: "Too many evaluation requests. Please wait and try again.",
        disease_node_id: "",
        asset_node_id: "",
        research_objective: "",
        evidence_ids: [],
      },
      { status: 429 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      {
        status: "error",
        assessment: null,
        message: "Invalid JSON body.",
        disease_node_id: "",
        asset_node_id: "",
        research_objective: "",
        evidence_ids: [],
      },
      { status: 400 }
    );
  }

  const datasetId = (body.datasetId || "").trim();
  const diseaseNodeId = (body.diseaseNodeId || "").trim();
  const assetNodeId = (body.assetNodeId || "").trim();
  const researchObjective = (body.researchObjective || "").slice(0, 500);

  if (!datasetId || !diseaseNodeId || !assetNodeId) {
    return NextResponse.json(
      {
        status: "error",
        assessment: null,
        message: "datasetId, diseaseNodeId, and assetNodeId are required.",
        disease_node_id: diseaseNodeId,
        asset_node_id: assetNodeId,
        research_objective: researchObjective,
        evidence_ids: [],
      },
      { status: 400 }
    );
  }

  const loaded = await loadDataset(datasetId);
  if (!loaded) {
    return NextResponse.json(
      {
        status: "error",
        assessment: null,
        message: `Unknown or unloadable dataset: ${datasetId}`,
        disease_node_id: diseaseNodeId,
        asset_node_id: assetNodeId,
        research_objective: researchObjective,
        evidence_ids: [],
      },
      { status: 404 }
    );
  }

  const result = await evaluateResearchOpportunity({
    datasetId,
    graph: loaded.graph,
    diseaseNodeId,
    assetNodeId,
    researchObjective,
    assetAssessments: loaded.assessments,
    refresh: Boolean(body.refresh),
    signal: req.signal,
  });

  const http =
    result.status === "unavailable" || result.status === "disabled"
      ? 503
      : result.status === "error"
        ? 502
        : 200;

  return NextResponse.json(result, { status: http });
}
