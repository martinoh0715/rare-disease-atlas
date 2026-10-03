import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import type { HypothesisExploreResult } from "@/lib/hypothesis/types";
import { PROMPT_VERSION } from "@/lib/hypothesis/types";

const memory = new Map<string, HypothesisExploreResult>();

function cacheDir(): string {
  return path.join(process.cwd(), ".cache", "ai-hypotheses");
}

export function cacheKey(parts: {
  datasetId: string;
  selectedNodeId: string;
  researchQuestion: string;
  evidenceVersion: string;
  model: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...parts,
        researchQuestion: parts.researchQuestion.trim().toLowerCase(),
        promptVersion: PROMPT_VERSION,
      })
    )
    .digest("hex");
}

export function readCache(key: string): HypothesisExploreResult | null {
  const hit = memory.get(key);
  if (hit) return { ...hit, cached: true };
  try {
    const file = path.join(cacheDir(), `${key}.json`);
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, "utf8")) as HypothesisExploreResult;
    memory.set(key, data);
    return { ...data, cached: true };
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: HypothesisExploreResult): void {
  memory.set(key, value);
  try {
    const dir = cacheDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(value, null, 2));
  } catch {
    // Disk cache is best-effort; memory still works for the process lifetime.
  }
}
