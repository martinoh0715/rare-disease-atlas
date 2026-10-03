"use client";

import { useMemo, useState } from "react";
import { NetworkCanvas } from "@/components/NetworkCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GraphEdge,
  GraphNode,
  legendCategoryForType,
  needsDisambiguation,
  neighborhood,
  pathNeighborhood,
  relationshipLabel,
  searchDemoEntries,
  type SearchHit,
} from "@/lib/graph";
import type {
  AssetAssessment,
  AtlasData,
  DemoStage,
  ProposalDraft,
} from "@/lib/types";
import { importantSummaryForEdge, sourceCardForEdge } from "@/lib/sourceMeta";

type Mode = "landing" | "workspace" | "unsupported";

export function AtlasApp({ curated, journey, demo }: AtlasData) {
  const [mode, setMode] = useState<Mode>("landing");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [focusId, setFocusId] = useState<string>("disease:hbss");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string>("understand");
  const [expanded, setExpanded] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([
    "nct:NCT03655678",
    "asset:jax_townes",
  ]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("org:caf");
  const [proposal, setProposal] = useState<ProposalDraft | null>(null);
  const [unsupportedQuery, setUnsupportedQuery] = useState("");
  const [focusHistory, setFocusHistory] = useState<string[]>([]);
  const [enabledCategories, setEnabledCategories] = useState<string[]>(() =>
    demo.category_legend.map((c) => c.id)
  );

  const nodeMap = useMemo(
    () => new Map(curated.nodes.map((n) => [n.id, n])),
    [curated]
  );
  const edgeMap = useMemo(
    () => new Map(curated.edges.map((e) => [e.id, e])),
    [curated]
  );

  const stages = (journey.stages || demo.stages) as DemoStage[];
  const stage = stages.find((s) => s.id === stageId) || stages[0];
  const productName = demo.product_name || "Rare Disease Atlas";
  const enabledCategorySet = useMemo(
    () => new Set(enabledCategories),
    [enabledCategories]
  );

  const focusNode = nodeMap.get(focusId) || null;
  const selectedEdge = selectedEdgeId ? edgeMap.get(selectedEdgeId) || null : null;

  const local = useMemo(() => {
    if (!focusNode) {
      return {
        nodes: [] as GraphNode[],
        edges: [] as GraphEdge[],
        allNodes: [] as GraphNode[],
        truncated: false,
        emptyReason: null as string | null,
      };
    }

    let presentNodes: GraphNode[];
    let presentEdges: GraphEdge[];
    let truncated = false;
    let emptyReason: string | null = null;

    // Stage views show the full curated multi-hop path for that step.
    if (!expanded && stage) {
      const path = pathNeighborhood(curated, stage.node_ids, stage.edge_ids);
      presentNodes = path.nodes.filter((n) => nodeMap.has(n.id));
      presentEdges = path.edges.filter(
        (e) => nodeMap.has(e.source) && nodeMap.has(e.target)
      );
      const hasResources = presentNodes.some((n) =>
        ["clinical_study", "publication", "organization", "research_asset"].includes(
          n.type
        )
      );
      if (stage.id === "explore" && !hasResources) {
        emptyReason =
          "No supported study, publication, organization, or asset path is available for this disease context in the curated layer.";
      } else if (presentEdges.length === 0) {
        presentNodes = presentNodes.length ? presentNodes : [focusNode];
        emptyReason =
          "This step has no sourced connections to display yet. Try another step or a different disease context.";
      }
    } else {
      // Expanded mode: ego neighborhood around the selected center.
      const ego = neighborhood(curated, focusId, { maxEdges: 16 });
      presentNodes = ego.nodes;
      presentEdges = ego.edges;
      truncated = ego.truncated;
    }

    const allNodes = presentNodes;
    const visibleNodes = presentNodes.filter(
      (n) =>
        n.id === focusId || enabledCategorySet.has(legendCategoryForType(n.type))
    );
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = presentEdges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );

    return {
      nodes: visibleNodes,
      edges: visibleEdges,
      allNodes,
      truncated,
      emptyReason,
    };
  }, [
    curated,
    enabledCategorySet,
    expanded,
    focusId,
    focusNode,
    nodeMap,
    stage,
  ]);

  const assetAssessments = demo.asset_assessments;
  const visibleAssets = assetAssessments.filter((a) =>
    stageId === "understand"
      ? false
      : stage?.node_ids.includes(a.asset_id) ||
        selectedAssetIds.includes(a.asset_id) ||
        stageId === "explore" ||
        stageId === "prepare"
  );

  function runSearch(raw: string) {
    const q = raw.trim();
    setQuery(q);
    if (!q) {
      setHits([]);
      return;
    }
    const found = searchDemoEntries(demo.search_entries, q);
    setHits(found);
    if (found.length === 0) {
      setUnsupportedQuery(q);
      setMode("unsupported");
      return;
    }
    if (!needsDisambiguation(found) && found.length === 1) {
      enterWorkspace(found[0].entry.id);
      return;
    }
    setMode("landing");
  }

  function selectEdgeForNode(nodeId: string, preferStage = true) {
    const stageEdgeIds = new Set(stage?.edge_ids || []);
    const e =
      (preferStage &&
        curated.edges.find(
          (edge) =>
            (edge.source === nodeId || edge.target === nodeId) &&
            stageEdgeIds.has(edge.id)
        )) ||
      curated.edges.find(
        (edge) => edge.source === nodeId || edge.target === nodeId
      );
    setSelectedEdgeId(e?.id || null);
  }

  function goToNode(nodeId: string, options?: { trackHistory?: boolean }) {
    if (options?.trackHistory !== false && focusId && focusId !== nodeId) {
      setFocusHistory((prev) => [...prev, focusId]);
    }
    setFocusId(nodeId);
    selectEdgeForNode(nodeId);
  }

  function goBack() {
    setFocusHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previousId = next.pop()!;
      setFocusId(previousId);
      selectEdgeForNode(previousId);
      return next;
    });
  }

  function enterWorkspace(nodeId: string) {
    setFocusHistory([]);
    setFocusId(nodeId);
    setMode("workspace");
    setExpanded(false);
    setEnabledCategories(demo.category_legend.map((c) => c.id));
    // Pick a sensible starting stage.
    const startStage =
      stages.find((s) => s.node_ids.includes(nodeId))?.id || "understand";
    setStageId(startStage);
    const firstEdge =
      stages
        .find((s) => s.id === startStage)
        ?.edge_ids.find((id) => {
          const e = edgeMap.get(id);
          return e && (e.source === nodeId || e.target === nodeId);
        }) ||
      curated.edges.find((e) => e.source === nodeId || e.target === nodeId)?.id ||
      null;
    setSelectedEdgeId(firstEdge);
  }

  function chooseStage(id: string) {
    setStageId(id);
    setExpanded(false);
    const s = stages.find((x) => x.id === id);
    if (!s) return;

    // Fit the stage's resource/biology path immediately.
    const anchor =
      (s.anchor_node_id && nodeMap.has(s.anchor_node_id) && s.anchor_node_id) ||
      s.node_ids.find((nid) => nodeMap.get(nid)?.type === "disease") ||
      s.node_ids.find((nid) => nodeMap.has(nid)) ||
      focusId;
    if (anchor !== focusId) {
      setFocusHistory((prev) => [...prev, focusId]);
    }
    setFocusId(anchor);

    const preferred =
      (s.preferred_edge_id && edgeMap.has(s.preferred_edge_id) && s.preferred_edge_id) ||
      s.edge_ids.find((eid) => {
        const e = edgeMap.get(eid);
        if (!e) return false;
        // Prefer study/publication/asset edges on Explore.
        const tip = nodeMap.get(e.source) || nodeMap.get(e.target);
        return (
          tip &&
          ["clinical_study", "publication", "research_asset", "organization"].includes(
            tip.type
          )
        );
      }) ||
      s.edge_ids.find((eid) => edgeMap.has(eid)) ||
      null;
    setSelectedEdgeId(preferred);
  }

  function toggleCategory(id: string) {
    setEnabledCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAsset(id: string) {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buildProposal() {
    const disease =
      nodeMap.get("disease:hbss") ||
      nodeMap.get(focusId) ||
      ({ label: "Selected disease" } as GraphNode);
    const partner = nodeMap.get(selectedPartnerId);
    const assets = assetAssessments.filter((a) =>
      selectedAssetIds.includes(a.asset_id)
    );
    const pathEdges = (journey.edge_path || [])
      .map((id) => edgeMap.get(id))
      .filter(Boolean) as GraphEdge[];

    const evidenceBullets = pathEdges.slice(0, 8).map((e) => {
      const src = e.evidence?.source_url || "source pending";
      const passage = e.evidence?.supporting_passage || e.plain_language || e.type;
      return `${relationshipLabel(e.type)}: ${passage} (${src})`;
    });

    const differences = assets.flatMap((a) => a.comparison.what_differs);
    const uncertainties = [
      ...(nodeMap.get("question:validate_hbf_asset_transfer")?.uncertainties ||
        []),
      demo.registry_gap.explanation,
    ];
    const partnerQuestions = assets.map(
      (a) => a.comparison.validation_question
    );

    const draft: ProposalDraft = {
      diseaseLabel: disease.label,
      researchQuestion:
        demo.proposal_defaults.research_question,
      connectionSummary: journey.plain_language,
      proposedResource: assets.map((a) => a.title).join("; ") || "No asset selected",
      partnerLabel: partner
        ? `${partner.label} (public organization page; availability not claimed)`
        : demo.proposal_defaults.partner_gap_if_unknown,
      evidenceBullets,
      differences: [...new Set(differences)],
      uncertainties,
      partnerQuestions: [...new Set(partnerQuestions)],
      nextStep: demo.proposal_defaults.proposed_next_step,
    };
    setProposal(draft);
    setProposalOpen(true);
  }

  if (mode === "landing") {
    return (
      <Landing
        demo={demo}
        query={query}
        hits={hits}
        onQueryChange={(v) => {
          setQuery(v);
          setHits(searchDemoEntries(demo.search_entries, v));
        }}
        onSubmit={() => runSearch(query)}
        onPickExample={(q) => {
          setQuery(q);
          runSearch(q);
        }}
        onSelectHit={(id) => enterWorkspace(id)}
      />
    );
  }

  if (mode === "unsupported") {
    return (
      <Unsupported
        query={unsupportedQuery}
        demo={demo}
        onBack={() => {
          setMode("landing");
          setHits([]);
        }}
        onTry={(q) => {
          setQuery(q);
          runSearch(q);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-[#0b1f3a] text-white">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="font-display text-lg tracking-tight"
            onClick={() => setMode("landing")}
          >
            {productName}
          </button>
          <form
            className="flex min-w-[280px] flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a disease, gene, or variant"
              aria-label="Search atlas"
              className="rounded-r-none border-slate-500 bg-white text-slate-900"
            />
            <Button type="submit" className="rounded-l-none bg-teal-700 hover:bg-teal-600">
              Search
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={goBack}
            disabled={focusHistory.length === 0}
            aria-label="Back to previous node"
          >
            ← Back
          </Button>
          <span className="text-xs text-slate-500">
            {focusHistory.length > 0
              ? `Previous: ${nodeMap.get(focusHistory[focusHistory.length - 1])?.label || "node"}`
              : "No previous node yet"}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Focused graph
                </p>
                <h1 className="font-display text-3xl font-bold text-slate-950">
                  {focusNode?.label}
                </h1>
                <p className="mt-1 text-sm capitalize text-slate-600">
                  {(focusNode?.type || "").replace(/_/g, " ")}
                </p>
                {focusNode?.does_not ? (
                  <p className="mt-1 text-sm text-amber-900">
                    What this is not: {focusNode.does_not.toLowerCase()}.
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show guided path" : "Show more connections"}
              </Button>
            </div>

            <div className="mb-3 flex justify-end">
              <div className="w-full max-w-[280px] rounded-md border border-slate-300 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Legend
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-teal-800 hover:bg-teal-50"
                      onClick={() =>
                        setEnabledCategories(demo.category_legend.map((c) => c.id))
                      }
                    >
                      Check all
                    </button>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                      onClick={() => setEnabledCategories([])}
                    >
                      Uncheck all
                    </button>
                  </div>
                </div>
                <ul className="max-h-52 space-y-0.5 overflow-auto px-2 py-2">
                  {demo.category_legend.map((c) => {
                    const count = local.allNodes.filter(
                      (n) => legendCategoryForType(n.type) === c.id
                    ).length;
                    if (count === 0) return null;
                    const checked = enabledCategorySet.has(c.id);
                    return (
                      <li key={c.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs ${
                            checked
                              ? "bg-white text-slate-800"
                              : "bg-slate-50 text-slate-400"
                          } hover:bg-slate-100`}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-teal-700"
                            checked={checked}
                            onChange={() => toggleCategory(c.id)}
                          />
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{
                              background: checked ? c.color : "#cbd5e1",
                            }}
                          />
                          <span className="flex-1">{c.label}</span>
                          <span className="tabular-nums text-slate-400">
                            {count}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="border-t border-slate-200 px-3 py-1.5 text-[10px] leading-snug text-slate-500">
                  Toggle categories to show or hide nodes. Dashed = proposed.
                </p>
              </div>
            </div>

            <NetworkCanvas
              focusId={focusId}
              nodes={local.nodes}
              edges={local.edges}
              selectedEdgeId={selectedEdgeId}
              legend={demo.category_legend}
              onSelectNode={(id) => goToNode(id)}
              onSelectEdge={setSelectedEdgeId}
            />

            {local.emptyReason && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {local.emptyReason}
              </p>
            )}
            {local.truncated && (
              <p className="mt-2 text-xs text-slate-500">
                Neighborhood truncated for readability. Return to the guided
                path for the curated multi-hop view.
              </p>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <SourcePanel edge={selectedEdge} nodeMap={nodeMap} />
            <SummaryPanel
              edge={selectedEdge}
              nodeMap={nodeMap}
              plainFallback={
                selectedEdge
                  ? demo.edge_plain_language[selectedEdge.id]
                  : undefined
              }
            />
          </aside>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Guided discovery
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              A 3-step tour. Each step fits a curated path on the graph —
              biology first, then studies and partners, then a next-step brief.
            </p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {stages.map((s, idx) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => chooseStage(s.id)}
                    className={`h-full w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      stageId === s.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-wide opacity-70">
                      Step {idx + 1}
                    </span>
                    <span className="font-medium">{s.label}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-slate-600">{stage?.summary}</p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg">Prepare next step</h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose a partner organization and assets, then generate an
              editable sourced brief. Nothing is sent automatically.
            </p>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Potential partner
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
            >
              <option value="org:caf">Cooley&apos;s Anemia Foundation</option>
              <option value="org:scdaa">
                Sickle Cell Disease Association of America
              </option>
            </select>
            <Button className="mt-3 w-full" onClick={buildProposal}>
              Prepare research proposal
            </Button>
          </section>
        </div>

        {(stageId === "explore" || stageId === "prepare") && (
          <AssetPanel
            assets={visibleAssets.length ? visibleAssets : assetAssessments}
            selectedAssetIds={selectedAssetIds}
            onToggle={toggleAsset}
            registryGap={demo.registry_gap}
          />
        )}
      </div>

      {proposalOpen && proposal && (
        <ProposalModal
          proposal={proposal}
          onClose={() => setProposalOpen(false)}
          onChange={setProposal}
        />
      )}
    </div>
  );
}

function Landing({
  demo,
  query,
  hits,
  onQueryChange,
  onSubmit,
  onPickExample,
  onSelectHit,
}: {
  demo: AtlasData["demo"];
  query: string;
  hits: SearchHit[];
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  onPickExample: (q: string) => void;
  onSelectHit: (id: string) => void;
}) {
  const ambiguous = needsDisambiguation(hits);
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_40%),linear-gradient(180deg,#f8fafc,#eef2ff)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
        <h1 className="font-display text-5xl leading-tight text-slate-950 md:text-6xl">
          {demo.product_name || "Rare Disease Atlas"}
        </h1>
        <p className="mt-4 text-xl text-slate-800">
          Follow one search to sourced research connections
        </p>
        <p className="mt-3 text-base text-slate-600">{demo.product_one_liner}</p>
        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="sr-only" htmlFor="atlas-search">
            Search a disease, gene, or variant
          </label>
          <div className="flex gap-2">
            <Input
              id="atlas-search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search a disease, a gene, or a variant — e.g. sickle cell anemia or HBB"
              className="h-14 text-base shadow-sm"
            />
            <Button type="submit" className="h-14 px-6">
              Search
            </Button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {demo.example_searches.map((ex) => (
            <button
              key={ex.query}
              type="button"
              onClick={() => onPickExample(ex.query)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:border-slate-500"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {hits.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              {ambiguous
                ? "Multiple conditions match — choose the intended one"
                : "Matching entities"}
            </h2>
            <ul className="mt-3 space-y-2">
              {hits.map((h) => (
                <li key={h.entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelectHit(h.entry.id)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-3 text-left hover:border-slate-900"
                  >
                    <span className="block font-medium text-slate-900">
                      {h.entry.label}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {h.entry.disambiguation_note}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {h.matchReason}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-xs text-slate-500">
          These conditions already have treatments. This atlas focuses on
          sourced research connections and reusable assets — not treatment
          advice.
        </p>
      </div>
    </div>
  );
}

function Unsupported({
  query,
  demo,
  onBack,
  onTry,
}: {
  query: string;
  demo: AtlasData["demo"];
  onBack: () => void;
  onTry: (q: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-teal-800 hover:underline"
      >
        ← Back to search
      </button>
      <h1 className="font-display mt-4 text-3xl text-slate-950">
        No supported lead for “{query}”
      </h1>
      <p className="mt-3 text-slate-700">
        No curated connection was found within this prototype&apos;s coverage.
        That means it is not in our reviewed dataset — not that it does not
        exist.
      </p>
      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sources / scope searched
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {demo.unsupported_search.sources_searched.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-600">
            {demo.unsupported_search.coverage_note}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Missing evidence
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>A curated entity match for this query in the demonstration layer</li>
            <li>A reviewed edge connecting it into the HbSS / β-thalassemia journey</li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Next research question
          </h2>
          <p className="mt-2 text-sm text-slate-800">
            What primary public source would establish whether “{query}” belongs
            in the HBB hemoglobinopathy atlas, and which disease scope should it
            be mapped to without merging synonyms?
          </p>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-sm text-slate-600">Try a supported example:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {demo.example_searches.map((ex) => (
            <button
              key={ex.query}
              type="button"
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm"
              onClick={() => onTry(ex.query)}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SourcePanel({
  edge,
  nodeMap,
}: {
  edge: GraphEdge | null;
  nodeMap: Map<string, GraphNode>;
}) {
  if (!edge) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg">Source</h2>
        <p className="mt-2 text-sm text-slate-600">
          Select a connection to see its source.
        </p>
      </section>
    );
  }
  const card = sourceCardForEdge(edge, nodeMap);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-display text-lg">Source</h2>
      <p className="mt-1 text-sm text-slate-500">{card.organization}</p>
      {card.url ? (
        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-sm font-semibold leading-snug text-teal-950 underline-offset-2 hover:bg-teal-100 hover:underline"
        >
          {card.linkLabel}
        </a>
      ) : (
        <p className="mt-3 text-base font-semibold leading-snug text-slate-950">
          {card.title}
        </p>
      )}
    </section>
  );
}

function SummaryPanel({
  edge,
  nodeMap,
  plainFallback,
}: {
  edge: GraphEdge | null;
  nodeMap: Map<string, GraphNode>;
  plainFallback?: string;
}) {
  if (!edge) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg">Summary</h2>
        <p className="mt-2 text-sm text-slate-600">
          Select a connection to see the article summary and main findings.
        </p>
      </section>
    );
  }
  const { takeaway, abstract, findings, caveat } = importantSummaryForEdge(
    edge,
    nodeMap,
    plainFallback
  );
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-display text-lg">Summary</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-800">{takeaway}</p>
      {abstract ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Abstract
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            {abstract}
          </p>
        </div>
      ) : null}
      {findings.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Main findings
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-slate-700">
            {findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {caveat ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Caveat: {caveat}
        </p>
      ) : null}
    </section>
  );
}

function AssetPanel({
  assets,
  selectedAssetIds,
  onToggle,
  registryGap,
}: {
  assets: AssetAssessment[];
  selectedAssetIds: string[];
  onToggle: (id: string) => void;
  registryGap: AtlasData["demo"]["registry_gap"];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-display text-xl text-slate-950">Research assets</h2>
      <p className="mt-1 text-sm text-slate-600">
        Verified public assets for this journey. Select items to include in a
        proposal brief.
      </p>
      <div className="mt-4 space-y-4">
        {assets.map((a) => {
          const selected = selectedAssetIds.includes(a.asset_id);
          return (
            <article
              key={a.asset_id}
              className={`rounded-lg border p-4 ${
                selected ? "border-slate-900" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {a.asset_kind.replace(/_/g, " ")}
                  </p>
                  <h3 className="font-medium text-slate-900">{a.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(a.asset_id)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  {selected ? "Selected" : "Select"}
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-700">{a.description}</p>
              <dl className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <Detail label="Owner / maintainer" value={a.owner} />
                <Detail label="Designed for disease" value={a.designed_for.disease} />
                <Detail label="Genotype scope" value={a.designed_for.genotype} />
                <Detail label="Population" value={a.designed_for.population} />
                <Detail label="Species" value={a.designed_for.species} />
                <Detail label="Access" value={a.access} />
              </dl>
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium">Why relevant: </span>
                {a.relevance_to_journey}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <CompareCol title="What may be reusable" items={a.comparison.may_be_reusable} />
                <CompareCol title="What differs" items={a.comparison.what_differs} />
                <CompareCol
                  title="What needs expert review"
                  items={a.comparison.needs_expert_review}
                />
              </div>
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span className="font-semibold">{a.comparison.adaptation_status}: </span>
                {a.comparison.validation_question}
              </p>
              <a
                href={a.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-teal-800 hover:underline"
              >
                {a.source_url}
              </a>
            </article>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <h3 className="font-medium text-slate-900">Patient registry gap</h3>
        <p className="mt-1 text-sm text-slate-700">{registryGap.explanation}</p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Next question: </span>
          {registryGap.next_question}
        </p>
      </div>
    </section>
  );
}

function CompareCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h4>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ProposalModal({
  proposal,
  onClose,
  onChange,
}: {
  proposal: ProposalDraft;
  onClose: () => void;
  onChange: (p: ProposalDraft) => void;
}) {
  const text = formatProposal(proposal);

  async function copy() {
    await navigator.clipboard.writeText(text);
  }

  function download() {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hbb-research-proposal-brief.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 md:items-center">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Sourced research proposal</h2>
            <p className="mt-1 text-sm text-slate-600">
              Editable brief. Proposed activities are distinct from demonstrated
              findings. Nothing is emailed or submitted.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field
            label="Patient group disease / focus"
            value={proposal.diseaseLabel}
            onChange={(v) => onChange({ ...proposal, diseaseLabel: v })}
          />
          <Field
            label="Research question"
            value={proposal.researchQuestion}
            onChange={(v) => onChange({ ...proposal, researchQuestion: v })}
          />
          <Field
            label="Supported connection summary"
            value={proposal.connectionSummary}
            onChange={(v) => onChange({ ...proposal, connectionSummary: v })}
            textarea
          />
          <Field
            label="Proposed resource / collaboration"
            value={proposal.proposedResource}
            onChange={(v) => onChange({ ...proposal, proposedResource: v })}
          />
          <Field
            label="Potential partner"
            value={proposal.partnerLabel}
            onChange={(v) => onChange({ ...proposal, partnerLabel: v })}
          />
          <Field
            label="Evidence with citations (one per line)"
            value={proposal.evidenceBullets.join("\n")}
            onChange={(v) =>
              onChange({
                ...proposal,
                evidenceBullets: v.split("\n").filter(Boolean),
              })
            }
            textarea
          />
          <Field
            label="Known differences / uncertainties"
            value={[...proposal.differences, ...proposal.uncertainties].join("\n")}
            onChange={(v) =>
              onChange({
                ...proposal,
                differences: v.split("\n").filter(Boolean),
                uncertainties: [],
              })
            }
            textarea
          />
          <Field
            label="Questions for prospective partner"
            value={proposal.partnerQuestions.join("\n")}
            onChange={(v) =>
              onChange({
                ...proposal,
                partnerQuestions: v.split("\n").filter(Boolean),
              })
            }
            textarea
          />
          <Field
            label="Concrete proposed next step"
            value={proposal.nextStep}
            onChange={(v) => onChange({ ...proposal, nextStep: v })}
            textarea
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={copy}>Copy brief</Button>
          <Button variant="outline" onClick={download}>
            Download markdown
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {textarea ? (
        <textarea
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function formatProposal(p: ProposalDraft): string {
  return `# Sourced research proposal brief

## Patient group focus
${p.diseaseLabel}

## Research question
${p.researchQuestion}

## Supported connection
${p.connectionSummary}

## Proposed resource or collaboration
${p.proposedResource}

## Potential partner
${p.partnerLabel}

## Evidence with citations
${p.evidenceBullets.map((b) => `- ${b}`).join("\n")}

## Known differences and uncertainties
${[...p.differences, ...p.uncertainties].map((b) => `- ${b}`).join("\n")}

## Questions for the prospective partner
${p.partnerQuestions.map((b) => `- ${b}`).join("\n")}

## Concrete proposed next step
${p.nextStep}

---
Note: Proposed activities are distinct from demonstrated findings. This atlas does not send messages or assert partner availability.
`;
}
