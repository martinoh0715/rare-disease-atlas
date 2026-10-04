import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { EvaluationResult } from "@/lib/evaluation/types";
import { EVAL_PROMPT_VERSION } from "@/lib/evaluation/types";

const memory = new Map<string, EvaluationResult>();

function cacheDir(): string {
  return path.join(process.cwd(), ".cache", "ai-evaluations");
}

export function evaluationCacheKey(parts: {
  datasetId: string;
  diseaseNodeId: string;
  assetNodeId: string;
  researchObjective: string;
  evidenceVersion: string;
  model: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...parts,
        researchObjective: parts.researchObjective.trim().toLowerCase(),
        promptVersion: EVAL_PROMPT_VERSION,
        schemaVersion: "evaluation-v1",
      })
    )
    .digest("hex");
}

export function readEvaluationCache(key: string): EvaluationResult | null {
  const hit = memory.get(key);
  if (hit) return { ...hit, cached: true };
  try {
    const file = path.join(cacheDir(), `${key}.json`);
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, "utf8")) as EvaluationResult;
    memory.set(key, data);
    return { ...data, cached: true };
  } catch {
    return null;
  }
}

export function writeEvaluationCache(
  key: string,
  value: EvaluationResult
): void {
  memory.set(key, value);
  try {
    mkdirSync(cacheDir(), { recursive: true });
    writeFileSync(path.join(cacheDir(), `${key}.json`), JSON.stringify(value, null, 2));
  } catch {
    // best-effort
  }
}
