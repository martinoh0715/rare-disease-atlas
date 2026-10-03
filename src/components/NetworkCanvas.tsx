"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GraphEdge,
  GraphNode,
  isHypothesisEdge,
  typeColor,
} from "@/lib/graph";
import type { DemoExperience } from "@/lib/types";

type Props = {
  focusId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedEdgeId: string | null;
  legend: DemoExperience["category_legend"];
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
};

type Pos = { x: number; y: number };

const WIDTH = 1400;
const HEIGHT = 900;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

function wrapLabel(label: string, maxChars = 18): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

/** Even circular layout with extra spacing and collision nudging for labels. */
function layoutNodes(focusId: string, nodes: GraphNode[]): Map<string, Pos> {
  const positions = new Map<string, Pos>();
  positions.set(focusId, { x: CX, y: CY });

  const others = nodes.filter((n) => n.id !== focusId);
  const n = others.length;
  if (n === 0) return positions;

  // Larger radius when more neighbors so labels have room.
  const radius = Math.min(360, 180 + n * 14);
  others.forEach((node, i) => {
    // Start at top; equal angular spacing.
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.set(node.id, {
      x: CX + Math.cos(angle) * radius,
      y: CY + Math.sin(angle) * radius,
    });
  });

  // Light repulsion pass so close nodes separate.
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        const a = positions.get(others[i].id)!;
        const b = positions.get(others[j].id)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = 130;
        if (dist < minDist) {
          const push = ((minDist - dist) / dist) * 0.5;
          const ox = dx * push * 0.5;
          const oy = dy * push * 0.5;
          a.x -= ox;
          a.y -= oy;
          b.x += ox;
          b.y += oy;
        }
      }
    }
    // Keep roughly on a ring around center.
    for (const node of others) {
      const p = positions.get(node.id)!;
      const dx = p.x - CX;
      const dy = p.y - CY;
      const dist = Math.hypot(dx, dy) || 1;
      const target = radius;
      p.x = CX + (dx / dist) * target;
      p.y = CY + (dy / dist) * target;
      p.x = Math.min(WIDTH - 110, Math.max(110, p.x));
      p.y = Math.min(HEIGHT - 80, Math.max(60, p.y));
    }
  }

  return positions;
}

function edgePath(
  a: Pos,
  b: Pos,
  index: number,
  total: number
): { d: string; mid: Pos } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset so parallel-ish edges fan apart.
  const nx = -dy / len;
  const ny = dx / len;
  const spread = (index - (total - 1) / 2) * 28;
  const cx = mx + nx * spread;
  const cy = my + ny * spread;
  return {
    d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
    mid: { x: cx, y: cy },
  };
}

export function NetworkCanvas({
  focusId,
  nodes,
  edges,
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
        <ControlButton
          label="Zoom in"
          onClick={() => setScale((s) => Math.min(2.2, s + 0.15))}
        />
        <ControlButton
          label="Zoom out"
          onClick={() => setScale((s) => Math.max(0.55, s - 0.15))}
        />
        <ControlButton label="Reset view" onClick={resetView} />
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[min(78vh,820px)] w-full touch-none"
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
        <rect width={WIDTH} height={HEIGHT} fill="#f8fafc" />
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {edges.map((e, index) => {
            const a = positions.get(e.source);
            const b = positions.get(e.target);
            if (!a || !b) return null;
            const hypo = isHypothesisEdge(e);
            const selected = e.id === selectedEdgeId;
            const { d } = edgePath(a, b, index, edges.length);
            return (
              <g key={e.id} data-edge>
                {/* Invisible wider hit target */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEdge(e.id);
                  }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={selected ? (hypo ? "#be185d" : "#0f766e") : "#94a3b8"}
                  strokeWidth={selected ? 3.5 : 1.5}
                  strokeDasharray={hypo ? "7 6" : undefined}
                  opacity={selected ? 1 : 0.35}
                  className="cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEdge(e.id);
                  }}
                />
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            const focused = n.id === focusId;
            const r = focused ? 28 : 16;
            const color = typeColor(n.type, legend);
            const lines = wrapLabel(n.label, focused ? 22 : 16);
            // Place label outside the ring, away from center.
            const dx = p.x - CX;
            const dy = p.y - CY;
            const dist = Math.hypot(dx, dy) || 1;
            const labelOffset = focused ? r + 18 : r + 22;
            const lx = focused ? p.x : p.x + (dx / dist) * labelOffset;
            const ly = focused ? p.y + r + 18 : p.y + (dy / dist) * labelOffset;
            const anchor =
              focused || Math.abs(dx) < 40 ? "middle" : dx > 0 ? "start" : "end";

            return (
              <g
                key={n.id}
                data-node
                className="cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(n.id);
                }}
              >
                {focused && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 7}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth={3}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={r} fill={color} />
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  className="fill-slate-900"
                  style={{
                    fontSize: focused ? 13 : 12,
                    fontWeight: focused ? 700 : 600,
                  }}
                >
                  {lines.map((line, i) => (
                    <tspan key={i} x={lx} dy={i === 0 ? 0 : 15}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <p className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Drag to pan · scroll to zoom · click a node or connection. Only the
        selected connection is highlighted. Dashed = proposed.
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
