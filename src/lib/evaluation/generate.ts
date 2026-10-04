import OpenAI from "openai";
import type { GraphData } from "@/lib/graph";
import type { AssetAssessment } from "@/lib/types";
import {
  evaluationCacheKey,
  readEvaluationCache,
  writeEvaluationCache,
} from "@/lib/evaluation/cache";
import { buildEvaluationEvidencePackage } from "@/lib/evaluation/evidencePackage";
import {
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
  EVAL_PROMPT_VERSION,
} from "@/lib/evaluation/prompt";
import { evaluationResponseSchema } from "@/lib/evaluation/schema";
import type {
  EvaluationResult,
  ModelEvaluation,
} from "@/lib/evaluation/types";
import { validateEvaluation } from "@/lib/evaluation/validate";

const DEFAULT_MODEL = "gpt-4o-2024-08-06";
const TIMEOUT_MS = 45_000;

export function configuredModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export function evaluationDisabled(): boolean {
  const v = (process.env.ATLAS_DISABLE_EVALUATION || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 1 });
}

export async function evaluateResearchOpportunity(options: {
  datasetId: string;
  graph: GraphData;
  diseaseNodeId: string;
  assetNodeId: string;
  researchObjective?: string;
  assetAssessments?: AssetAssessment[];
  refresh?: boolean;
  signal?: AbortSignal;
}): Promise<EvaluationResult> {
  const researchObjective = (options.researchObjective || "").slice(0, 500);
  const pkg = buildEvaluationEvidencePackage({
    datasetId: options.datasetId,
    graph: options.graph,
    diseaseNodeId: options.diseaseNodeId,
    assetNodeId: options.assetNodeId,
    researchObjective,
    assetAssessments: options.assetAssessments || [],
  });

  const evidenceScope = pkg.connection_explanation
    ? pkg.connection_explanation
    : `${pkg.evidence.length} stored evidence records; ${pkg.connecting_paths.length} connecting path(s).`;

  const base = {
    disease_node_id: options.diseaseNodeId,
    asset_node_id: options.assetNodeId,
    research_objective: researchObjective,
    evidence_ids: pkg.evidence.map((e) => e.evidence_id),
    evidence_version: pkg.evidence_version,
    prompt_version: EVAL_PROMPT_VERSION,
    model: configuredModel(),
    evidence_scope_summary: evidenceScope,
    connection_explanation: pkg.connection_explanation,
    missing_information: pkg.missing_information,
  };

  if (evaluationDisabled()) {
    return {
      status: "disabled",
      ...base,
      assessment: null,
      message:
        "Live evaluation is disabled on this server (ATLAS_DISABLE_EVALUATION).",
      generated_at: new Date().toISOString(),
    };
  }

  if (!options.assetNodeId) {
    return {
      status: "missing_asset",
      ...base,
      assessment: null,
      message:
        "Select a study, registry, publication, model, or other research asset to evaluate.",
      generated_at: new Date().toISOString(),
    };
  }

  if (pkg.insufficient) {
    return {
      status: "insufficient_evidence",
      ...base,
      assessment: null,
      message: pkg.insufficient_reason,
      generated_at: new Date().toISOString(),
    };
  }

  const key = evaluationCacheKey({
    datasetId: options.datasetId,
    diseaseNodeId: options.diseaseNodeId,
    assetNodeId: options.assetNodeId,
    researchObjective,
    evidenceVersion: pkg.evidence_version,
    model: configuredModel(),
  });

  if (!options.refresh) {
    const cached = readEvaluationCache(key);
    if (cached && (cached.status === "ok" || cached.status === "insufficient_evidence")) {
      return cached;
    }
  }

  if (options.signal?.aborted) {
    return {
      status: "cancelled",
      ...base,
      assessment: null,
      message: "Request cancelled.",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      status: "unavailable",
      ...base,
      assessment: null,
      message:
        "OpenAI API key is not configured on the server. Set OPENAI_API_KEY in .env.local. No assessment was invented.",
      generated_at: new Date().toISOString(),
    };
  }

  try {
    const response = await client.responses.create(
      {
        model: configuredModel(),
        temperature: 0.2,
        max_output_tokens: 3200,
        input: [
          { role: "system", content: buildEvaluationSystemPrompt() },
          { role: "user", content: buildEvaluationUserPrompt(pkg) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "atlas_evaluation_response",
            strict: true,
            schema: evaluationResponseSchema as unknown as Record<
              string,
              unknown
            >,
          },
        },
      },
      { signal: options.signal }
    );

    const text = response.output_text;
    if (!text) {
      return {
        status: "error",
        ...base,
        assessment: null,
        message: "Model returned an empty response.",
        generated_at: new Date().toISOString(),
      };
    }

    let parsed: ModelEvaluation;
    try {
      parsed = JSON.parse(text) as ModelEvaluation;
    } catch {
      return {
        status: "error",
        ...base,
        assessment: null,
        message: "Model response was not valid JSON.",
        generated_at: new Date().toISOString(),
      };
    }

    const validated = validateEvaluation(parsed, pkg);
    if (!validated.validation.accepted) {
      const result: EvaluationResult = {
        status: "error",
        ...base,
        assessment: null,
        message: `Assessment failed validation: ${validated.validation.issues
          .filter((i) => i.severity === "reject")
          .map((i) => i.message)
          .join("; ")}`,
        generated_at: new Date().toISOString(),
        cached: false,
      };
      return result;
    }

    if (validated.conclusion_label === "insufficient_evidence_to_assess") {
      const result: EvaluationResult = {
        status: "insufficient_evidence",
        ...base,
        assessment: validated,
        message:
          validated.evidence_limitations_explanation ||
          "Insufficient evidence to assess this research opportunity.",
        generated_at: new Date().toISOString(),
        cached: false,
      };
      writeEvaluationCache(key, result);
      return result;
    }

    const result: EvaluationResult = {
      status: "ok",
      ...base,
      assessment: validated,
      message: undefined,
      generated_at: new Date().toISOString(),
      cached: false,
    };
    writeEvaluationCache(key, result);
    return result;
  } catch (err) {
    if (
      options.signal?.aborted ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      return {
        status: "cancelled",
        ...base,
        assessment: null,
        message: "Request cancelled.",
      };
    }
    const message =
      err instanceof Error ? err.message : "OpenAI request failed.";
    return {
      status: "error",
      ...base,
      assessment: null,
      message: `Evaluation failed: ${message}`,
      generated_at: new Date().toISOString(),
    };
  }
}
