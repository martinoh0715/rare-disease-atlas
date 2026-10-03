import { readFile } from "fs/promises";
import path from "path";
import { AtlasApp } from "@/components/AtlasApp";
import type { DemoExperience } from "@/lib/types";
import type { GraphData, Journey } from "@/lib/graph";

async function loadJson<T>(file: string): Promise<T> {
  const full = path.join(process.cwd(), "public", "data", file);
  const raw = await readFile(full, "utf8");
  return JSON.parse(raw) as T;
}

export default async function HomePage() {
  const curated = await loadJson<GraphData>("curated-graph.json");
  const discovery = await loadJson<GraphData>("graph.json");
  const journeys = await loadJson<{ journeys: Journey[] }>("journeys.json");
  const demo = await loadJson<DemoExperience>("demo-experience.json");
  const journey = journeys.journeys[0];

  return (
    <AtlasApp
      curated={curated}
      discovery={discovery}
      journey={journey}
      demo={demo}
    />
  );
}
