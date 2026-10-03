"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  HypothesisExploreResult,
  ValidatedHypothesis,
} from "@/lib/hypothesis/types";

type Props = {
  selectedLabel: string | null;
  researchQuestion: string;
  onResearchQuestionChange: (v: string) => void;
  loading: boolean;
  error: string | null;
  statusMessage: string | null;
  result: HypothesisExploreResult | null;
  showAiHypotheses: boolean;
  onToggleShow: (v: boolean) => void;
  onExplore: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onDismiss: (id: string) => void;
  onSelectHypothesis: (id: string) => void;
  dismissedIds: Set<string>;
};

export function HypothesisExplorePanel({
  selectedLabel,
  researchQuestion,
  onResearchQuestionChange,
  loading,
  error,
  statusMessage,
  result,
  showAiHypotheses,
  onToggleShow,
  onExplore,
  onCancel,
  onRefresh,
  onDismiss,
  onSelectHypothesis,
  dismissedIds,
}: Props) {
  const visible = (result?.hypotheses || []).filter(
    (h) => !dismissedIds.has(h.hypothesis_id)
  );
  const held = result?.held || [];

  return (
    <section className="mt-4 rounded-atlas border border-line bg-slate-50 p-3 md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-700">
            Explore potential connections
          </h2>
          <p className="atlas-meta mt-1">
            Optional AI research-discovery proposals grounded in curated
            evidence for{" "}
            <span className="font-medium text-slate-700">
              {selectedLabel || "the selected entity"}
            </span>
            . Hypotheses are not discoveries or treatment advice.
          </p>
        </div>
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-atlas border border-line bg-white px-2.5 py-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-700"
            checked={showAiHypotheses}
            onChange={(e) => onToggleShow(e.target.checked)}
            disabled={visible.length === 0}
          />
          Show AI hypotheses
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={researchQuestion}
          onChange={(e) => onResearchQuestionChange(e.target.value)}
          placeholder="Optional research question to narrow proposals"
          aria-label="Optional research question"
          disabled={loading || !selectedLabel}
          className="bg-white"
          maxLength={500}
        />
        {loading ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onExplore}
            disabled={!selectedLabel}
          >
            Explore potential connections
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={onRefresh}
          disabled={!selectedLabel || loading}
          title="Regenerate instead of using cache"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          Retrieving evidence and asking the model for up to three candidate
          connections…
        </p>
      ) : null}

      {error ? (
        <p
          className="mt-3 rounded-atlas border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {statusMessage && !error ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          {statusMessage}
          {result?.cached ? " (from cache)" : ""}
        </p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {visible.map((h) => (
            <HypothesisCard
              key={h.hypothesis_id}
              hyp={h}
              onSelect={() => onSelectHypothesis(h.hypothesis_id)}
              onDismiss={() => onDismiss(h.hypothesis_id)}
            />
          ))}
        </ul>
      ) : null}

      {held.length > 0 ? (
        <details className="mt-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium">
            {held.length} proposal{held.length === 1 ? "" : "s"} held or
            rejected by validation
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {held.map((h) => (
              <li key={h.hypothesis_id}>
                {h.title || h.hypothesis_id}:{" "}
                {h.validation.issues.map((i) => i.message).join("; ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function HypothesisCard({
  hyp,
  onSelect,
  onDismiss,
}: {
  hyp: ValidatedHypothesis;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  return (
    <li className="rounded-atlas border border-fuchsia-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-800">
            AI-generated hypothesis — not reviewed
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{hyp.title}</p>
          <p className="mt-1 text-sm text-slate-700">
            {hyp.plain_language_summary}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="sm" variant="outline" onClick={onSelect}>
            Inspect
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </li>
  );
}

export function AiHypothesisDetail({
  hyp,
  sourceLabel,
  targetLabel,
  evidenceUrlById,
}: {
  hyp: ValidatedHypothesis;
  sourceLabel: string;
  targetLabel: string;
  evidenceUrlById: Map<string, string | null>;
}) {
  return (
    <section className="atlas-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-fuchsia-200 bg-fuchsia-50 px-4 py-3 md:px-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-900">
          AI-generated hypothesis — not reviewed
        </p>
        <h2 className="font-display mt-1 text-[18px] font-semibold text-ink md:text-[20px]">
          {hyp.title}
        </h2>
        <p className="atlas-meta mt-1">
          {sourceLabel} → {targetLabel} ·{" "}
          {hyp.proposed_relationship_type.replace(/_/g, " ")}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 md:px-5 md:py-4">
        <Block title="1. What is known (premises)">
          <ul className="list-disc space-y-2 pl-5">
            {hyp.established_premises.map((p, i) => (
              <li key={i}>
                <span>{p.claim}</span>
                <span className="mt-1 block text-sm text-slate-500">
                  Evidence:{" "}
                  {p.evidence_ids.map((id) => {
                    const url = evidenceUrlById.get(id);
                    return url ? (
                      <a
                        key={id}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-2 underline"
                      >
                        {id}
                      </a>
                    ) : (
                      <span key={id} className="mr-2">
                        {id}
                      </span>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Block>
        <Block title="2. Supporting evidence IDs">
          <p className="text-sm text-slate-700">
            {[
              ...new Set(
                hyp.established_premises.flatMap((p) => p.evidence_ids)
              ),
            ].join(", ")}
          </p>
          <p className="atlas-meta mt-1">
            Source links come from stored graph records, not model-invented URLs.
          </p>
        </Block>
        <Block title="3. Proposed connection">
          <p>{hyp.plain_language_summary}</p>
        </Block>
        <Block title="4. Why it might apply">
          <p>{hyp.scientific_rationale}</p>
        </Block>
        <Block title="5. Important differences and counterevidence">
          <ul className="list-disc space-y-1 pl-5">
            {hyp.relevant_differences.map((d) => (
              <li key={d}>{d}</li>
            ))}
            {hyp.counterevidence.map((d) => (
              <li key={`c-${d}`}>{d}</li>
            ))}
            {hyp.missing_evidence.map((d) => (
              <li key={`m-${d}`}>Missing: {d}</li>
            ))}
          </ul>
        </Block>
        <Block title="6. What needs validation">
          <p>{hyp.validation_question}</p>
        </Block>
        <Block title="7. Suggested research next step">
          <p>{hyp.proposed_next_step}</p>
        </Block>
        <p className="text-sm text-amber-900">
          Review status: not reviewed. Origin: AI-generated. Relationship
          status: hypothesis. This is not expert-approved and is not an
          established fact.
        </p>
      </div>
    </section>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <div className="mt-2 text-base leading-relaxed text-slate-700">
        {children}
      </div>
    </div>
  );
}
