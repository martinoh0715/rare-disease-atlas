"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GraphEdge,
  GraphNode,
  isHypothesisEdge,
  legendCategoryForType,
  typeColor,
} from "@/lib/graph";
import type { DemoExperience } from "@/lib/types";

type Props = {
  focusId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  pathNodeIds: Set<string>;
  pathEdgeIds: Set<string>;
  selectedEdgeId: string | null;
  legend: DemoExperience["category_legend"];
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
};

type Pos = { x: number; y: number };

function layoutNodes(focusId: string, nodes: GraphNode[]): Map<string, Pos> {
  const width = 900;
  const height = 560;
  const cx = width / 2;
  const cy = height / 2;
  const positions = new Map<string, Pos>();
  positions.set(focusId, { x: cx, y: cy });

  const categories = [
    "disease",
    "gene_variant",
    "mechanism",
    "study",
    "organization_asset",
    "phenotype",
  ];
  const buckets = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (n.id === focusId) continue;
    const cat = legendCategoryForType(n.type);
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(n);
  }

  const activeCats = categories.filter((c) => (buckets.get(c) || []).length);
  activeCats.forEach((cat, catIdx) => {
    const items = buckets.get(cat) || [];
    const baseAngle =
      (2 * Math.PI * catIdx) / Math.max(activeCats.length, 1) - Math.PI / 2;
    items.forEach((n, i) => {
      const spread = (i - (items.length - 1) / 2) * 0.32;
      const radius = 155 + (i % 3) * 34;
      positions.set(n.id, {
        x: cx + Math.cos(baseAngle + spread) * radius,
        y: cy + Math.sin(baseAngle + spread) * radius,
      });
    });
  });
  return positions;
}

export function NetworkCanvas({
  focusId,
  nodes,
  edges,
  pathNodeIds,
  pathEdgeIds,
  selectedEdgeId,
  legend,
  onSelectNode,
  onSelectEdge,
}: Props) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    mode: "pan" | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ mode: null, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);

  const positions = useMemo(
    () => layoutNodes(focusId, nodes),
    [focusId, nodes]
  );

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [focusId]);

  function resetView() {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <ControlButton label="Zoom in" onClick={() => setScale((s) => Math.min(2.2, s + 0.15))} />
        <ControlButton label="Zoom out" onClick={() => setScale((s) => Math.max(0.55, s - 0.15))} />
        <ControlButton label="Reset view" onClick={resetView} />
      </div>
      <svg
        viewBox="0 0 900 560"
        className="h-[460px] w-full touch-none"
        role="img"
        aria-label="Interactive evidence graph"
        onWheel={(e) => {
          e.preventDefault();
          setScale((s) =>
            Math.min(2.2, Math.max(0.55, s + (e.deltaY > 0 ? -0.08 : 0.08)))
          );
        }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-node],[data-edge]")) return;
          dragRef.current = {
            mode: "pan",
            startX: e.clientX,
            startY: e.clientY,
            origX: pan.x,
            origY: pan.y,
          };
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragRef.current.mode !== "pan") return;
          setPan({
            x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
          });
        }}
        onPointerUp={() => {
          dragRef.current.mode = null;
        }}
      >
        <rect width="900" height="560" fill="#f8fafc" />
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {edges.map((e) => {
            const a = positions.get(e.source);
            const b = positions.get(e.target);
            if (!a || !b) return null;
            const hypo = isHypothesisEdge(e);
            const onPath = pathEdgeIds.has(e.id);
            const selected = e.id === selectedEdgeId;
            const faded = pathEdgeIds.size > 0 && !onPath;
            return (
              <g key={e.id} data-edge>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={hypo ? "#be185d" : "#334155"}
                  strokeWidth={selected ? 4 : onPath ? 3 : 1.75}
                  strokeDasharray={hypo ? "7 6" : undefined}
                  opacity={faded ? 0.15 : selected || onPath ? 0.95 : 0.45}
                  className="cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEdge(e.id);
                  }}
                  onMouseEnter={() => setHoverEdgeId(e.id)}
                  onMouseLeave={() => setHoverEdgeId(null)}
                />
                {(selected || hoverEdgeId === e.id) && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 8}
                    textAnchor="middle"
                    className="fill-slate-700"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    {e.type.replace(/_/g, " ")}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            const focused = n.id === focusId;
            const onPath = pathNodeIds.has(n.id);
            const faded = pathNodeIds.size > 0 && !onPath && !focused;
            const r = focused ? 30 : onPath ? 20 : 15;
            const color = typeColor(n.type, legend);
            return (
              <g
                key={n.id}
                data-node
                className="cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(n.id);
                }}
                opacity={faded ? 0.22 : 1}
              >
                {focused && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 8}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth={3}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={r} fill={color} />
                <text
                  x={p.x}
                  y={p.y + r + 16}
                  textAnchor="middle"
                  className="fill-slate-800"
                  style={{ fontSize: focused ? 13 : 11, fontWeight: focused ? 700 : 500 }}
                >
                  {n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <p className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Drag to pan · scroll to zoom · click a node or edge. Dashed = proposed /
        hypothesis. Node size emphasizes the selected center.
      </p>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
    >
      {label}
    </button>
  );
}
