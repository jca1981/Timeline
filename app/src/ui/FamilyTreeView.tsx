// **** Slægtstræ-view (M5): interaktivt familie-træ via dagre + SVG ****
// Kun rt-parent-relationer vises. Zoom: musehjul, pan: træk, klik → Inspector.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import dagre from 'dagre';
import { useApp } from '../store';
import { panPoint } from '../core/pan';
import { textColorFor } from '../core/color';
import type { Item } from '../model/doc';

const NODE_W = 140;
const NODE_H = 40;
const RANKSEP = 80; // lodret afstand mellem generationer
const NODESEP = 30; // vandret afstand mellem noder

interface Viewport {
  x: number; // pan-x (px)
  y: number; // pan-y (px)
  scale: number;
}

interface NodeLayout {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  depth: number;
}

interface EdgeLayout {
  from: string;
  to: string;
  points: { x: number; y: number }[];
}

export function FamilyTreeView() {
  const doc = useApp((s) => s.doc);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const dragging = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // ResizeObserver
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Compute tree layout with dagre
  const { nodes, edges, bounds } = useMemo(() => {
    const relations = (doc.relations ?? []).filter((r) => r.typeId === 'rt-parent');
    if (!relations.length) return { nodes: [] as NodeLayout[], edges: [] as EdgeLayout[], bounds: null as null | { x: number; y: number; w: number; h: number } };

    const itemMap = new Map<string, Item>(doc.items.map((i) => [i.id, i]));
    const typeMap = new Map(doc.itemTypes.map((t) => [t.id, t]));

    // Build dagre graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', ranksep: RANKSEP, nodesep: NODESEP, marginx: 40, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));

    // Collect connected node IDs
    const connectedIds = new Set<string>();
    for (const r of relations) {
      connectedIds.add(r.fromId);
      connectedIds.add(r.toId);
    }

    for (const id of connectedIds) {
      const item = itemMap.get(id);
      if (!item) continue;
      g.setNode(id, { width: NODE_W, height: NODE_H, label: item.label });
    }

    for (const r of relations) {
      // from = parent, to = child (by definition in our model)
      if (connectedIds.has(r.fromId) && connectedIds.has(r.toId)) {
        g.setEdge(r.fromId, r.toId);
      }
    }

    dagre.layout(g);

    // Extract positions
    const nodesOut: NodeLayout[] = [];
    const depthMap = new Map<string, number>();

    for (const id of connectedIds) {
      const n = g.node(id);
      if (!n) continue;
      const item = itemMap.get(id);
      if (!item) continue;
      const type = typeMap.get(item.typeId);
      nodesOut.push({
        id,
        label: item.label,
        color: item.color ?? type?.color ?? '#888',
        x: n.x - NODE_W / 2,
        y: n.y - NODE_H / 2,
        depth: n.y ?? 0,
      });
      depthMap.set(id, n.y);
    }

    const edgesOut: EdgeLayout[] = relations
      .filter((r) => connectedIds.has(r.fromId) && connectedIds.has(r.toId))
      .map((r) => {
        const e = g.edge(r.fromId, r.toId);
        return {
          from: r.fromId,
          to: r.toId,
          points: (e?.points ?? []).map((p) => ({ x: p.x, y: p.y })),
        };
      });

    // Bounding box
    const xs = nodesOut.map((n) => n.x);
    const ys = nodesOut.map((n) => n.y);
    const bounds = {
      x: Math.min(...xs) - 20,
      y: Math.min(...ys) - 20,
      w: Math.max(...xs) + NODE_W - Math.min(...xs) + 40,
      h: Math.max(...ys) + NODE_H - Math.min(...ys) + 40,
    };

    return { nodes: nodesOut, edges: edgesOut, bounds };
  }, [doc]);

  // Auto-fit on first render or when nodes change
  const fittedKey = useRef('');
  useEffect(() => {
    if (!bounds || !size.w) return;
    const key = `${nodes.length}:${size.w}:${size.h}`;
    if (fittedKey.current === key) return;
    fittedKey.current = key;
    const pad = 60;
    const scaleX = (size.w - pad * 2) / bounds.w;
    const scaleY = (size.h - pad * 2) / bounds.h;
    const scale = Math.min(scaleX, scaleY, 1.5);
    const x = (size.w - bounds.w * scale) / 2 - bounds.x * scale;
    const y = (size.h - bounds.h * scale) / 2 - bounds.y * scale;
    setVp({ x, y, scale });
  }, [bounds, size, nodes.length]);

  // Zoom (wheel)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setVp((prev) => {
        const ns = Math.max(0.1, Math.min(4, prev.scale * factor));
        const nx = mx - (mx - prev.x) * (ns / prev.scale);
        const ny = my - (my - prev.y) * (ns / prev.scale);
        return { x: nx, y: ny, scale: ns };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pan (pointer drag)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as SVGElement).closest('.ft-node')) return;
    dragging.current = { startX: e.clientX, startY: e.clientY, origX: vpRef.current.x, origY: vpRef.current.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragging.current; // v rdi-kopi: ref kan nulstilles f rer React k rer opdateringen
    if (!d) return;
    setVp((prev) => panPoint(prev, d, e.clientX, e.clientY));
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  // No relations message
  if (!nodes.length) {
    return (
      <div className="ft-empty" ref={wrapRef} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
        <p style={{ opacity: 0.6, textAlign: 'center', maxWidth: 400 }}>
          Ingen forælder-børn relationer.<br />
          Tilføj relationer med typen <strong>Forælder → Barn</strong> i Matrix-visningen, eller importér en .aeon-fil med slægtskabsrelationer.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="ft-view"
      style={{ width: '100%', height: '100%', position: 'relative', cursor: dragging.current ? 'grabbing' : 'grab', overflow: 'hidden' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg ref={svgRef} width={size.w} height={size.h} style={{ position: 'absolute', top: 0, left: 0 }}>
        <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            if (edge.points.length < 2) return null;
            const d = edge.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
            return <path key={i} d={d} fill="none" stroke="#999" strokeWidth={1.5} opacity={0.7} />;
          })}

          {/* Nodes */}
          {nodes.map((n) => (
            <g
              key={n.id}
              className="ft-node"
              transform={`translate(${n.x},${n.y})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); select(n.id === selectedId ? null : n.id); }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={n.color}
                stroke={n.id === selectedId ? '#fff' : 'transparent'}
                strokeWidth={2}
                opacity={0.85}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                fill={textColorFor(n.color).color}
                fontSize={12}
                fontWeight={500}
              >
                {n.label.length > 18 ? n.label.slice(0, 16) + '…' : n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Controls overlay */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 4 }}>
        <button className="ft-btn" onClick={() => setVp((v) => ({ ...v, scale: Math.min(4, v.scale * 1.3) }))}>+</button>
        <button className="ft-btn" onClick={() => setVp((v) => ({ ...v, scale: Math.max(0.1, v.scale / 1.3) }))}>−</button>
        <button className="ft-btn" onClick={() => {
          if (!bounds || !size.w) return;
          const pad = 60;
          const s = Math.min((size.w - pad * 2) / bounds.w, (size.h - pad * 2) / bounds.h, 1.5);
          setVp({ x: (size.w - bounds.w * s) / 2 - bounds.x * s, y: (size.h - bounds.h * s) / 2 - bounds.y * s, scale: s });
        }}>⊡</button>
      </div>
    </div>
  );
}
