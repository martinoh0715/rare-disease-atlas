"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  searchAcrossDatasets,
  type SearchHit,
} from "@/lib/graph";
import type {
  AssetAssessment,
  AtlasCatalog,
  AtlasData,
  DemoStage,
  ProposalDraft,
} from "@/lib/types";
import { importantSummaryForEdge, sourceCardForEdge } from "@/lib/sourceMeta";

type Mode = "landing" | "workspace" | "unsupported";

function partnerOptions(demo: AtlasData["demo"], nodes: GraphNode[]) {
  const fromAssets = demo.asset_assessments
    .filter((a) => a.asset_kind === "patient_organization")
    .map((a) => ({ id: a.asset_id, label: a.title }));
  if (fromAssets.length) return fromAssets;
  return nodes
    .filter((n) => n.type === "organization")
    .map((n) => ({ id: n.id, label: n.label }));
}

export function AtlasApp({
  catalog,
  datasets,
}: {
  catalog: AtlasCatalog;
  datasets: AtlasData[];
}) {
  const datasetMap = useMemo(
    () => new Map(datasets.map((d) => [d.id, d])),
    [datasets]
  );
  const defaultDatasetId = catalog.default_dataset_id || datasets[0]?.id;
  const defaultDataset = datasetMap.get(defaultDatasetId) || datasets[0];

  const [mode, setMode] = useState<Mode>("landing");
  const [datasetId, setDatasetId] = useState<string>(defaultDataset.id);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [focusId, setFocusId] = useState<string>(
    defaultDataset.demo.default_focus_id ||
      catalog.datasets.find((d) => d.id === defaultDataset.id)?.default_focus_id ||
      defaultDataset.curated.nodes.find((n) => n.type === "disease")?.id ||
      defaultDataset.curated.nodes[0]?.id ||
      ""
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string>("understand");
  const [expanded, setExpanded] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    defaultDataset.demo.default_asset_ids || []
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState(
    defaultDataset.demo.default_partner_id ||
      partnerOptions(defaultDataset.demo, defaultDataset.curated.nodes)[0]?.id ||
      ""
  );
  const [proposal, setProposal] = useState<ProposalDraft | null>(null);
  const [unsupportedQuery, setUnsupportedQuery] = useState("");
  const [focusHistory, setFocusHistory] = useState<string[]>([]);
  const [enabledCategories, setEnabledCategories] = useState<string[]>(() =>
    defaultDataset.demo.category_legend.map((c) => c.id)
  );
  const [legendOpen, setLegendOpen] = useState(true);
  const graphSectionRef = useRef<HTMLElement | null>(null);
  const [graphSectionHeight, setGraphSectionHeight] = useState<number | null>(
    null
  );

  const active = datasetMap.get(datasetId) || defaultDataset;
  const curated = active.curated;
  const journey = active.journey;
  const demo = active.demo;

  const allExampleSearches = useMemo(() => {
    const seen = new Set<string>();
    const out: { label: string; query: string }[] = [];
    for (const d of datasets) {
      for (const ex of d.demo.example_searches) {
        const key = ex.query.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ex);
      }
    }
    return out;
  }, [datasets]);

  const mergedUnsupported = useMemo(() => {
    const sources = new Set<string>();
    const notes: string[] = [];
    for (const d of datasets) {
      d.demo.unsupported_search.sources_searched.forEach((s) => sources.add(s));
      notes.push(d.demo.unsupported_search.coverage_note);
    }
    return {
      sources_searched: [...sources],
      coverage_note:
        notes[0] ||
        "Coverage is limited to the curated demonstration datasets in this prototype.",
    };
  }, [datasets]);

  const nodeMap = useMemo(
    () => new Map(curated.nodes.map((n) => [n.id, n])),
    [curated]
  );
  const edgeMap = useMemo(
    () => new Map(curated.edges.map((e) => [e.id, e])),
    [curated]
  );
  const partners = useMemo(
    () => partnerOptions(demo, curated.nodes),
    [demo, curated.nodes]
  );

  useEffect(() => {
    const validAssets = new Set(demo.asset_assessments.map((a) => a.asset_id));
    setSelectedAssetIds((prev) => {
      const next = prev.filter((id) => validAssets.has(id));
      const fallback = demo.default_asset_ids || [];
      const resolved = next.length ? next : fallback;
      if (
        resolved.length === prev.length &&
        resolved.every((id, i) => id === prev[i])
      ) {
        return prev;
      }
      return resolved;
    });
    const partnerIds = new Set(partners.map((p) => p.id));
    setSelectedPartnerId((prev) => {
      if (partnerIds.has(prev)) return prev;
      return demo.default_partner_id || partners[0]?.id || "";
    });
  }, [datasetId, demo.default_asset_ids, demo.default_partner_id, demo.asset_assessments, partners]);

  const stages = (journey.stages || demo.stages) as DemoStage[];
  const stage = stages.find((s) => s.id === stageId) || stages[0];
  const productName =
    demo.product_name || catalog.product_name || "Rare Disease Atlas";
  const datasetLabel = demo.dataset_label || active.id;
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

  useEffect(() => {
    if (mode !== "workspace") return;
    const el = graphSectionRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      setGraphSectionHeight(Math.round(el.getBoundingClientRect().height));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, stageId, focusId, expanded, local.nodes.length, legendOpen]);

  const assetAssessments = demo.asset_assessments;
  const visibleAssets = assetAssessments.filter((a) =>
    stageId === "understand"
      ? false
      : stage?.node_ids.includes(a.asset_id) ||
        selectedAssetIds.includes(a.asset_id) ||
        stageId === "explore" ||
        stageId === "prepare"
  );

  function searchAll(q: string): SearchHit[] {
    return searchAcrossDatasets(
      datasets.map((d) => ({
        id: d.id,
        label: d.demo.dataset_label || d.id,
        entries: d.demo.search_entries,
      })),
      q
    );
  }

  function runSearch(raw: string) {
    const q = raw.trim();
    setQuery(q);
    if (!q) {
      setHits([]);
      return;
    }
    const found = searchAll(q);
    setHits(found);
    if (found.length === 0) {
      setUnsupportedQuery(q);
      setMode("unsupported");
      return;
    }
    const top = found[0];
    const clearWinner =
      found.length === 1 ||
      top.score >= 95 ||
      (!needsDisambiguation(found) && top.score - (found[1]?.score || 0) >= 20);
    if (clearWinner) {
      enterWorkspace(top.entry.id, top.datasetId || datasetId);
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

  function enterWorkspace(nodeId: string, nextDatasetId: string = datasetId) {
    const next = datasetMap.get(nextDatasetId) || active;
    const nextDemo = next.demo;
    const nextStages = (next.journey.stages || nextDemo.stages) as DemoStage[];
    const nextEdges = next.curated.edges;
    const switching = nextDatasetId !== datasetId;

    if (switching) {
      setDatasetId(nextDatasetId);
      setSelectedAssetIds(nextDemo.default_asset_ids || []);
      setSelectedPartnerId(
        nextDemo.default_partner_id ||
          partnerOptions(nextDemo, next.curated.nodes)[0]?.id ||
          ""
      );
      setProposal(null);
      setProposalOpen(false);
      setSelectedEdgeId(null);
    }

    setFocusHistory([]);
    setFocusId(nodeId);
    setMode("workspace");
    setExpanded(false);
    setEnabledCategories(nextDemo.category_legend.map((c) => c.id));
    const startStage =
      nextStages.find((s) => s.node_ids.includes(nodeId))?.id || "understand";
    setStageId(startStage);
    const stageEdges = nextStages.find((s) => s.id === startStage)?.edge_ids || [];
    const firstEdge =
      stageEdges.find((id) => {
        const e = nextEdges.find((edge) => edge.id === id);
        return e && (e.source === nodeId || e.target === nodeId);
      }) ||
      nextEdges.find((e) => e.source === nodeId || e.target === nodeId)?.id ||
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
    const defaultDiseaseId =
      demo.default_focus_id ||
      stage?.anchor_node_id ||
      curated.nodes.find((n) => n.type === "disease")?.id;
    const disease =
      (defaultDiseaseId && nodeMap.get(defaultDiseaseId)) ||
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

    const questionNode =
      curated.nodes.find((n) => n.type === "research_question") || null;
    const uncertainties = [
      ...(questionNode?.uncertainties || []),
      demo.registry_gap.explanation,
    ];
    const partnerQuestions = assets.map(
      (a) => a.comparison.validation_question
    );
    const differences = assets.flatMap((a) => a.comparison.what_differs);

    const draft: ProposalDraft = {
      diseaseLabel: disease.label,
      researchQuestion: demo.proposal_defaults.research_question,
      connectionSummary: journey.plain_language,
      proposedResource:
        assets.map((a) => a.title).join("; ") || "No asset selected",
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
        productName={productName}
        productOneLiner={catalog.product_one_liner}
        disclaimer="This atlas focuses on sourced research connections and reusable assets — not treatment advice. Curated slices differ: some conditions already have treatments; ARID1B-RD has no approved disease-modifying therapy in this layer."
        exampleSearches={allExampleSearches}
        query={query}
        hits={hits}
        onQueryChange={(v) => {
          setQuery(v);
          setHits(searchAll(v));
        }}
        onSubmit={() => runSearch(query)}
        onPickExample={(q) => {
          setQuery(q);
          runSearch(q);
        }}
        onSelectHit={(id, hitDatasetId) =>
          enterWorkspace(id, hitDatasetId || datasetId)
        }
      />
    );
  }

  if (mode === "unsupported") {
    return (
      <Unsupported
        query={unsupportedQuery}
        unsupportedSearch={mergedUnsupported}
        missingEvidence={
          demo.unsupported_missing_evidence || [
            "A curated entity match for this query in the demonstration layer",
            "A reviewed edge connecting it into a curated dataset journey",
          ]
        }
        nextQuestion={(
          demo.unsupported_next_question_template ||
          'What primary public source would establish whether "{query}" belongs in the Rare Disease Atlas curated layer?'
        ).replace("{query}", unsupportedQuery)}
        exampleSearches={allExampleSearches}
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
    <div className="min-h-screen bg-soft text-ink">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <button
            type="button"
            className="font-display text-[18px] font-semibold tracking-tight transition-colors duration-atlas hover:text-teal-200"
            onClick={() => setMode("landing")}
          >
            {productName}
          </button>
          <span className="hidden rounded-atlas border border-slate-600 px-2 py-1 text-xs text-slate-200 sm:inline">
            {datasetLabel}
          </span>
          <form
            className="flex min-w-[240px] flex-1"
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
              className="h-11 rounded-r-none border-slate-600 bg-white text-ink"
            />
            <Button
              type="submit"
              variant="secondary"
              className="h-11 rounded-l-none px-5"
            >
              Search
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-4 md:space-y-5 md:px-6 md:py-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch lg:gap-5">
          <section
            ref={graphSectionRef}
            className="atlas-panel p-4 md:p-5"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-sm font-semibold text-slate-500">
                  Focused graph
                </p>
                <h1 className="font-display mt-1 text-[26px] font-bold leading-tight text-ink md:text-[28px]">
                  {focusNode?.label}
                </h1>
                <p className="atlas-meta mt-1 capitalize">
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

            <div className="relative overflow-hidden rounded-atlas border border-line bg-slate-50">
              <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[280px] items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={goBack}
                  disabled={focusHistory.length === 0}
                  aria-label="Back to previous node"
                  className="h-9 shrink-0 px-2"
                >
                  ← Back
                </Button>
                <span className="truncate text-sm text-slate-600">
                  {focusHistory.length > 0
                    ? `Previous: ${
                        nodeMap.get(focusHistory[focusHistory.length - 1])
                          ?.label || "node"
                      }`
                    : "No previous node yet"}
                </span>
              </div>

              <div className="pointer-events-auto absolute right-3 top-3 z-20 w-[250px] rounded-atlas border border-line bg-white shadow-atlas">
                <div className="flex items-center justify-between gap-2 border-b border-line bg-slate-50 px-3 py-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between rounded-sm text-left transition-colors duration-atlas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
                    onClick={() => setLegendOpen((v) => !v)}
                    aria-expanded={legendOpen}
                    aria-controls="graph-legend-body"
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      Legend
                    </span>
                    <span className="text-sm text-slate-500" aria-hidden>
                      {legendOpen ? "▲" : "▼"}
                    </span>
                  </button>
                </div>
                {legendOpen ? (
                  <div id="graph-legend-body">
                    <div className="flex justify-end gap-1 border-b border-slate-100 px-2 py-1.5">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-sm font-medium text-moss-800 transition-colors duration-atlas hover:bg-moss-50"
                        onClick={() =>
                          setEnabledCategories(
                            demo.category_legend.map((c) => c.id)
                          )
                        }
                      >
                        Check all
                      </button>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-sm font-medium text-slate-600 transition-colors duration-atlas hover:bg-slate-100"
                        onClick={() => setEnabledCategories([])}
                      >
                        Uncheck all
                      </button>
                    </div>
                    <ul className="max-h-48 space-y-0.5 overflow-auto px-2 py-2">
                      {demo.category_legend.map((c) => {
                        const count = local.allNodes.filter(
                          (n) => legendCategoryForType(n.type) === c.id
                        ).length;
                        if (count === 0) return null;
                        const checked = enabledCategorySet.has(c.id);
                        return (
                          <li key={c.id}>
                            <label
                              className={`flex min-h-9 cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors duration-atlas ${
                                checked
                                  ? "bg-white text-slate-800"
                                  : "bg-slate-50 text-slate-400"
                              } hover:bg-slate-100`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-teal-700"
                                checked={checked}
                                onChange={() => toggleCategory(c.id)}
                              />
                              <span
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                                style={{
                                  background: checked ? c.color : "#cbd5e1",
                                }}
                                aria-hidden
                              />
                              <span className="flex-1">{c.label}</span>
                              <span className="tabular-nums text-slate-500">
                                {count}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="border-t border-line px-3 py-2 text-sm leading-snug text-slate-500">
                      Toggle categories to show or hide nodes. Dashed = proposed.
                    </p>
                  </div>
                ) : null}
              </div>

              <NetworkCanvas
                focusId={focusId}
                nodes={local.nodes}
                edges={local.edges}
                selectedEdgeId={selectedEdgeId}
                legend={demo.category_legend}
                legendCollapsed={!legendOpen}
                onSelectNode={(id) => goToNode(id)}
                onSelectEdge={setSelectedEdgeId}
              />
            </div>

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

          <aside
            className="flex min-h-0 flex-col gap-4 lg:sticky lg:top-4"
            style={
              graphSectionHeight
                ? { height: graphSectionHeight, maxHeight: graphSectionHeight }
                : undefined
            }
          >
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

        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          <section className="atlas-panel p-4 md:p-5">
            <h2 className="font-display text-[18px] font-semibold text-ink md:text-[20px]">
              Guided discovery
            </h2>
            <p className="atlas-meta mt-2 leading-relaxed">
              A 3-step tour. Each step fits a curated path on the graph —
              biology first, then studies and partners, then a next-step brief.
            </p>
            <ol className="mt-4 grid gap-2 sm:grid-cols-3">
              {stages.map((s, idx) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => chooseStage(s.id)}
                    className={`h-full min-h-11 w-full rounded-atlas border px-3 py-2.5 text-left text-sm transition-colors duration-atlas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                      stageId === s.id
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-white hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm opacity-70">
                      Step {idx + 1}
                    </span>
                    <span className="font-medium">{s.label}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="atlas-meta mt-3">{stage?.summary}</p>
          </section>

          <section className="atlas-panel p-4 md:p-5">
            <h2 className="font-display text-[18px] font-semibold text-ink md:text-[20px]">
              Prepare next step
            </h2>
            <p className="atlas-meta mt-2 leading-relaxed">
              Choose a partner organization and assets, then generate an
              editable sourced brief. Nothing is sent automatically.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-600">
              Potential partner
            </label>
            <select
              className="mt-1 h-11 w-full rounded-atlas border border-line bg-white px-3 text-base text-ink transition-colors duration-atlas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
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
          datasetId={datasetId}
          onClose={() => setProposalOpen(false)}
          onChange={setProposal}
        />
      )}
    </div>
  );
}

function Landing({
  productName,
  productOneLiner,
  disclaimer,
  exampleSearches,
  query,
  hits,
  onQueryChange,
  onSubmit,
  onPickExample,
  onSelectHit,
}: {
  productName: string;
  productOneLiner: string;
  disclaimer: string;
  exampleSearches: { label: string; query: string }[];
  query: string;
  hits: SearchHit[];
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  onPickExample: (q: string) => void;
  onSelectHit: (id: string, datasetId?: string) => void;
}) {
  const ambiguous = needsDisambiguation(hits);
  return (
    <div className="min-h-screen bg-soft">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-14 md:px-6 md:py-16">
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink md:text-[30px]">
          {productName}
        </h1>
        <p className="mt-3 text-lg text-slate-800 md:text-xl">
          Follow one search to sourced research connections
        </p>
        <p className="atlas-meta mt-2 text-base">{productOneLiner}</p>
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="atlas-search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search a disease, a gene, or a variant — e.g. sickle cell anemia or ARID1B"
              className="h-12 text-base"
            />
            <Button type="submit" size="lg" className="sm:h-12 sm:px-6">
              Search
            </Button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {exampleSearches.map((ex) => (
            <button
              key={ex.query}
              type="button"
              onClick={() => onPickExample(ex.query)}
              className="min-h-9 rounded-atlas border border-line bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors duration-atlas hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {hits.length > 0 && (
          <div className="atlas-panel mt-6 p-4 md:p-5">
            <h2 className="text-[18px] font-semibold text-ink">
              {ambiguous
                ? "Multiple conditions match — choose the intended one"
                : "Matching entities"}
            </h2>
            <ul className="mt-3 space-y-2">
              {hits.map((h) => (
                <li key={`${h.datasetId || "dataset"}:${h.entry.id}`}>
                  <button
                    type="button"
                    onClick={() => onSelectHit(h.entry.id, h.datasetId)}
                    className="w-full rounded-atlas border border-line px-3 py-3 text-left transition-colors duration-atlas hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
                  >
                    <span className="block text-base font-medium text-ink">
                      {h.entry.label}
                    </span>
                    <span className="atlas-meta mt-1 block">
                      {h.entry.disambiguation_note}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {h.matchReason}
                      {h.datasetLabel ? ` · ${h.datasetLabel}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="atlas-meta mt-8">{disclaimer}</p>
      </div>
    </div>
  );
}

function Unsupported({
  query,
  unsupportedSearch,
  missingEvidence,
  nextQuestion,
  exampleSearches,
  onBack,
  onTry,
}: {
  query: string;
  unsupportedSearch: { sources_searched: string[]; coverage_note: string };
  missingEvidence: string[];
  nextQuestion: string;
  exampleSearches: { label: string; query: string }[];
  onBack: () => void;
  onTry: (q: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <button
        type="button"
        onClick={onBack}
        className="text-base font-medium text-moss-800 underline-offset-2 transition-colors duration-atlas hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
      >
        ← Back to search
      </button>
      <h1 className="font-display mt-4 text-[28px] font-bold text-ink md:text-[30px]">
        No supported lead for “{query}”
      </h1>
      <p className="mt-3 text-base text-slate-700">
        No curated connection was found within this prototype&apos;s coverage.
        That means it is not in our reviewed dataset — not that it does not
        exist.
      </p>
      <div className="atlas-panel mt-6 space-y-5 p-5">
        <div>
          <h2 className="text-base font-bold text-ink">
            Sources / scope searched
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-700">
            {unsupportedSearch.sources_searched.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="atlas-meta mt-2">{unsupportedSearch.coverage_note}</p>
        </div>
        <div>
          <h2 className="text-base font-bold text-ink">Missing evidence</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-700">
            {missingEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-base font-bold text-ink">
            Next research question
          </h2>
          <p className="mt-2 text-base text-slate-800">{nextQuestion}</p>
        </div>
      </div>
      <div className="mt-6">
        <p className="atlas-meta">Try a supported example:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {exampleSearches.map((ex) => (
            <button
              key={ex.query}
              type="button"
              className="min-h-9 rounded-atlas border border-line bg-white px-3 py-1.5 text-sm transition-colors duration-atlas hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
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
      <section className="atlas-panel shrink-0 p-4 md:p-5">
        <h2 className="font-display text-[18px] font-semibold text-ink md:text-[20px]">
          Source
        </h2>
        <p className="atlas-meta mt-2">
          Select a connection to see its source.
        </p>
      </section>
    );
  }
  const card = sourceCardForEdge(edge, nodeMap);
  return (
    <section className="atlas-panel shrink-0 p-4 md:p-5">
      <h2 className="font-display text-[18px] font-semibold text-ink md:text-[20px]">
        Source
      </h2>
      <p className="atlas-meta mt-1">{card.organization}</p>
      {card.url ? (
        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block break-words rounded-atlas border border-moss-100 bg-moss-50 px-3 py-3 text-base font-semibold leading-snug text-moss-900 underline-offset-2 transition-colors duration-atlas hover:bg-moss-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
        >
          {card.linkLabel}
        </a>
      ) : (
        <p className="mt-3 text-base font-semibold leading-snug text-ink">
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
      <section className="atlas-panel flex min-h-0 flex-1 flex-col p-4 md:p-5">
        <h2 className="font-display text-[18px] font-semibold text-ink md:text-[20px]">
          Summary
        </h2>
        <p className="atlas-meta mt-2">
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
    <section className="atlas-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-line px-4 py-3 md:px-5">
        <h2 className="font-display text-[18px] font-semibold text-ink md:text-[20px]">
          Summary
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-5 md:py-4">
        <p className="text-base leading-relaxed text-slate-800">{takeaway}</p>
        {abstract ? (
          <div className="mt-5">
            <h3 className="text-base font-bold text-ink">Abstract</h3>
            <p className="mt-2 text-base leading-relaxed text-slate-700">
              {abstract}
            </p>
          </div>
        ) : null}
        {findings.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-base font-bold text-ink">Main findings</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-700">
              {findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {edge.evidence?.supporting_passage ? (
          <div className="mt-5">
            <h3 className="text-base font-bold text-ink">Supporting detail</h3>
            <p className="mt-2 break-words text-base leading-relaxed text-slate-700">
              {edge.evidence.supporting_passage}
            </p>
          </div>
        ) : null}
        {edge.evidence?.genotype_context || edge.evidence?.population_context ? (
          <div className="mt-5">
            <h3 className="text-base font-bold text-ink">Context</h3>
            <dl className="mt-2 space-y-1.5 text-base text-slate-700">
              {edge.evidence.genotype_context ? (
                <div>
                  <dt className="inline font-semibold text-slate-600">
                    Genotype:{" "}
                  </dt>
                  <dd className="inline">{edge.evidence.genotype_context}</dd>
                </div>
              ) : null}
              {edge.evidence.population_context ? (
                <div>
                  <dt className="inline font-semibold text-slate-600">
                    Population:{" "}
                  </dt>
                  <dd className="inline">{edge.evidence.population_context}</dd>
                </div>
              ) : null}
              {edge.evidence.species ? (
                <div>
                  <dt className="inline font-semibold text-slate-600">
                    Species:{" "}
                  </dt>
                  <dd className="inline">{edge.evidence.species}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
        {caveat ? (
          <p className="atlas-meta mt-5 leading-relaxed">Caveat: {caveat}</p>
        ) : null}
      </div>
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
    <section className="atlas-panel p-4 md:p-5">
      <h2 className="font-display text-[20px] font-semibold text-ink">
        Research assets
      </h2>
      <p className="atlas-meta mt-1">
        Verified public assets for this journey. Select items to include in a
        proposal brief.
      </p>
      <div className="mt-4 space-y-4">
        {assets.map((a) => {
          const selected = selectedAssetIds.includes(a.asset_id);
          return (
            <article
              key={a.asset_id}
              className={`rounded-atlas border p-4 transition-colors duration-atlas ${
                selected
                  ? "border-ink bg-slate-50"
                  : "border-line bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {a.asset_kind.replace(/_/g, " ")}
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold text-ink">
                    {a.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(a.asset_id)}
                  className={`min-h-9 rounded-atlas border px-3 py-1.5 text-sm font-medium transition-colors duration-atlas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                    selected
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:bg-slate-50"
                  }`}
                >
                  {selected ? "Selected" : "Select"}
                </button>
              </div>
              <p className="mt-2 text-base leading-relaxed text-slate-700">
                {a.description}
              </p>
              <dl className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 md:text-base">
                <Detail label="Owner / maintainer" value={a.owner} />
                <Detail label="Designed for disease" value={a.designed_for.disease} />
                <Detail label="Genotype scope" value={a.designed_for.genotype} />
                <Detail label="Population" value={a.designed_for.population} />
                <Detail label="Species" value={a.designed_for.species} />
                <Detail label="Access" value={a.access} />
              </dl>
              <p className="mt-2 text-base text-slate-700">
                <span className="font-semibold">Why relevant: </span>
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
              <p className="mt-3 rounded-atlas border border-amber-200 bg-amber-50 px-3 py-2 text-base text-amber-950">
                <span className="font-semibold">{a.comparison.adaptation_status}: </span>
                {a.comparison.validation_question}
              </p>
              <a
                href={a.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block break-all text-base text-moss-800 underline-offset-2 hover:underline"
              >
                {a.source_url}
              </a>
            </article>
          );
        })}
      </div>
      <div className="mt-4 rounded-atlas border border-dashed border-line bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-ink">Patient registry gap</h3>
        <p className="mt-1 text-base text-slate-700">{registryGap.explanation}</p>
        <p className="mt-2 text-base text-slate-700">
          <span className="font-semibold">Next question: </span>
          {registryGap.next_question}
        </p>
      </div>
    </section>
  );
}

function CompareCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-atlas bg-slate-50 p-3">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm text-slate-700 md:text-base">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ProposalModal({
  proposal,
  datasetId,
  onClose,
  onChange,
}: {
  proposal: ProposalDraft;
  datasetId: string;
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
    a.download = `${datasetId}-research-proposal-brief.md`;
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
