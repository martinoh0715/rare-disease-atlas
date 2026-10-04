"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RESEARCH_OBJECTIVE_EXAMPLES,
  type CollaborationBrief,
  type EvaluationResult,
} from "@/lib/evaluation/types";

export type AssetOption = {
  id: string;
  label: string;
  type: string;
  kind: string;
  connectionNote: string;
  hasPath: boolean;
};

export type DiseaseOption = {
  id: string;
  label: string;
};

export type PartnerOption = {
  id: string;
  label: string;
  diseaseScope: string;
  sourceUrl: string | null;
  relevance: string;
  contactPage: string | null;
  willingnessUnknown: boolean;
};

type Props = {
  diseaseOptions: DiseaseOption[];
  diseaseId: string;
  onDiseaseChange: (id: string) => void;
  needsDiseasePick: boolean;
  assetOptions: AssetOption[];
  assetId: string;
  onAssetChange: (id: string) => void;
  partnerOptions: PartnerOption[];
  partnerId: string;
  onPartnerChange: (id: string) => void;
  researchObjective: string;
  onResearchObjectiveChange: (v: string) => void;
  loading: boolean;
  error: string | null;
  result: EvaluationResult | null;
  onEvaluate: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onPrepareBrief: () => void;
  evidenceUrlById: Map<string, string | null>;
  evidencePassageById: Map<string, string>;
  evidenceTitleById: Map<string, string>;
  evidenceKindById: Map<string, string>;
  defaultOpen?: boolean;
};

const CONCLUSION_COPY: Record<string, string> = {
  potential_reuse_worth_investigating: "Potential reuse worth investigating",
  important_differences_require_review: "Important differences require review",
  insufficient_evidence_to_assess: "Insufficient evidence to assess",
  evidence_argues_against_proposed_reuse:
    "Available evidence argues against the proposed reuse",
};

export function ResearchOpportunityPanel({
  diseaseOptions,
  diseaseId,
  onDiseaseChange,
  needsDiseasePick,
  assetOptions,
  assetId,
  onAssetChange,
  partnerOptions,
  partnerId,
  onPartnerChange,
  researchObjective,
  onResearchObjectiveChange,
  loading,
  error,
  result,
  onEvaluate,
  onCancel,
  onRefresh,
  onPrepareBrief,
  evidenceUrlById,
  evidencePassageById,
  evidenceTitleById,
  evidenceKindById,
  defaultOpen = false,
}: Props) {
  const diseaseLabel =
    diseaseOptions.find((d) => d.id === diseaseId)?.label || diseaseId;
  const asset = assetOptions.find((a) => a.id === assetId) || null;
  const partner =
    partnerId && partnerId !== ""
      ? partnerOptions.find((p) => p.id === partnerId) || null
      : null;
  const assessment = result?.assessment || null;
  const canEvaluate = Boolean(diseaseId && assetId && !needsDiseasePick);

  return (
    <details
      className="mt-4 rounded-atlas border border-line bg-slate-50 p-3 md:p-4"
      open={defaultOpen || Boolean(assessment) || loading}
    >
      <summary className="cursor-pointer list-none">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-700">
            Evaluate research opportunity
          </h2>
          <p className="atlas-meta mt-1">
            Optional next step after exploring the graph: assess a selected
            study or asset for your community. AI assessment — not reviewed —
            not a discovery or treatment recommendation.
          </p>
        </div>
      </summary>
      <div className="mt-3 border-t border-line pt-3">

      {needsDiseasePick ? (
        <p className="mt-3 rounded-atlas border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Select a target disease or disease subgroup before evaluating. A gene
          or mechanism alone is not treated as the disease.
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Target disease</span>
          <select
            className="mt-1 h-10 w-full rounded-atlas border border-line bg-white px-2"
            value={diseaseId}
            onChange={(e) => onDiseaseChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Select disease…</option>
            {diseaseOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Study or research asset
          </span>
          <select
            className="mt-1 h-10 w-full rounded-atlas border border-line bg-white px-2"
            value={assetId}
            onChange={(e) => onAssetChange(e.target.value)}
            disabled={loading || !diseaseId}
          >
            <option value="">Select asset…</option>
            {assetOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {asset ? (
        <p className="mt-2 rounded-atlas border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span className="font-medium">Connection: </span>
          {asset.connectionNote}
        </p>
      ) : diseaseId && !assetId ? (
        <p className="mt-2 text-sm text-slate-600">
          Select a study or research asset — or choose one under Explore
          resources — before evaluating.
        </p>
      ) : diseaseId && assetOptions.length === 0 ? (
        <p className="mt-2 rounded-atlas border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          No suitable study, registry, publication, or research asset is
          available for this disease in the curated graph. A generic assessment
          will not be generated.
        </p>
      ) : null}

      <div className="mt-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Potential partner organization (optional)
          </span>
          <select
            className="mt-1 h-10 w-full rounded-atlas border border-line bg-white px-2"
            value={partnerId}
            onChange={(e) => onPartnerChange(e.target.value)}
            disabled={loading}
          >
            <option value="">No partner selected</option>
            {partnerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {partner ? (
          <div className="mt-2 rounded-atlas border border-line bg-white px-3 py-2 text-sm text-slate-700">
            <p>
              <span className="font-medium">Documented scope: </span>
              {partner.diseaseScope}
            </p>
            <p className="mt-1">
              <span className="font-medium">Why it may be relevant: </span>
              {partner.relevance}
            </p>
            <p className="mt-1">
              <span className="font-medium">Source: </span>
              {partner.sourceUrl ? (
                <a
                  href={partner.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-moss-800 underline"
                >
                  {partner.sourceUrl}
                </a>
              ) : (
                "No verified source URL in curated records"
              )}
            </p>
            <p className="mt-1 text-amber-900">
              Interest, capacity, access permissions, and willingness to
              collaborate are not established unless a source explicitly says
              so. Selecting a partner does not create a partnership or send a
              message.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Research objective (optional)
          </span>
          <Input
            className="mt-1 bg-white"
            value={researchObjective}
            onChange={(e) => onResearchObjectiveChange(e.target.value)}
            placeholder="Leave blank, type your own, or click an example below"
            maxLength={500}
            disabled={loading}
          />
        </label>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Examples (applied only if you click — not submitted automatically)
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {RESEARCH_OBJECTIVE_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="rounded-atlas border border-line bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              onClick={() => onResearchObjectiveChange(ex)}
              disabled={loading}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {loading ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button type="button" onClick={onEvaluate} disabled={!canEvaluate}>
            Evaluate research opportunity
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={onRefresh}
          disabled={!canEvaluate || loading}
        >
          Refresh
        </Button>
        {assessment && result?.status === "ok" ? (
          <Button type="button" variant="outline" onClick={onPrepareBrief}>
            Prepare collaboration brief
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          Building a focused evidence package and drafting an assessment for{" "}
          {diseaseLabel}
          {asset ? ` ↔ ${asset.label}` : ""}…
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

      {result?.saved_example ? (
        <p className="mt-3 rounded-atlas border border-line bg-white px-3 py-2 text-sm text-slate-700">
          Saved example — not a fresh live assessment.
        </p>
      ) : null}

      {result?.connection_explanation ? (
        <p className="mt-3 rounded-atlas border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span className="font-medium">How these are connected: </span>
          {result.connection_explanation}
        </p>
      ) : null}

      {result && !loading ? (
        <AssessmentView
          result={result}
          evidenceUrlById={evidenceUrlById}
          evidencePassageById={evidencePassageById}
          evidenceTitleById={evidenceTitleById}
          evidenceKindById={evidenceKindById}
        />
      ) : null}
      </div>
    </details>
  );
}

function AssessmentView({
  result,
  evidenceUrlById,
  evidencePassageById,
  evidenceTitleById,
  evidenceKindById,
}: {
  result: EvaluationResult;
  evidenceUrlById: Map<string, string | null>;
  evidencePassageById: Map<string, string>;
  evidenceTitleById: Map<string, string>;
  evidenceKindById: Map<string, string>;
}) {
  const a = result.assessment;
  if (result.status === "insufficient_evidence" && !a) {
    return (
      <div className="mt-4 rounded-atlas border border-line bg-white p-4">
        <h3 className="font-semibold text-ink">Insufficient evidence</h3>
        <p className="mt-2 text-sm text-slate-700">
          {result.message || "Not enough stored evidence to assess."}
        </p>
        {result.missing_information?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {result.missing_information.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}
        <ScopeLine result={result} />
      </div>
    );
  }
  if (!a) return null;

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-atlas border border-fuchsia-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-900">
          AI assessment — not reviewed
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-ink">
          {CONCLUSION_COPY[a.conclusion_label] || a.conclusion_label}
        </h3>
        <p className="mt-2 text-base leading-relaxed text-slate-800">
          {a.opportunity_summary}
        </p>
        {a.top_summary_limitations?.length ? (
          <div className="mt-3 rounded-atlas border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Important limitations
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-950">
              {a.top_summary_limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ScopeLine result={result} />
      </div>

      <Expandable title="Why this is relevant" defaultOpen>
        <SectionLabel>Evidence (documented findings)</SectionLabel>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {a.why_relevant.documented_findings.map((f, i) => (
            <li key={i}>
              {f.claim}
              <CitationList
                ids={f.evidence_ids}
                evidenceUrlById={evidenceUrlById}
                evidencePassageById={evidencePassageById}
                evidenceTitleById={evidenceTitleById}
                evidenceKindById={evidenceKindById}
              />
            </li>
          ))}
        </ul>
        <SectionLabel className="mt-4">AI assessment — not reviewed</SectionLabel>
        <p className="mt-1 text-sm text-slate-700">
          {a.why_relevant.ai_interpretation}
        </p>
        <SectionLabel className="mt-4">Proposed research opportunity</SectionLabel>
        <p className="mt-1 text-sm text-slate-700">
          {a.why_relevant.proposed_opportunity}
        </p>
      </Expandable>

      <Expandable title="Reuse assessment" defaultOpen>
        {a.reuse_elements.length === 0 ? (
          <p className="text-sm text-slate-600">
            No specific reusable elements were described in the available
            evidence.
          </p>
        ) : (
          <ul className="space-y-3">
            {a.reuse_elements.map((el) => (
              <li
                key={`${el.element}-${el.documented_detail}`}
                className="rounded-atlas border border-line bg-slate-50 p-3"
              >
                <p className="text-sm font-semibold text-ink">{el.element}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {el.assessment.replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">Documented detail: </span>
                  {el.documented_detail || "Details not present in supplied evidence"}
                </p>
                {el.supporting_passage_excerpt ? (
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium">Supporting passage: </span>
                    {el.supporting_passage_excerpt}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">Relevance to objective: </span>
                  {el.relevance_to_objective}
                </p>
                <p className="mt-2 text-sm text-slate-700">{el.rationale}</p>
                {el.important_differences.length ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                    {el.important_differences.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-2 text-sm text-amber-900">
                  Verify before proceeding: {el.must_verify_before_proceeding}
                </p>
                <CitationList
                  ids={el.evidence_ids}
                  evidenceUrlById={evidenceUrlById}
                  evidencePassageById={evidencePassageById}
                  evidenceTitleById={evidenceTitleById}
                  evidenceKindById={evidenceKindById}
                />
              </li>
            ))}
          </ul>
        )}
      </Expandable>

      <Expandable title="Study-design comparison (AI assessment — not reviewed)" defaultOpen>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Purpose: </span>
          {a.study_design_comparison?.purpose_differences || "Not assessed."}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Participant selection: </span>
          {a.study_design_comparison?.participant_selection_differences ||
            "Not assessed."}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Treatment exposure: </span>
          {a.study_design_comparison?.treatment_exposure_differences ||
            "Not assessed."}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Outcome interpretation: </span>
          {a.study_design_comparison?.outcome_interpretation_differences ||
            "Not assessed."}
        </p>
        {a.study_design_comparison?.missing_information?.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-950">
            {a.study_design_comparison.missing_information.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}
      </Expandable>

      <Expandable title="Unknowns and expert-review questions">
        <ul className="space-y-2">
          {a.unknown_questions.map((q) => (
            <li key={q.unknown} className="text-sm text-slate-700">
              <span className="font-medium text-ink">{q.unknown}</span>
              <span className="mt-1 block">Why it matters: {q.why_it_matters}</span>
              <span className="mt-1 block text-slate-600">
                Could be resolved by: {q.resolvable_by}
              </span>
            </li>
          ))}
        </ul>
      </Expandable>

      <Expandable title="Recommended next step" defaultOpen>
        <p className="text-sm font-medium text-ink">
          {a.recommended_next_step.milestone}
        </p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {a.recommended_next_step.actions.map((act, i) => (
            <li key={i}>
              <span className="font-medium">{act.action}</span>
              <span className="mt-1 block">
                Role / documented organization: {act.role_or_organization}
              </span>
              <span className="mt-1 block">
                Information needed: {act.information_needed}
              </span>
              <span className="mt-1 block">
                Decision enabled: {act.decision_enabled}
              </span>
            </li>
          ))}
        </ol>
      </Expandable>

      <Expandable title="Potential time savings">
        <p className="text-sm text-slate-700">{a.potential_time_savings}</p>
      </Expandable>
    </div>
  );
}

function ScopeLine({ result }: { result: EvaluationResult }) {
  return (
    <p className="atlas-meta mt-3">
      Evidence scope: {result.evidence_scope_summary || "stored atlas records"} ·
      Assessment generated:{" "}
      {result.generated_at
        ? new Date(result.generated_at).toLocaleString()
        : "—"}
      {result.cached ? " · from cache" : ""} · Model review status: not reviewed
    </p>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </p>
  );
}

function Expandable({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-atlas border border-line bg-white p-3"
      open={defaultOpen}
    >
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function CitationList({
  ids,
  evidenceUrlById,
  evidencePassageById,
  evidenceTitleById,
  evidenceKindById,
}: {
  ids: string[];
  evidenceUrlById: Map<string, string | null>;
  evidencePassageById: Map<string, string>;
  evidenceTitleById: Map<string, string>;
  evidenceKindById: Map<string, string>;
}) {
  if (!ids?.length) return null;
  return (
    <ul className="mt-2 space-y-2 text-xs text-slate-600">
      {ids.map((id) => {
        const url = evidenceUrlById.get(id);
        const passage = evidencePassageById.get(id);
        const title = evidenceTitleById.get(id) || id;
        const kind = evidenceKindById.get(id) || "evidence";
        const kindLabel =
          kind === "curator_summary"
            ? "Curator summary (not a verbatim abstract)"
            : kind === "asset_record"
              ? "Asset / journey record"
              : "Original source passage";
        return (
          <li key={id} className="rounded border border-slate-200 bg-white px-2 py-1.5">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-moss-800 underline"
              >
                {title}
              </a>
            ) : (
              <span className="font-medium text-ink">{title}</span>
            )}
            <span className="mt-0.5 block text-slate-500">
              {kindLabel} · internal id: {id}
            </span>
            {passage ? (
              <span className="mt-0.5 block text-slate-600">
                Supporting text: {passage.slice(0, 260)}
                {passage.length > 260 ? "…" : ""}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CollaborationBriefModal({
  brief,
  markdown,
  onClose,
  onChangeMarkdown,
}: {
  brief: CollaborationBrief;
  markdown: string;
  onClose: () => void;
  onChangeMarkdown: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "collaboration-brief.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-atlas border border-line bg-white shadow-atlas">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Collaboration brief
            </h2>
            <p className="atlas-meta mt-1">
              Editable preview built from the validated assessment.{" "}
              {brief.aiStatusNote}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <textarea
          className="min-h-[320px] flex-1 resize-y px-4 py-3 font-mono text-sm text-slate-800 outline-none"
          value={markdown}
          onChange={(e) => onChangeMarkdown(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <Button type="button" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" variant="outline" onClick={download}>
            Download Markdown
          </Button>
        </div>
      </div>
    </div>
  );
}
