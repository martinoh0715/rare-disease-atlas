"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NetworkCanvas } from "@/components/NetworkCanvas";
import {
  CollaborationBriefModal,
  ResearchOpportunityPanel,
  type AssetOption,
  type PartnerOption,
} from "@/components/ResearchOpportunityPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listCandidateAssets,
  listPartnerOrganizations,
} from "@/lib/evaluation/assets";
import type {
  CollaborationBrief,
  EvaluationEvidencePackage,
  EvaluationResult,
} from "@/lib/evaluation/types";
import {
  buildCollaborationBrief,
  formatCollaborationBriefMarkdown,
} from "@/lib/evaluation/validate";
import {
  GraphEdge,
  GraphNode,
  legendCategoryForType,
  needsDisambiguation,
  neighborhood,
  pathNeighborhood,
  searchAcrossDatasets,
  type SearchHit,
} from "@/lib/graph";
import type {
  AssetAssessment,
  AtlasCatalog,
  AtlasData,
  DatasetCatalogEntry,
  DemoStage,
} from "@/lib/types";
import { importantSummaryForEdge, sourceCardForEdge } from "@/lib/sourceMeta";

type Mode = "landing" | "workspace" | "unsupported";

/** Independent exploration views — not a required sequence. */
const EXPLORATION_VIEW_IDS = new Set(["understand", "explore"]);

function journeyStatusLabel(status?: string) {
  if (status === "partial") return "Partial path";
  if (status === "complete") return "Complete path";
  return null;
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
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [unsupportedQuery, setUnsupportedQuery] = useState("");
  const [focusHistory, setFocusHistory] = useState<string[]>([]);
  const [viewNote, setViewNote] = useState<string | null>(null);
  const [enabledCategories, setEnabledCategories] = useState<string[]>(() =>
    defaultDataset.demo.category_legend.map((c) => c.id)
  );
  const [evalDiseaseId, setEvalDiseaseId] = useState<string>(
    defaultDataset.demo.default_focus_id ||
      defaultDataset.curated.nodes.find((n) => n.type === "disease")?.id ||
      ""
  );
  /** Empty until the user selects an asset (Explore or evaluation form). */
  const [evalAssetId, setEvalAssetId] = useState<string>("");
  const [evalPartnerId, setEvalPartnerId] = useState<string>("");
  /** Empty by default — never auto-filled from proposal_defaults or graph nodes. */
  const [researchObjective, setResearchObjective] = useState("");
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefMarkdown, setBriefMarkdown] = useState("");
  const [briefMeta, setBriefMeta] = useState<CollaborationBrief | null>(null);
  const evalAbortRef = useRef<AbortController | null>(null);
  const evalRequestIdRef = useRef(0);
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
    for (const d of datasets) {
      d.demo.unsupported_search.sources_searched.forEach((s) => sources.add(s));
    }
    const labels = catalog.datasets.map((d) => d.label).join(", ");
    return {
      sources_searched:
        sources.size > 0
          ? [...sources]
          : catalog.datasets.map(
              (d) => `Curated ${d.label} demonstration layer`
            ),
      coverage_note: `Coverage is limited to the curated demonstration datasets in this prototype (${labels}). “Not in our dataset” means this query is outside those curated layers — not that no scientific connection exists.`,
    };
  }, [datasets, catalog.datasets]);

  const nodeMap = useMemo(
    () => new Map(curated.nodes.map((n) => [n.id, n])),
    [curated]
  );
  const edgeMap = useMemo(
    () => new Map(curated.edges.map((e) => [e.id, e])),
    [curated]
  );
  useEffect(() => {
    setSelectedAssetIds([]);
    // Evaluations are dataset-scoped; never carry them across collections.
    evalAbortRef.current?.abort();
    evalAbortRef.current = null;
    evalRequestIdRef.current += 1;
    setEvalResult(null);
    setEvalError(null);
    setEvalLoading(false);
    setResearchObjective("");
    setBriefOpen(false);
    setBriefMeta(null);
    setBriefMarkdown("");
    setViewNote(null);
    const nextDisease =
      demo.default_focus_id ||
      curated.nodes.find((n) => n.type === "disease")?.id ||
      "";
    setEvalDiseaseId(nextDisease);
    setEvalAssetId("");
    setEvalPartnerId("");
  }, [datasetId, demo.default_asset_ids, demo.asset_assessments, curated.nodes]);

  const stages = useMemo(
    () =>
      ((journey.stages || demo.stages) as DemoStage[]).filter((s) =>
        EXPLORATION_VIEW_IDS.has(s.id)
      ),
    [journey.stages, demo.stages]
  );
  const stage = stages.find((s) => s.id === stageId) || stages[0];

  // Legacy "prepare" stage is removed from navigation — coerce if needed.
  useEffect(() => {
    if (!stages.some((s) => s.id === stageId) && stages[0]) {
      setStageId(stages[0].id);
    }
  }, [stageId, stages]);
  const productName =
    demo.product_name || catalog.product_name || "Rare Disease Atlas";
  const datasetLabel = demo.dataset_label || active.id;
  const journeyStatus = demo.journey_status;
  const journeyStatusNote = demo.journey_status_note;
  const catalogById = useMemo(
    () => new Map(catalog.datasets.map((d) => [d.id, d])),
    [catalog.datasets]
  );
  const enabledCategorySet = useMemo(
    () => new Set(enabledCategories),
    [enabledCategories]
  );

  const focusNode = nodeMap.get(focusId) || null;
  const selectedEdge = selectedEdgeId ? edgeMap.get(selectedEdgeId) || null : null;

  const diseaseOptions = useMemo(
    () =>
      curated.nodes
        .filter((n) => n.type === "disease")
        .map((n) => ({ id: n.id, label: n.label })),
    [curated.nodes]
  );

  const needsDiseasePick = useMemo(() => {
    if (!evalDiseaseId) return true;
    const n = nodeMap.get(evalDiseaseId);
    return !n || n.type !== "disease";
  }, [evalDiseaseId, nodeMap]);

  const assetOptions: AssetOption[] = useMemo(() => {
    if (!evalDiseaseId || needsDiseasePick) return [];
    return listCandidateAssets(curated, evalDiseaseId, demo.asset_assessments);
  }, [curated, demo.asset_assessments, evalDiseaseId, needsDiseasePick]);

  const partnerOptions: PartnerOption[] = useMemo(() => {
    if (!evalDiseaseId || needsDiseasePick) return [];
    return listPartnerOrganizations(
      curated,
      evalDiseaseId,
      demo.asset_assessments
    );
  }, [curated, demo.asset_assessments, evalDiseaseId, needsDiseasePick]);

  function selectEvaluationAsset(id: string) {
    setEvalAssetId(id);
    setSelectedAssetIds(id ? [id] : []);
    setEvalResult(null);
    setEvalError(null);
    setBriefOpen(false);
  }

  // Keep evaluation disease in sync when user focuses a disease node.
  useEffect(() => {
    if (focusNode?.type === "disease") {
      setEvalDiseaseId(focusNode.id);
      setEvalResult(null);
      setEvalError(null);
    } else if (
      focusNode &&
      ["clinical_study", "research_asset", "publication", "intervention"].includes(
        focusNode.type
      )
    ) {
      selectEvaluationAsset(focusNode.id);
    } else if (focusNode?.type === "organization") {
      setEvalPartnerId(focusNode.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNode]);

  useEffect(() => {
    // Stale-guard: changing disease/asset/objective/partner clears prior assessment display.
    evalRequestIdRef.current += 1;
    evalAbortRef.current?.abort();
    evalAbortRef.current = null;
    setEvalLoading(false);
    setEvalResult(null);
    setEvalError(null);
    setBriefOpen(false);
  }, [evalDiseaseId, evalAssetId, evalPartnerId, researchObjective, datasetId]);

  useEffect(() => {
    if (!evalAssetId) return;
    if (!assetOptions.some((a) => a.id === evalAssetId)) {
      // Keep selection empty rather than auto-picking an unrelated asset.
      setEvalAssetId("");
      setSelectedAssetIds([]);
    }
  }, [assetOptions, evalAssetId]);

  useEffect(() => {
    if (!evalPartnerId) return;
    if (!partnerOptions.some((p) => p.id === evalPartnerId)) {
      setEvalPartnerId("");
    }
  }, [partnerOptions, evalPartnerId]);

  const evalEvidenceUrlById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of curated.edges) {
      map.set(`ev:${e.id}:passage`, e.evidence?.source_url || null);
      map.set(`ev:${e.id}:curator`, e.evidence?.source_url || null);
      map.set(`ev:${e.id}`, e.evidence?.source_url || null);
    }
    for (const n of curated.nodes) {
      map.set(`ev:node:${n.id}`, (n.source_url as string | undefined) || null);
      map.set(
        `ev:node:${n.id}:abstract`,
        (n.source_url as string | undefined) || null
      );
    }
    for (const a of demo.asset_assessments) {
      map.set(`ev:assessment:${a.asset_id}`, a.source_url || null);
    }
    return map;
  }, [curated, demo.asset_assessments]);

  const evalEvidencePassageById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of curated.edges) {
      if (e.evidence?.supporting_passage) {
        map.set(`ev:${e.id}:passage`, String(e.evidence.supporting_passage));
        map.set(`ev:${e.id}`, String(e.evidence.supporting_passage));
      }
      if (e.plain_language) {
        map.set(`ev:${e.id}:curator`, String(e.plain_language));
      }
    }
    for (const n of curated.nodes) {
      if (n.plain_language) map.set(`ev:node:${n.id}`, String(n.plain_language));
      if (typeof n.abstract === "string") {
        map.set(`ev:node:${n.id}:abstract`, n.abstract);
      }
      if (Array.isArray(n.main_findings)) {
        map.set(
          `ev:node:${n.id}:main_findings`,
          n.main_findings.map(String).join(" | ")
        );
      }
    }
    for (const a of demo.asset_assessments) {
      map.set(
        `ev:assessment:${a.asset_id}`,
        `${a.description} Access: ${a.access}`
      );
    }
    return map;
  }, [curated, demo.asset_assessments]);

  const evalEvidenceTitleById = useMemo(() => {
    const map = new Map<string, string>();
    const titleFor = (nodeId: string) => {
      const n = nodeMap.get(nodeId);
      if (!n) return nodeId;
      const official = n.official_title as string | undefined;
      const pmid = n.pmid as string | undefined;
      const nct = n.nct_id as string | undefined;
      const base = official || n.label;
      if (pmid) return `${base} (PMID:${pmid})`;
      if (nct) return `${base} (${nct})`;
      return base;
    };
    for (const e of curated.edges) {
      const prefer =
        nodeMap.get(e.source)?.type === "publication" ||
        nodeMap.get(e.source)?.type === "clinical_study"
          ? e.source
          : nodeMap.get(e.target)?.type === "publication" ||
              nodeMap.get(e.target)?.type === "clinical_study"
            ? e.target
            : e.source;
      const t = titleFor(prefer);
      map.set(`ev:${e.id}:passage`, t);
      map.set(`ev:${e.id}:curator`, t);
      map.set(`ev:${e.id}`, t);
    }
    for (const n of curated.nodes) {
      const t = titleFor(n.id);
      map.set(`ev:node:${n.id}`, t);
      map.set(`ev:node:${n.id}:abstract`, t);
      map.set(`ev:node:${n.id}:main_findings`, t);
    }
    for (const a of demo.asset_assessments) {
      map.set(`ev:assessment:${a.asset_id}`, a.title);
    }
    return map;
  }, [curated, demo.asset_assessments, nodeMap]);

  const evalEvidenceKindById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of curated.edges) {
      map.set(`ev:${e.id}:passage`, "source_passage");
      map.set(`ev:${e.id}:curator`, "curator_summary");
      map.set(`ev:${e.id}`, "source_passage");
    }
    for (const n of curated.nodes) {
      map.set(`ev:node:${n.id}`, "curator_summary");
      map.set(`ev:node:${n.id}:abstract`, "source_passage");
      map.set(`ev:node:${n.id}:main_findings`, "source_passage");
    }
    for (const a of demo.asset_assessments) {
      map.set(`ev:assessment:${a.asset_id}`, "asset_record");
    }
    return map;
  }, [curated, demo.asset_assessments]);

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

    // View paths show the curated multi-hop neighborhood for that exploration view.
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
          "This view has no sourced connections to display yet. Try the other exploration view or a different disease context.";
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
  }, [mode, stageId, focusId, expanded, local.nodes.length]);

  const assetAssessments = demo.asset_assessments;
  const visibleAssets =
    stageId === "explore"
      ? assetAssessments.filter(
          (a) =>
            !stage?.node_ids?.length ||
            stage.node_ids.includes(a.asset_id) ||
            selectedAssetIds.includes(a.asset_id)
        )
      : [];

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
      setSelectedAssetIds([]);
      setEvalAssetId("");
      setEvalPartnerId("");
      setSelectedEdgeId(null);
    }

    setFocusHistory([]);
    setFocusId(nodeId);
    setMode("workspace");
    setExpanded(false);
    setViewNote(null);
    setEnabledCategories(nextDemo.category_legend.map((c) => c.id));
    const explorationStages = nextStages.filter((s) =>
      EXPLORATION_VIEW_IDS.has(s.id)
    );
    const startStage =
      explorationStages.find((s) => s.node_ids.includes(nodeId))?.id ||
      "understand";
    setStageId(startStage);
    const stageEdges =
      explorationStages.find((s) => s.id === startStage)?.edge_ids || [];
    const firstEdge =
      stageEdges.find((id) => {
        const e = nextEdges.find((edge) => edge.id === id);
        return e && (e.source === nodeId || e.target === nodeId);
      }) ||
      nextEdges.find((e) => e.source === nodeId || e.target === nodeId)?.id ||
      null;
    setSelectedEdgeId(firstEdge);
  }

  function chooseView(id: string) {
    if (id === stageId) return;
    const s = stages.find((x) => x.id === id);
    if (!s) return;
    setStageId(id);
    setExpanded(false);

    // Preserve evaluation disease/asset selections. Only adjust graph focus
    // when the current focus is not part of the destination view path.
    const focusInView = s.node_ids.includes(focusId);
    const priorLabel = nodeMap.get(focusId)?.label || "current selection";
    let nextFocus = focusId;
    let note: string | null = null;

    if (!focusInView) {
      if (evalDiseaseId && s.node_ids.includes(evalDiseaseId)) {
        nextFocus = evalDiseaseId;
        note = `“${priorLabel}” is not on the curated path for this view. Showing the selected disease instead. Your evaluation disease and asset selections are unchanged.`;
      } else if (evalAssetId && s.node_ids.includes(evalAssetId)) {
        nextFocus = evalAssetId;
        note = `“${priorLabel}” is not on the curated path for this view. Showing the selected research asset instead. Your evaluation disease and asset selections are unchanged.`;
      } else if (s.anchor_node_id && nodeMap.has(s.anchor_node_id)) {
        nextFocus = s.anchor_node_id;
        note = `“${priorLabel}” is not on the curated path for this view. Showing the view’s default focus. Your evaluation disease and asset selections are unchanged.`;
      }
      if (nextFocus !== focusId) {
        setFocusHistory((prev) => [...prev, focusId]);
        setFocusId(nextFocus);
      }
    } else {
      note = null;
    }
    setViewNote(note);

    const currentEdge = selectedEdgeId ? edgeMap.get(selectedEdgeId) : null;
    const edgeStillInView =
      currentEdge &&
      s.edge_ids.includes(selectedEdgeId!) &&
      s.node_ids.includes(currentEdge.source) &&
      s.node_ids.includes(currentEdge.target);

    if (edgeStillInView) return;

    const preferred =
      (s.preferred_edge_id &&
        edgeMap.has(s.preferred_edge_id) &&
        (edgeMap.get(s.preferred_edge_id)!.source === nextFocus ||
          edgeMap.get(s.preferred_edge_id)!.target === nextFocus) &&
        s.preferred_edge_id) ||
      s.edge_ids.find((eid) => {
        const e = edgeMap.get(eid);
        return e && (e.source === nextFocus || e.target === nextFocus);
      }) ||
      (s.preferred_edge_id && edgeMap.has(s.preferred_edge_id)
        ? s.preferred_edge_id
        : null) ||
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
    // Single active asset shared with the evaluation selector.
    if (evalAssetId === id) {
      selectEvaluationAsset("");
      return;
    }
    selectEvaluationAsset(id);
  }

  async function runEvaluation(refresh = false) {
    if (!evalDiseaseId || needsDiseasePick) {
      setEvalError("Select a target disease or disease subgroup first.");
      return;
    }
    if (!evalAssetId) {
      setEvalError(
        "Select a study, registry, publication, model, or other research asset."
      );
      return;
    }
    evalAbortRef.current?.abort();
    const controller = new AbortController();
    evalAbortRef.current = controller;
    const requestId = ++evalRequestIdRef.current;
    setEvalLoading(true);
    setEvalError(null);
    try {
      const res = await fetch("/api/evaluation/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          diseaseNodeId: evalDiseaseId,
          assetNodeId: evalAssetId,
          researchObjective,
          refresh,
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as EvaluationResult;
      if (controller.signal.aborted || requestId !== evalRequestIdRef.current) {
        return; // stale response
      }
      setEvalResult(data);
      if (
        data.status === "unavailable" ||
        data.status === "disabled" ||
        data.status === "error" ||
        data.status === "missing_asset"
      ) {
        setEvalError(data.message || "Evaluation unavailable.");
      } else {
        setEvalError(null);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (requestId === evalRequestIdRef.current) {
          setEvalError(null);
        }
      } else if (requestId === evalRequestIdRef.current) {
        setEvalError(
          err instanceof Error ? err.message : "Evaluation request failed."
        );
      }
    } finally {
      if (evalAbortRef.current === controller) {
        setEvalLoading(false);
        evalAbortRef.current = null;
      }
    }
  }

  function cancelEvaluation() {
    evalAbortRef.current?.abort();
    evalAbortRef.current = null;
    setEvalLoading(false);
  }

  function prepareCollaborationBrief() {
    if (!evalResult?.assessment || evalResult.status !== "ok") return;
    // Rebuild a minimal package-equivalent for citations from current selection.
    const pkg = {
      disease: {
        id: evalDiseaseId,
        label:
          diseaseOptions.find((d) => d.id === evalDiseaseId)?.label ||
          evalDiseaseId,
        type: "disease",
      },
      asset: {
        id: evalAssetId,
        label:
          assetOptions.find((a) => a.id === evalAssetId)?.label || evalAssetId,
        type: "research_asset",
      },
      research_objective: researchObjective,
      evidence: (evalResult.evidence_ids || []).map((id) => ({
        evidence_id: id,
        kind: (evalEvidenceKindById.get(id) || "source_passage") as
          | "source_passage"
          | "curator_summary"
          | "asset_record",
        source_url: evalEvidenceUrlById.get(id) || null,
        supporting_passage: evalEvidencePassageById.get(id) || "",
        display_title: evalEvidenceTitleById.get(id) || id,
        display_identifier: id.includes("pmid:")
          ? id.match(/pmid:(\d+)/i)?.[1]
            ? `PMID:${id.match(/pmid:(\d+)/i)![1]}`
            : undefined
          : id.includes("nct:") || /NCT\d+/i.test(id)
            ? id.match(/NCT\d+/i)?.[0]
            : undefined,
        is_curator_summary:
          evalEvidenceKindById.get(id) === "curator_summary" ||
          evalEvidenceKindById.get(id) === "asset_record",
      })),
      connecting_paths: [],
      connection_explanation:
        evalResult.connection_explanation ||
        evalResult.evidence_scope_summary ||
        "",
      related_context_nodes: [],
      missing_information: evalResult.missing_information || [],
      insufficient: false,
      dataset_id: datasetId,
      disease_node_id: evalDiseaseId,
      asset_node_id: evalAssetId,
      evidence_version: evalResult.evidence_version || "",
    };
    const partner = partnerOptions.find((p) => p.id === evalPartnerId) || null;
    const brief = buildCollaborationBrief(
      evalResult.assessment,
      pkg as EvaluationEvidencePackage,
      evalResult.generated_at || new Date().toISOString(),
      partner
    );
    setBriefMeta(brief);
    setBriefMarkdown(formatCollaborationBriefMarkdown(brief));
    setBriefOpen(true);
  }

  if (mode === "landing") {
    return (
      <Landing
        productName={productName}
        productOneLiner={catalog.product_one_liner}
        disclaimer="This atlas focuses on sourced research connections and reusable assets — not treatment advice. Journey completeness differs by collection; partial paths show missing partners or evidence explicitly."
        exampleSearches={allExampleSearches}
        catalogById={catalogById}
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
            {journeyStatusLabel(journeyStatus)
              ? ` · ${journeyStatusLabel(journeyStatus)}`
              : ""}
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
                {journeyStatusLabel(journeyStatus) ? (
                  <p className="atlas-meta mt-1">
                    {journeyStatusLabel(journeyStatus)}
                    {journeyStatusNote ? ` — ${journeyStatusNote}` : ""}
                  </p>
                ) : null}
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
                {expanded ? "Show curated path" : "Show more connections"}
              </Button>
            </div>

            <div
              className="mb-4 grid gap-2 sm:grid-cols-2"
              role="group"
              aria-label="Exploration views"
            >
              {stages.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => chooseView(s.id)}
                  aria-pressed={stageId === s.id}
                  className={`min-h-11 w-full rounded-atlas border px-3 py-2.5 text-left text-sm transition-colors duration-atlas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                    stageId === s.id
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium">{s.label}</span>
                </button>
              ))}
            </div>
            <p className="atlas-meta mb-4 -mt-2">{stage?.summary}</p>

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

              <NetworkCanvas
                focusId={focusId}
                nodes={local.nodes}
                edges={local.edges}
                selectedEdgeId={selectedEdgeId}
                legend={demo.category_legend}
                onSelectNode={(id) => goToNode(id)}
                onSelectEdge={setSelectedEdgeId}
              />
            </div>

            <div
              className="mt-3 flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Legend filters"
            >
              {demo.category_legend.map((c) => {
                const count = local.allNodes.filter(
                  (n) => legendCategoryForType(n.type) === c.id
                ).length;
                if (count === 0) return null;
                const checked = enabledCategorySet.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    aria-pressed={checked}
                    title={
                      checked
                        ? `Hide ${c.label.toLowerCase()}`
                        : `Show ${c.label.toLowerCase()}`
                    }
                    className={`inline-flex min-h-9 items-center gap-2 rounded-atlas border px-2.5 py-1.5 text-sm transition-colors duration-atlas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                      checked
                        ? "border-slate-300 bg-white text-ink shadow-sm"
                        : "border-dashed border-slate-300 bg-slate-50 text-slate-400 opacity-70"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: checked ? c.color : "#cbd5e1" }}
                      aria-hidden
                    />
                    <span>{c.label}</span>
                    <span className="tabular-nums text-slate-500">{count}</span>
                  </button>
                );
              })}
            </div>

            {viewNote ? (
              <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                {viewNote}
              </p>
            ) : null}
            {local.emptyReason && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {local.emptyReason}
              </p>
            )}
            {local.truncated && (
              <p className="mt-2 text-xs text-slate-500">
                Neighborhood truncated for readability. Switch back to a curated
                path view for the multi-hop neighborhood.
              </p>
            )}

            <ResearchOpportunityPanel
              diseaseOptions={diseaseOptions}
              diseaseId={evalDiseaseId}
              onDiseaseChange={setEvalDiseaseId}
              needsDiseasePick={needsDiseasePick}
              assetOptions={assetOptions}
              assetId={evalAssetId}
              onAssetChange={selectEvaluationAsset}
              partnerOptions={partnerOptions}
              partnerId={evalPartnerId}
              onPartnerChange={setEvalPartnerId}
              researchObjective={researchObjective}
              onResearchObjectiveChange={setResearchObjective}
              loading={evalLoading}
              error={evalError}
              result={evalResult}
              onEvaluate={() => runEvaluation(false)}
              onCancel={cancelEvaluation}
              onRefresh={() => runEvaluation(true)}
              onPrepareBrief={prepareCollaborationBrief}
              evidenceUrlById={evalEvidenceUrlById}
              evidencePassageById={evalEvidencePassageById}
              evidenceTitleById={evalEvidenceTitleById}
              evidenceKindById={evalEvidenceKindById}
              defaultOpen={Boolean(evalAssetId)}
            />
          </section>

          <aside
            className="flex min-h-0 flex-col gap-4 overflow-hidden lg:sticky lg:top-4"
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

        {stageId === "explore" ? (
          <AssetPanel
            assets={visibleAssets.length ? visibleAssets : assetAssessments}
            selectedAssetIds={selectedAssetIds}
            onToggle={toggleAsset}
            registryGap={demo.registry_gap}
          />
        ) : null}
      </div>

      {briefOpen && briefMeta ? (
        <CollaborationBriefModal
          brief={briefMeta}
          markdown={briefMarkdown}
          onClose={() => setBriefOpen(false)}
          onChangeMarkdown={setBriefMarkdown}
        />
      ) : null}
    </div>
  );
}

function Landing({
  productName,
  productOneLiner,
  disclaimer,
  exampleSearches,
  catalogById,
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
  catalogById: Map<string, DatasetCatalogEntry>;
  query: string;
  hits: SearchHit[];
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  onPickExample: (q: string) => void;
  onSelectHit: (id: string, datasetId?: string) => void;
}) {
  const ambiguous = needsDisambiguation(hits);
  return (
    <div className="relative min-h-screen overflow-hidden bg-soft">
      <div
        className="pointer-events-none absolute inset-0 dna-helix-bg"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-14 md:px-6 md:py-16">
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
              className="h-12 border-slate-200/90 bg-white/90 text-base shadow-sm backdrop-blur-sm"
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
              className="min-h-9 rounded-atlas border border-line bg-white/85 px-3 py-1.5 text-sm text-slate-700 backdrop-blur-sm transition-colors duration-atlas hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {hits.length > 0 && (
          <div className="atlas-panel mt-6 bg-white/92 p-4 backdrop-blur-sm md:p-5">
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
                    className="w-full rounded-atlas border border-line bg-white/80 px-3 py-3 text-left transition-colors duration-atlas hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss"
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
                      {h.datasetId &&
                      journeyStatusLabel(
                        catalogById.get(h.datasetId)?.journey_status
                      )
                        ? ` · ${journeyStatusLabel(
                            catalogById.get(h.datasetId)?.journey_status
                          )}`
                        : ""}
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
  const { takeaway, abstract, abstractLabel, findings, caveat } =
    importantSummaryForEdge(edge, nodeMap, plainFallback);
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
            <h3 className="text-base font-bold text-ink">{abstractLabel}</h3>
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
        Public assets linked in this curated view. Selecting an item sets it as
        the active research asset for evaluation. Organization pages identify
        potentially relevant groups — not verified collaborator networks or
        availability. ClinicalTrials.gov study listings are not patient
        registries.
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

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
