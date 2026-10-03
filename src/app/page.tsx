import { readFile } from "fs/promises";
import path from "path";
import { Explorer } from "@/components/Explorer";
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
  const journey = journeys.journeys[0];

  return (
    <main>
      <header className="relative overflow-hidden border-b border-stone-300/70">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-64 w-64 animate-pulseSoft rounded-full bg-teal-700/15 blur-3xl" />
          <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-orange-800/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(28,25,23,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(28,25,23,0.04) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>
        <div className="relative mx-auto flex max-w-7xl animate-rise flex-col gap-4 px-4 py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-900">
            Hack-Nation · Rare disease atlas slice
          </p>
          <h1 className="font-display max-w-4xl text-4xl leading-tight text-stone-950 md:text-6xl">
            HBB Evidence Atlas
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-stone-700 md:text-lg">
            A locally curated map from sickle cell anemia (HbSS) and
            beta-thalassemia biology to verified research assets and an honest next
            collaboration question — with sources on every scientific edge.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="#explorer"
              className="inline-flex h-11 items-center rounded-md bg-stone-900 px-5 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
            >
              Open the research journey
            </a>
            <a
              href="/data/gaps.md"
              className="inline-flex h-11 items-center rounded-md border border-stone-400 bg-white/70 px-5 text-sm font-medium text-stone-900 transition hover:bg-white"
            >
              Read remaining gaps
            </a>
          </div>
          <p className="text-xs text-stone-500">
            Curated nodes: {curated.nodes.length} · curated edges: {curated.edges.length} ·
            discovery nodes: {discovery.nodes.length}. Not medical advice. exa-cel targets
            BCL11A, not HBB.
          </p>
        </div>
      </header>

      <div id="explorer">
        <Explorer curated={curated} discovery={discovery} journey={journey} />
      </div>
    </main>
  );
}
