"use client";

import { useMemo, useState } from "react";
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

/** Wide canvas so labels stay readable without zoom. */
const WIDTH = 1700;
const HEIGHT = 720;
const CX = WIDTH / 2;
const CY = HEIGHT / 2 + 24;

/** Keep nodes/labels out of the Back control (top-left). */
const BACK_ZONE = { x0: 0, y0: 0, x1: 320, y1: 80 };

function wrapLabel(label: string, maxChars = 22): string[] {
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

function inOverlayZone(
  p: Pos,
  zone: { x0: number; y0: number; x1: number; y1: number },
  pad = 40
): boolean {
  return (
    p.x >= zone.x0 - pad &&
    p.x <= zone.x1 + pad &&
    p.y >= zone.y0 - pad &&
    p.y <= zone.y1 + pad
  );
}

function escapeOverlayZone(
  p: Pos,
  zone: { x0: number; y0: number; x1: number; y1: number },
  side: "left" | "right"
) {
  if (!inOverlayZone(p, zone)) return;
  if (side === "right") {
    p.x = Math.min(p.x, zone.x0 - 50);
  } else {
    p.x = Math.max(p.x, zone.x1 + 50);
  }
  p.y = Math.max(p.y, zone.y1 + 36);
}

/** Horizontal ellipse layout with light collision nudging. */
function layoutNodes(focusId: string, nodes: GraphNode[]): Map<string, Pos> {
  const positions = new Map<string, Pos>();
  positions.set(focusId, { x: CX, y: CY });

  const others = nodes.filter((n) => n.id !== focusId);
  const n = others.length;
  if (n === 0) return positions;

  const radiusX = Math.min(640, 300 + n * 20);
  const radiusY = Math.min(260, 150 + n * 9);

  others.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2 + 0.18;
    positions.set(node.id, {
      x: CX + Math.cos(angle) * radiusX,
      y: CY + Math.sin(angle) * radiusY,
    });
  });

  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        const a = positions.get(others[i].id)!;
        const b = positions.get(others[j].id)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = 150;
        if (dist < minDist) {
          const push = ((minDist - dist) / dist) * 0.45;
          const ox = dx * push * 0.5;
          const oy = dy * push * 0.5;
          a.x -= ox;
          a.y -= oy;
          b.x += ox;
          b.y += oy;
        }
      }
    }
    for (const node of others) {
      const p = positions.get(node.id)!;
      const dx = (p.x - CX) / radiusX;
      const dy = (p.y - CY) / radiusY;
      const dist = Math.hypot(dx, dy) || 1;
      p.x = CX + (dx / dist) * radiusX;
      p.y = CY + (dy / dist) * radiusY;
      p.x = Math.min(WIDTH - 140, Math.max(140, p.x));
      p.y = Math.min(HEIGHT - 90, Math.max(70, p.y));
      escapeOverlayZone(p, BACK_ZONE, "left");
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
  const nx = -dy / len;
  const ny = dx / len;
  const spread = (index - (total - 1) / 2) * 26;
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const positions = useMemo(
    () => layoutNodes(focusId, nodes),
    [focusId, nodes]
  );

  return (
    <div className="relative overflow-hidden bg-slate-50">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        style={{ minHeight: 560 }}
        role="img"
        aria-label="Interactive evidence graph"
      >
        <rect width={WIDTH} height={HEIGHT} fill="#f8fafc" />
        {edges.map((e, index) => {
          const a = positions.get(e.source);
          const b = positions.get(e.target);
          if (!a || !b) return null;
          const hypo = isHypothesisEdge(e);
          const selected = e.id === selectedEdgeId;
          const { d } = edgePath(a, b, index, edges.length);
          return (
            <g key={e.id} data-edge>
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                className="cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectEdge(e.id);
                }}
              />
              <path
                d={d}
                fill="none"
                stroke={selected ? (hypo ? "#9d174d" : "#0f766e") : "#64748b"}
                strokeWidth={selected ? 4 : 2}
                strokeDasharray={hypo ? "8 6" : undefined}
                opacity={selected ? 1 : 0.55}
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
          const hovered = n.id === hoveredId;
          const r = focused ? 30 : hovered ? 22 : 18;
          const color = typeColor(n.type, legend);
          const lines = wrapLabel(n.label, focused ? 28 : 22);
          const dx = p.x - CX;
          const dy = p.y - CY;
          const dist = Math.hypot(dx, dy) || 1;
          const labelOffset = focused ? r + 20 : r + 24;
          const lx = focused ? p.x : p.x + (dx / dist) * labelOffset;
          const ly = focused ? p.y + r + 20 : p.y + (dy / dist) * labelOffset;
          const anchor =
            focused || Math.abs(dx) < 40 ? "middle" : dx > 0 ? "start" : "end";
          const hoverWidth = Math.min(400, Math.max(180, Math.min(n.label.length * 8.5 + 40, 400)));
          const approxLines = Math.max(1, Math.ceil(n.label.length / Math.max(18, hoverWidth / 9)));
          const hoverHeight = Math.min(96, 28 + approxLines * 22);
          const hoverX = Math.min(
            WIDTH - hoverWidth - 8,
            Math.max(8, p.x - hoverWidth / 2)
          );
          const hoverY = Math.max(8, p.y - r - hoverHeight - 14);

          return (
            <g
              key={n.id}
              data-node
              className="cursor-pointer"
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() =>
                setHoveredId((id) => (id === n.id ? null : id))
              }
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectNode(n.id);
              }}
            >
                {focused && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r + 9}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={3.5}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={color}
                stroke={focused ? "#0f172a" : "rgba(15,23,42,0.12)"}
                strokeWidth={focused ? 1.5 : 1}
              />
              {!hovered && (
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  className="fill-slate-900"
                  style={{
                    fontSize: focused ? 20 : 18,
                    fontWeight: focused ? 700 : 650,
                  }}
                >
                  {lines.map((line, i) => (
                    <tspan key={i} x={lx} dy={i === 0 ? 0 : 21}>
                      {line}
                    </tspan>
                  ))}
                </text>
              )}
              {hovered && (
                <foreignObject
                  x={hoverX}
                  y={hoverY}
                  width={hoverWidth}
                  height={hoverHeight}
                  pointerEvents="none"
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.95)",
                      color: "#fff",
                      fontSize: "18px",
                      fontWeight: 700,
                      lineHeight: 1.25,
                      textAlign: "center",
                      overflow: "hidden",
                    }}
                  >
                    {n.label}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
      <p className="border-t border-line bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-600">
        Click a node or connection. Only the selected connection is highlighted.
        Solid lines are sourced, established relationships. Dashed lines are
        proposed bridges or next-step ideas — hypotheses to investigate, not
        proven facts.
      </p>
    </div>
  );
}
