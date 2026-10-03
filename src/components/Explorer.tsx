"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GraphData,
  GraphEdge,
  GraphNode,
  Journey,
  isHypothesisEdge,
  neighborhood,
  searchNodes,
  typeColor,
} from "@/lib/graph";

type Props = {
  curated: GraphData;
  discovery: GraphData;
  journey: Journey;
};

export function Explorer({ curated, discovery, journey }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(journey.node_path[0]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(
    journey.edge_path[0] ?? null
  );
  const [showDiscovery, setShowDiscovery] = useState(false);

  const graph = showDiscovery ? discovery : curated;
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph]
  );
  const edgeMap = useMemo(
    () => new Map(graph.edges.map((e) => [e.id, e])),
    [graph]
  );

  const matches = useMemo(() => searchNodes(graph.nodes, query), [graph, query]);
  const selected = nodeMap.get(selectedId) ?? null;
  const selectedEdge = selectedEdgeId ? edgeMap.get(selectedEdgeId) ?? null : null;
  const local = selected ? neighborhood(graph, selected.id) : { nodes: [], edges: [] };

  const journeyNodes = journey.node_path
    .map((id) => curated.nodes.find((n) => n.id === id))
    .filter(Boolean) as GraphNode[];

  function chooseNode(id: string) {
    setSelectedId(id);
    const first = graph.edges.find((e) => e.source === id || e.target === id);
    setSelectedEdgeId(first?.id ?? null);
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-stone-300/80 bg-white/70 p-4 backdrop-blur">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-900">
            Search
          </label>
          <Input
            className="mt-2"
            placeholder="Disease, gene, variant, phenotype…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search knowledge graph"
          />
          <div className="mt-3 max-h-64 space-y-1 overflow-auto">
            {query.trim() && matches.length === 0 && (
              <p className="text-sm text-stone-600">
                No curated matches for “{query.trim()}”. This is missing data or an
                unsupported search — not evidence of absence.
              </p>
            )}
            {matches.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => chooseNode(n.id)}
                className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-teal-50"
              >
                <span className="font-medium text-stone-900">{n.label}</span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {n.type} · {n.review_status ?? "unspecified"}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant={showDiscovery ? "secondary" : "outline"}
              onClick={() => setShowDiscovery((v) => !v)}
            >
              {showDiscovery ? "Discovery layer on" : "Show discovery layer"}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            Default view is curated/reviewed. Discovery records stay available for
            audit and are not treatment claims.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-300/80 bg-white/70 p-4 backdrop-blur">
          <h2 className="font-display text-lg text-stone-900">Guided journey</h2>
          <p className="mt-1 text-sm text-stone-600">{journey.title}</p>
          <ol className="mt-3 space-y-2">
            {journeyNodes.map((n, idx) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscovery(false);
                    chooseNode(n.id);
                    setSelectedEdgeId(journey.edge_path[Math.max(0, idx - 1)] ?? null);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedId === n.id
                      ? "border-teal-700 bg-teal-50"
                      : "border-stone-200 bg-white/50 hover:border-teal-600"
                  }`}
                >
                  <span className="text-xs text-stone-500">{idx + 1}. {n.type}</span>
                  <span className="block font-medium text-stone-900">{n.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <section className="space-y-4">
        <div className="rounded-2xl border border-stone-300/80 bg-white/75 p-5 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-900">
                Focused graph
              </p>
              <h2 className="font-display mt-1 text-2xl text-stone-950">
                {selected?.label ?? "Select an entity"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {selected
                  ? `${selected.type} · review: ${selected.review_status ?? "n/a"} · layer: ${
                      showDiscovery ? "discovery" : "curated"
                    }`
                  : "Choose a search hit or journey step."}
              </p>
            </div>
            {selected?.source_url && (
              <a
                className="text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
                href={selected.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Open source
              </a>
            )}
          </div>

          <GraphCanvas
            focusId={selectedId}
            nodes={local.nodes}
            edges={local.edges}
            onSelectNode={chooseNode}
            onSelectEdge={setSelectedEdgeId}
            selectedEdgeId={selectedEdgeId}
          />

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Legend swatch="#0f766e" label="Established / sourced" />
            <Legend swatch="#be185d" label="Proposed / hypothesis" dashed />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-300/80 bg-gradient-to-br from-teal-950 to-stone-900 p-5 text-teal-50">
          <h2 className="font-display text-xl">Plain-language path</h2>
          <p className="mt-2 text-sm leading-relaxed text-teal-100/90">
            {journey.plain_language}
          </p>
          {selected?.plain_language && (
            <p className="mt-3 border-t border-teal-100/20 pt-3 text-sm text-teal-50">
              <span className="font-semibold">About this node: </span>
              {selected.plain_language}
            </p>
          )}
          {selected?.does_not && (
            <p className="mt-2 text-sm text-amber-200">
              Explicit non-claim: {selected.does_not}.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Who / what could help">
            <ul className="space-y-2 text-sm text-stone-700">
              {journey.answers.who_could_help.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <ResourceList graph={curated} />
          </Panel>
          <Panel title="Next research step">
            <p className="text-sm text-stone-700">{journey.answers.next_step}</p>
            <QuestionBlock node={nodeMap.get("question:validate_hbf_asset_transfer") ?? null} />
          </Panel>
        </div>
      </section>

      <aside className="space-y-4">
        <EvidencePanel edge={selectedEdge} nodeMap={nodeMap} />
        <Panel title="Selected entity details">
          {selected ? (
            <dl className="space-y-2 text-sm text-stone-700">
              <Detail label="ID" value={selected.id} />
              <Detail label="Type" value={selected.type} />
              <Detail label="Review status" value={selected.review_status} />
              <Detail label="Genotype scope" value={selected.genotype_scope} />
              <Detail label="Species" value={selected.species} />
              <Detail label="HGVS (c)" value={selected.hgvs_c} />
              <Detail label="HGVS (p)" value={selected.hgvs_p_modern} />
              <Detail
                label="Legacy protein numbering"
                value={selected.legacy_protein_numbering}
              />
              <Detail label="Transcript" value={selected.reference_transcript} />
              <Detail
                label="ClinVar significance"
                value={selected.clinical_significance}
              />
              <Detail
                label="ClinVar review"
                value={selected.clinvar_review_status}
              />
              <Detail label="Study status" value={selected.overall_status} />
              <Detail label="Notes" value={selected.notes} />
              <Detail label="Access" value={selected.access_info} />
            </dl>
          ) : (
            <p className="text-sm text-stone-600">No entity selected.</p>
          )}
        </Panel>
      </aside>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-300/80 bg-white/70 p-4 backdrop-blur">
      <h3 className="font-display text-lg text-stone-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="text-stone-800">{value}</dd>
    </div>
  );
}

function Legend({
  swatch,
  label,
  dashed,
}: {
  swatch: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-stone-600">
      <span
        className="inline-block h-0.5 w-8"
        style={{
          backgroundImage: dashed
            ? `repeating-linear-gradient(90deg, ${swatch} 0 6px, transparent 6px 10px)`
            : undefined,
          backgroundColor: dashed ? "transparent" : swatch,
        }}
      />
      {label}
    </span>
  );
}

function GraphCanvas({
  focusId,
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  selectedEdgeId,
}: {
  focusId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  selectedEdgeId: string | null;
}) {
  const width = 720;
  const height = 420;
  const cx = width / 2;
  const cy = height / 2;
  const others = nodes.filter((n) => n.id !== focusId);
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(focusId, { x: cx, y: cy });
  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
    const radius = 140 + (i % 2) * 28;
    positions.set(focusId ? n.id : n.id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-[radial-gradient(circle_at_top,#ecfdf5,transparent_55%),linear-gradient(180deg,#fafaf9,#f5f5f4)]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[360px] w-full">
        {edges.map((e) => {
          const a = positions.get(e.source);
          const b = positions.get(e.target);
          if (!a || !b) return null;
          const hypo = isHypothesisEdge(e);
          const selected = e.id === selectedEdgeId;
          return (
            <g key={e.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={hypo ? "#be185d" : "#0f766e"}
                strokeWidth={selected ? 3.5 : 2}
                strokeDasharray={hypo ? "7 6" : undefined}
                opacity={selected ? 1 : 0.7}
                className="cursor-pointer"
                onClick={() => onSelectEdge(e.id)}
              />
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const focused = n.id === focusId;
          return (
            <g
              key={n.id}
              className="cursor-pointer"
              onClick={() => onSelectNode(n.id)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={focused ? 28 : 18}
                fill={typeColor(n.type)}
                opacity={0.92}
              />
              <text
                x={p.x}
                y={p.y + (focused ? 44 : 34)}
                textAnchor="middle"
                className="fill-stone-800"
                style={{ fontSize: focused ? 12 : 10 }}
              >
                {n.label.length > 34 ? `${n.label.slice(0, 32)}…` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      {nodes.length === 0 && (
        <p className="p-6 text-sm text-stone-600">No neighborhood to display.</p>
      )}
    </div>
  );
}

function EvidencePanel({
  edge,
  nodeMap,
}: {
  edge: GraphEdge | null;
  nodeMap: Map<string, GraphNode>;
}) {
  if (!edge) {
    return (
      <Panel title="Evidence panel">
        <p className="text-sm text-stone-600">
          Select a connection in the graph to inspect sources, context, and
          limitations.
        </p>
      </Panel>
    );
  }
  const ev = edge.evidence;
  const hypo = isHypothesisEdge(edge);
  return (
    <Panel title="Evidence panel">
      <div
        className={`mb-3 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
          hypo
            ? "border-pink-300 bg-pink-50 text-pink-900"
            : "border-teal-300 bg-teal-50 text-teal-900"
        }`}
      >
        {hypo ? "Proposed connection" : "Established / sourced relationship"} ·{" "}
        {edge.type}
      </div>
      <p className="text-sm text-stone-800">
        {nodeMap.get(edge.source)?.label ?? edge.source}
        <span className="mx-1 text-stone-400">→</span>
        {nodeMap.get(edge.target)?.label ?? edge.target}
      </p>
      {ev ? (
        <dl className="mt-3 space-y-2 text-sm text-stone-700">
          <Detail label="Supporting passage" value={ev.supporting_passage} />
          <Detail label="Source URL" value={ev.source_url} />
          <Detail label="Publication date" value={ev.publication_date} />
          <Detail label="Retrieval date" value={ev.retrieval_date} />
          <Detail label="Evidence type" value={ev.evidence_type} />
          <Detail
            label="Extraction / review status"
            value={ev.extraction_review_status}
          />
          <Detail label="Extraction confidence" value={ev.extraction_confidence} />
          <Detail
            label="Scientific evidence strength"
            value={ev.evidence_strength}
          />
          <Detail label="Genotype context" value={ev.genotype_context} />
          <Detail label="Population" value={ev.population_context} />
          <Detail label="Species" value={ev.species} />
          <Detail label="Experimental context" value={ev.experimental_context} />
          <Detail label="Limitations" value={ev.limitations} />
          <Detail
            label="Contradictory / missing link notes"
            value={ev.contradictory_evidence}
          />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-stone-600">
          {edge.limitations ||
            "No structured evidence object on this edge. Treat as incomplete."}
        </p>
      )}
      {ev?.source_url && (
        <a
          className="mt-3 inline-block text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
          href={ev.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Resolve source
        </a>
      )}
    </Panel>
  );
}

function ResourceList({ graph }: { graph: GraphData }) {
  const resources = graph.nodes.filter((n) =>
    ["organization", "research_asset"].includes(n.type)
  );
  return (
    <ul className="mt-3 space-y-3">
      {resources.map((r) => (
        <li key={r.id} className="rounded-lg border border-stone-200 bg-white/80 p-3">
          <p className="text-sm font-medium text-stone-900">{r.label}</p>
          <p className="mt-1 text-xs text-stone-500">
            {r.page_usable === false
              ? "Page needs verification"
              : "Verified link / usable snapshot"}
            {r.species ? ` · ${r.species}` : ""}
          </p>
          {r.access_info && (
            <p className="mt-1 text-xs text-stone-600">{r.access_info}</p>
          )}
          {r.source_url && (
            <a
              href={r.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-medium text-teal-800 underline-offset-2 hover:underline"
            >
              {r.source_url}
            </a>
          )}
          {r.notes && <p className="mt-1 text-xs text-amber-800">{r.notes}</p>}
        </li>
      ))}
    </ul>
  );
}

function QuestionBlock({ node }: { node: GraphNode | null }) {
  if (!node) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-medium text-stone-900">{node.label}</p>
      {node.uncertainties && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Uncertainties
          </p>
          <ul className="mt-1 space-y-1 text-sm text-stone-700">
            {node.uncertainties.map((u) => (
              <li key={u}>• {u}</li>
            ))}
          </ul>
        </div>
      )}
      {node.validation_questions && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Validation questions
          </p>
          <ul className="mt-1 space-y-1 text-sm text-stone-700">
            {node.validation_questions.map((u) => (
              <li key={u}>• {u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
