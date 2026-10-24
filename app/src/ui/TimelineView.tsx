// **** Timeline-view (M2+M4+M12): vandret zoombar tidslinje + entity-sidebar + collapse + søg + klynger ****
// Zoom: musehjul, pan: træk. Usikker = gradient-halo, fortsat = pil.
// M12: Entity-sidebar, fold hierarki, søg & centrér, klynge-tælling.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { formatSpan, formatUncertainty } from '../core/format';
import { clampPx, contentBounds, pickStep, spanBounds, stepLabel, ticksFor } from '../core/scale';
import { applyFilter } from '../core/filters';
import { isDependencyViolated } from '../core/dependencies';
import { EntitySidebar } from './EntitySidebar';
import type { Item } from '../model/doc';

interface Viewport {
  center: number; // JD i midten
  px: number; // pixels pr. dag
}

const ROW_H = 28;
const CLUSTER_THRESHOLD = 4; // clustered når N poster overlapper inden for X pixels

export function TimelineView() {
  const doc = useApp((s) => s.doc);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const collapsedIds = useApp((s) => s.collapsedIds);
  const toggleCollapse = useApp((s) => s.toggleCollapse);
  const jumpTarget = useApp((s) => s.jumpTarget);
  const clearJump = useApp((s) => s.clearJump);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [vp, setVp] = useState<Viewport>({ center: 1730000, px: 1 / 40 });
  const vpRef = useRef(vp);
  vpRef.current = vp;

  // Søg & hoppe
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);

  // mål bredde (justér for sidebar)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const cb = contentBounds(doc.items.map((i) => i.span));
    if (!cb || !width) return;
    const span = cb.right - cb.left;
    setVp({ center: (cb.left + cb.right) / 2, px: clampPx((width - 80) / span) });
  }, [doc.items, width]);

  // fit når indhold eller bredde ændrer sig første gang
  const fittedKey = useRef('');
  useEffect(() => {
    const key = `${doc.items.length}:${width}`;
    if (fittedKey.current !== key && width > 0) {
      fittedKey.current = key;
      fit();
    }
  }, [doc.items.length, width, fit]);

  // Jump-to reacting
  useEffect(() => {
    if (!jumpTarget) return;
    const item = doc.items.find((i) => i.id === jumpTarget);
    if (item) {
      const bd = spanBounds(item.span);
      if (bd) {
        setVp((v) => ({ center: (bd.a + bd.b) / 2, px: Math.max(v.px, 0.01) }));
        select(jumpTarget);
      }
    }
    clearJump();
  }, [jumpTarget, doc.items, select, clearJump]);

  const left = vp.center - width / 2 / vp.px;
  const right = vp.center + width / 2 / vp.px;
  const x = useCallback((jd: number) => (jd - left) * vp.px, [left, vp.px]);

  // Search handler
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const q = searchQ.toLowerCase().trim();
    const matches = doc.items.filter((it) =>
      it.label.toLowerCase().includes(q) || (it.notes ?? '').toLowerCase().includes(q)
    ).slice(0, 10);
    setSearchResults(matches);
  }, [searchQ, doc.items]);

  // hjul-zoom (non-passive for at kunne preventDefault)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pxX = e.clientX - rect.left;
      setVp((v) => {
        const factor = Math.pow(1.0015, -e.deltaY);
        const npx = clampPx(v.px * factor);
        const l = v.center - rect.width / 2 / v.px;
        const jdAtCursor = l + pxX / v.px;
        const nl = jdAtCursor - pxX / npx;
        return { center: nl + rect.width / 2 / npx, px: npx };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // pan med træk
  const drag = useRef<{ x: number; center: number } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.bar') || (e.target as HTMLElement).closest('.cluster')) return;
      drag.current = { x: e.clientX, center: vpRef.current.center };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      setVp((v) => ({ ...v, center: drag.current!.center - dx / v.px }));
    };
    const up = () => (drag.current = null);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
  }, []);

  const step = pickStep(vp.px);
  const ticks = useMemo(() => ticksFor(left, right, vp.px), [left, right, vp.px]);

  // ---- M12: Build rows med collapse-støtte + klynger ----
  const activeFilter = useApp((s) => s.activeFilter);

  // Forældre-børn kort
  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const it of doc.items) {
      if (it.parentId) {
        const arr = map.get(it.parentId) ?? [];
        arr.push(it.id);
        map.set(it.parentId, arr);
      }
    }
    return map;
  }, [doc.items]);

  // Items der er collapsed (skjul descendants)
  const hiddenByCollapse = useMemo(() => {
    const hidden = new Set<string>();
    const stack: string[] = [];
    for (const id of collapsedIds) {
      if (id.startsWith('grp:') || id.startsWith('tag:')) continue; // non-item collapse keys
      stack.push(id);
    }
    while (stack.length) {
      const pid = stack.pop()!;
      for (const cid of childrenMap.get(pid) ?? []) {
        hidden.add(cid);
        stack.push(cid);
      }
    }
    return hidden;
  }, [collapsedIds, childrenMap]);

  // Rows (filtreret + collapsed + klynge-detektering)
  const { rows, clusters } = useMemo(() => {
    const filtered = applyFilter(doc.items, activeFilter).filter((it) => !hiddenByCollapse.has(it.id));
    const list = [...filtered]
      .map((it) => ({ it, bd: spanBounds(it.span) }))
      .filter((r): r is { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>> } => !!r.bd)
      .sort((a, b) => a.bd.a - b.bd.a || a.it.label.localeCompare(b.it.label));

    // Klynge-detektion: when items overlap horizontally AND there are many in same pixel band
    const clustered = new Set<string>();
    const clusterList: { items: Item[]; x: number; y: number; count: number }[] = [];

    if (list.length > 10) {
      // Group by y-row proximity and x-overlap
      const groups: { items: Item[]; minA: number; maxB: number }[] = [];
      for (const r of list) {
        const cx = (r.bd.a + r.bd.b) / 2;
        let placed = false;
        for (const g of groups) {
          const gcx = (g.minA + g.maxB) / 2;
          const distPx = Math.abs(cx - gcx) * vp.px;
          if (distPx < 30) {
            g.items.push(r.it);
            g.minA = Math.min(g.minA, r.bd.a);
            g.maxB = Math.max(g.maxB, r.bd.b);
            placed = true;
            break;
          }
        }
        if (!placed) groups.push({ items: [r.it], minA: r.bd.a, maxB: r.bd.b });
      }
      // Clusters with too many items at small zoom
      for (const g of groups) {
        if (g.items.length >= CLUSTER_THRESHOLD && vp.px < 0.005) {
          const cx = (g.minA + g.maxB) / 2;
          for (const it of g.items) clustered.add(it.id);
          clusterList.push({ items: g.items, x: cx, y: 0, count: g.items.length });
        }
      }
    }

    // Assign rows (skip clustered)
    const unclustered = list.filter((r) => !clustered.has(r.it.id));
    const positioned = unclustered.map((r, i) => ({ ...r, y: i * ROW_H }));

    return { rows: positioned, clusters: clusterList };
  }, [doc.items, activeFilter, hiddenByCollapse, vp.px]);

  const visible = rows.filter((r) => x(r.bd.b) > -200 && x(r.bd.a) < width + 200);
  const hidden = rows.length - visible.length;

  const zoom = (factor: number) =>
    setVp((v) => ({ ...v, px: clampPx(v.px * factor) }));

  return (
    <div className="tl-layout">
      <EntitySidebar />
      <div className="tl-main">
        <div className="toolbar">
          <button onClick={() => zoom(1.6)} title="Zoom ind">＋</button>
          <button onClick={() => zoom(1 / 1.6)} title="Zoom ud">－</button>
          <button onClick={fit}>Tilpas</button>
          {/* Søg & hoppe */}
          <div className="tl-search">
            <input
              type="text"
              placeholder="Søg post…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  useApp.getState().jumpTo(searchResults[0].id);
                  setSearchQ('');
                }
                if (e.key === 'Escape') setSearchQ('');
              }}
            />
            {searchResults.length > 0 && (
              <ul className="tl-search-results">
                {searchResults.map((it) => (
                  <li key={it.id} onClick={() => { useApp.getState().jumpTo(it.id); setSearchQ(''); }}>
                    {it.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className="count">
            {rows.length} daterede{hidden > 0 ? ` (${hidden} uden for view)` : ''}
            {clusters.length > 0 ? ` · ${clusters.length} klynger` : ''}
            {doc.items.length > rows.length + [...hiddenByCollapse].filter((id) => { const it = doc.items.find(i => i.id === id); return it && spanBounds(it.span); }).length
              ? ` · ${doc.items.length - rows.length - [...hiddenByCollapse].filter((id) => { const it = doc.items.find(i => i.id === id); return it && spanBounds(it.span); }).length} uden dato`
              : ''}
          </span>
        </div>
        <div className="tl" ref={wrapRef}>
          <div className="ruler" style={{ height: 30 }}>
            {ticks.map((t, i) => (
              <div key={i} className="tick" style={{ left: x(t.jd) }}>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
          <div className="lanes" style={{ height: Math.max(rows.length, 1) * ROW_H }}>
            {ticks.map((t, i) => (
              <div key={i} className="grid" style={{ left: x(t.jd), height: '100%' }} />
            ))}
            {Array.from({ length: rows.length }, (_, i) => (
              <div key={i} className={`lanebg ${i % 2 ? 'alt' : ''}`} style={{ top: i * ROW_H, height: ROW_H }} />
            ))}
            {visible.map(({ it, bd, y }) => {
              const type = doc.itemTypes.find((t) => t.id === it.typeId);
              const color = it.color ?? type?.color ?? '#888';
              const xa = x(bd.a);
              const xb = x(bd.b);
              const w = Math.max(3, xb - xa);
              const hasChildren = (childrenMap.get(it.id)?.length ?? 0) > 0;
              const isCollapsed = collapsedIds.has(it.id);
              const tip = `${it.label} — ${formatSpan(it.span)}${formatUncertainty(it.span) ? ` (${formatUncertainty(it.span)})` : ''}${it.verseRefs?.length ? `\n📖 ${it.verseRefs.map((v) => `${v.bookSlug} ${v.ch}${v.vs ? ':' + v.vs : ''}`).join(', ')}` : ''}${it.tags?.length ? `\n🏷 ${it.tags.join(', ')}` : ''}`;
              return (
                <div key={it.id} className={`bar ${w > 140 ? 'wide' : ''} ${selectedId === it.id ? 'selected' : ''}`} title={tip} onClick={() => select(it.id)} style={{ left: xa, top: y + 5, width: w, background: color }}>
                  {bd.ua !== undefined && bd.ua > bd.a && (
                    <span className="halo" style={{ left: x(bd.a) - xa, width: x(bd.ua) - x(bd.a), background: `linear-gradient(90deg, ${color}55, ${color}22)` }} />
                  )}
                  {bd.ub !== undefined && bd.ub < bd.b && (
                    <span className="halo" style={{ left: x(bd.ub) - xa, width: x(bd.b) - x(bd.ub), background: `linear-gradient(90deg, ${color}22, ${color}55)` }} />
                  )}
                  {it.span.ongoing && <span className="arrow" style={{ borderColor: color }} />}
                  {/* Collapse toggle */}
                  {hasChildren && (
                    <button
                      className={`bar-collapse ${isCollapsed ? 'collapsed' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleCollapse(it.id); }}
                      title={isCollapsed ? `Vis ${childrenMap.get(it.id)!.length} children` : 'Skjul children'}
                    >
                      {isCollapsed ? '+' : '−'}
                    </button>
                  )}
                  <span className="barlabel" style={{ color: w > 140 ? '#fff' : color }}>
                    {it.imageId ? '🖼 ' : ''}{w > 26 ? it.label : ''}
                    {isCollapsed && (childrenMap.get(it.id)?.length ?? 0) > 0 && ` (+${childrenMap.get(it.id)!.length})`}
                  </span>
                </div>
              );
            })}

            {/* Klynge-bubbles */}
            {clusters.map((cl, i) => {
              const cx = x(cl.x);
              if (cx < -50 || cx > width + 50) return null;
              return (
                <div
                  key={i}
                  className="cluster"
                  style={{ left: cx - 16, top: ROW_H / 2 - 16 }}
                  title={`${cl.count} poster her. Klik for at zoome ind.`}
                  onClick={() => {
                    setVp((v) => ({ center: cl.x, px: Math.min(0.1, v.px * 4) }));
                  }}
                >
                  {cl.count}
                </div>
              );
            })}

            {/* M4: Dependency-pile (SVG overlay) */}
            <svg className="dep-overlay" width={width} height={Math.max(rows.length, 1) * ROW_H}>
              {(doc.dependencies ?? []).map((dep) => {
                const blockerRow = rows.find((r) => r.it.id === dep.blockerId);
                const blockedRow = rows.find((r) => r.it.id === dep.blockedId);
                if (!blockerRow || !blockedRow) return null;
                const violated = isDependencyViolated(dep, doc);
                const x1 = x(blockerRow.bd.b);
                const y1 = blockerRow.y + ROW_H / 2;
                const x2 = x(blockedRow.bd.a);
                const y2 = blockedRow.y + ROW_H / 2;
                if (x1 < -200 || x1 > width + 200 || x2 < -200 || x2 > width + 200) return null;
                const midY = (y1 + y2) / 2;
                const path = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
                return (
                  <g key={dep.id}>
                    <path d={path} fill="none" stroke={violated ? '#e74c3c' : '#888'} strokeWidth={violated ? 2 : 1} strokeDasharray={violated ? '' : '4 2'} markerEnd="url(#arrowhead)" />
                    <text x={(x1 + x2) / 2} y={midY - 4} textAnchor="middle" fontSize={9} fill={violated ? '#e74c3c' : '#666'}>{dep.kind}</text>
                  </g>
                );
              })}

              {/* M7: Profeti→Opfyldelse-buer (gyldne buer) */}
              {(doc.relations ?? []).filter((r) => r.typeId === 'rt-fulfillment').map((rel) => {
                const prophecyRow = rows.find((r) => r.it.id === rel.fromId);
                const fulfillRow = rows.find((r) => r.it.id === rel.toId);
                if (!prophecyRow || !fulfillRow) return null;
                const x1 = x((prophecyRow.bd.a + prophecyRow.bd.b) / 2);
                const y1 = prophecyRow.y + ROW_H / 2;
                const x2 = x((fulfillRow.bd.a + fulfillRow.bd.b) / 2);
                const y2 = fulfillRow.y + ROW_H / 2;
                if (x1 < -200 || x1 > width + 200 || x2 < -200 || x2 > width + 200) return null;
                const arcH = Math.abs(y2 - y1) * 0.4 + 20;
                const midX = (x1 + x2) / 2;
                const path = `M${x1},${y1} Q${midX},${Math.min(y1, y2) - arcH} ${x2},${y2}`;
                return (
                  <g key={rel.id} className="fulfill-arc">
                    <path d={path} fill="none" stroke="#d4a017" strokeWidth={2} strokeLinecap="round" opacity={0.8} markerEnd="url(#arrow-gold)" />
                    <circle cx={x1} cy={y1} r={4} fill="#d4a017" opacity={0.9} />
                    <text x={midX} y={Math.min(y1, y2) - arcH + 2} textAnchor="middle" fontSize={10} fill="#d4a017">📜</text>
                  </g>
                );
              })}

              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#888" />
                </marker>
                <marker id="arrow-gold" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill="#d4a017" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
        <p className="hint">Træk = pan · Hjul = zoom · Søg = hop til post · +/− = fold hierarki</p>
      </div>
    </div>
  );
}
