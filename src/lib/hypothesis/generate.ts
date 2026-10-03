import OpenAI from "openai";
import type { GraphData } from "@/lib/graph";
import { cacheKey, readCache, writeCache } from "@/lib/hypothesis/cache";
import { buildEvidenceBundle } from "@/lib/hypothesis/evidenceBundle";
import {
  buildSystemPrompt,
  buildUserPrompt,
  PROMPT_VERSION,
} from "@/lib/hypothesis/prompt";
import { hypothesisResponseSchema } from "@/lib/hypothesis/schema";
import type {
  HypothesisExploreResult,
  ModelHypothesisResponse,
} from "@/lib/hypothesis/types";
import { validateModelResponse } from "@/lib/hypothesis/validate";

const DEFAULT_MODEL = "gpt-4o-2024-08-06";
const TIMEOUT_MS = 45_000;

export function configuredModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 1 });
}

export async function exploreHypotheses(options: {
  datasetId: string;
  graph: GraphData;
  selectedNodeId: string;
  researchQuestion?: string;
  refresh?: boolean;
  signal?: AbortSignal;
}): Promise<HypothesisExploreResult> {
  const researchQuestion = (options.researchQuestion || "").slice(0, 500);
  const bundle = buildEvidenceBundle({
    datasetId: options.datasetId,
    graph: options.graph,
    selectedNodeId: options.selectedNodeId,
    researchQuestion,
  });

  const base = {
    selected_node_id: options.selectedNodeId,
    research_question: researchQuestion,
    evidence_ids: bundle.evidence.map((e) => e.evidence_id),
    evidence_version: bundle.evidence_version,
    prompt_version: PROMPT_VERSION,
    model: configuredModel(),
  };

  if (bundle.insufficient) {
    return {
      status: "insufficient_evidence",
      ...base,
      hypotheses: [],
      held: [],
      message: bundle.insufficient_reason,
      evidence_limitations_explanation: bundle.insufficient_reason,
      generated_at: new Date().toISOString(),
    };
  }

  const key = cacheKey({
    datasetId: options.datasetId,
    selectedNodeId: options.selectedNodeId,
    researchQuestion,
    evidenceVersion: bundle.evidence_version,
    model: configuredModel(),
  });

  if (!options.refresh) {
    const cached = readCache(key);
    if (cached && cached.status === "ok") {
      return cached;
    }
  }

  if (options.signal?.aborted) {
    return {
      status: "cancelled",
      ...base,
      hypotheses: [],
      held: [],
      message: "Request cancelled.",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      status: "unavailable",
      ...base,
      hypotheses: [],
      held: [],
      message:
        "OpenAI API key is not configured on the server. Set OPENAI_API_KEY in a local .env.local file (never commit it). No hypotheses were invented.",
      generated_at: new Date().toISOString(),
    };
  }

  try {
    const response = await client.responses.create(
      {
        model: configuredModel(),
        temperature: 0.2,
        max_output_tokens: 2500,
        input: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(bundle) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "atlas_hypothesis_response",
            strict: true,
            schema: hypothesisResponseSchema as unknown as Record<
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
        hypotheses: [],
        held: [],
        message: "Model returned an empty response.",
        generated_at: new Date().toISOString(),
      };
    }

    let parsed: ModelHypothesisResponse;
    try {
      parsed = JSON.parse(text) as ModelHypothesisResponse;
    } catch {
      return {
        status: "error",
        ...base,
        hypotheses: [],
        held: [],
        message: "Model response was not valid JSON.",
        generated_at: new Date().toISOString(),
      };
    }

    if (!parsed.hypotheses?.length) {
      const result: HypothesisExploreResult = {
        status: "insufficient_evidence",
        ...base,
        hypotheses: [],
        held: [],
        message:
          parsed.evidence_limitations_explanation ||
          "Model found insufficient evidence for a specific proposal.",
        evidence_limitations_explanation:
          parsed.evidence_limitations_explanation,
        generated_at: new Date().toISOString(),
        cached: false,
      };
      writeCache(key, result);
      return result;
    }

    const { accepted, held } = validateModelResponse(
      parsed,
      bundle,
      options.graph
    );

    const result: HypothesisExploreResult = {
      status: "ok",
      ...base,
      hypotheses: accepted,
      held,
      evidence_limitations_explanation:
        parsed.evidence_limitations_explanation,
      message:
        accepted.length === 0
          ? held.length
            ? "Proposals were generated but held or rejected by validation. Curated graph unchanged."
            : "No displayable hypotheses after validation."
          : undefined,
      generated_at: new Date().toISOString(),
      cached: false,
    };
    writeCache(key, result);
    return result;
  } catch (err) {
    if (
      options.signal?.aborted ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      return {
        status: "cancelled",
        ...base,
        hypotheses: [],
        held: [],
        message: "Request cancelled.",
      };
    }
    const message =
      err instanceof Error ? err.message : "OpenAI request failed.";
    // Never fabricate hypotheses on failure.
    return {
      status: "error",
      ...base,
      hypotheses: [],
      held: [],
      message: `Hypothesis generation failed: ${message}`,
      generated_at: new Date().toISOString(),
    };
  }
}
