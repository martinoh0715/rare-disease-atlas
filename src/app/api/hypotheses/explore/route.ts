import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import type { GraphData } from "@/lib/graph";
import { exploreHypotheses } from "@/lib/hypothesis/generate";

export const runtime = "nodejs";

type Body = {
  datasetId?: string;
  selectedNodeId?: string;
  researchQuestion?: string;
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

async function loadCuratedGraph(datasetId: string): Promise<GraphData | null> {
  const allowed = new Set(["hbb", "arid1b", "gata6", "odc1"]);
  if (!allowed.has(datasetId)) return null;
  const file = path.join(
    process.cwd(),
    "public",
    "data",
    datasetId,
    "curated-graph.json"
  );
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as GraphData;
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
        hypotheses: [],
        held: [],
        message: "Too many hypothesis requests. Please wait and try again.",
        selected_node_id: "",
        research_question: "",
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
        message: "Invalid JSON body.",
        hypotheses: [],
        held: [],
        selected_node_id: "",
        research_question: "",
        evidence_ids: [],
      },
      { status: 400 }
    );
  }

  const datasetId = (body.datasetId || "").trim();
  const selectedNodeId = (body.selectedNodeId || "").trim();
  const researchQuestion = (body.researchQuestion || "").slice(0, 500);

  if (!datasetId || !selectedNodeId) {
    return NextResponse.json(
      {
        status: "error",
        message: "datasetId and selectedNodeId are required.",
        hypotheses: [],
        held: [],
        selected_node_id: selectedNodeId,
        research_question: researchQuestion,
        evidence_ids: [],
      },
      { status: 400 }
    );
  }

  const graph = await loadCuratedGraph(datasetId);
  if (!graph) {
    return NextResponse.json(
      {
        status: "error",
        message: `Unknown or unloadable dataset: ${datasetId}`,
        hypotheses: [],
        held: [],
        selected_node_id: selectedNodeId,
        research_question: researchQuestion,
        evidence_ids: [],
      },
      { status: 404 }
    );
  }

  const result = await exploreHypotheses({
    datasetId,
    graph,
    selectedNodeId,
    researchQuestion,
    refresh: Boolean(body.refresh),
    signal: req.signal,
  });

  const http =
    result.status === "unavailable"
      ? 503
      : result.status === "error"
        ? 502
        : result.status === "cancelled"
          ? 499
          : 200;

  return NextResponse.json(result, { status: http === 499 ? 200 : http });
}
