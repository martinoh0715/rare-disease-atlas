import { readFile } from "fs/promises";
import path from "path";
import { AtlasApp } from "@/components/AtlasApp";
import type {
  AtlasCatalog,
  AtlasData,
  DemoExperience,
} from "@/lib/types";
import type { GraphData, Journey } from "@/lib/graph";

async function loadJson<T>(file: string): Promise<T> {
  const full = path.join(process.cwd(), "public", "data", file);
  const raw = await readFile(full, "utf8");
  return JSON.parse(raw) as T;
}

async function loadDataset(entryPath: string, id: string): Promise<AtlasData> {
  const curated = await loadJson<GraphData>(`${entryPath}/curated-graph.json`);
  const discovery = await loadJson<GraphData>(`${entryPath}/graph.json`);
  const journeys = await loadJson<{ journeys: Journey[] }>(
    `${entryPath}/journeys.json`
  );
  const demo = await loadJson<DemoExperience>(
    `${entryPath}/demo-experience.json`
  );
  return {
    id,
    curated,
    discovery,
    journey: journeys.journeys[0],
    demo: {
      ...demo,
      dataset_id: demo.dataset_id || id,
    },
  };
}

export default async function HomePage() {
  const catalog = await loadJson<AtlasCatalog>("catalog.json");
  const datasets = await Promise.all(
    catalog.datasets.map((d) => loadDataset(d.path, d.id))
  );

  return <AtlasApp catalog={catalog} datasets={datasets} />;
}
