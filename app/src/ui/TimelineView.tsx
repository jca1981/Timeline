// **** Timeline-view (M2+M4+M12+M13): zoombar tidslinje + sidebar + collapse + søg + klynger + minimap + type-lanes + tastatur ****
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { formatSpan, formatUncertainty } from '../core/format';
import { clampPx, contentBounds, spanBounds, ticksFor } from '../core/scale';
import { applyFilter } from '../core/filters';
import { isDependencyViolated } from '../core/dependencies';
import { EntitySidebar } from './EntitySidebar';
import type { Item } from '../model/doc';

interface Viewport {
  center: number; // JD i midten
  px: number; // pixels pr. dag
}

const ROW_H = 28;
const CLUSTER_THRESHOLD = 4;
const MINIMAP_H = 20;

type LaneMode = 'chrono' | 'type';

export function TimelineView() {
  const doc = useApp((s) => s.doc);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const collapsedIds = useApp((s) => s.collapsedIds);
  const toggleCollapse = useApp((s) => s.toggleCollapse);
  const jumpTarget = useApp((s) => s.jumpTarget);
  const clearJump = useApp((s) => s.clearJump);
  const jumpTo = useApp((s) => s.jumpTo);
  const wrapRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [vp, setVp] = useState<Viewport>({ center: 1730000, px: 1 / 40 });
  const vpRef = useRef(vp);
  vpRef.current = vp;

  // Søg & hoppe
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);

  // M13: type-lane mode
  const [laneMode, setLaneMode] = useState<LaneMode>('chrono');

  // mål bredde
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

  // M13: Tastatur navigation (Ctrl+←/→, +/− zoom)
  const rowsRef = useRef<{ it: Item; bd: NonNullable<ReturnType<typeof spanBounds>>; y: number }[]>([]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip hvis i input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const rows = rowsRef.current;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          const curIdx = rows.findIndex((r) => r.it.id === selectedId);
          const nextIdx = curIdx < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, curIdx + dir));
          if (rows[nextIdx]) {
            const bd = rows[nextIdx].bd;
            setVp((v) => ({ center: (bd.a + bd.b) / 2, px: Math.max(v.px, 0.01) }));
            select(rows[nextIdx].it.id);
          }
        }
      } else if (e.key === '+' || e.key === '=') {
        setVp((v) => ({ ...v, px: clampPx(v.px * 1.4) }));
      } else if (e.key === '-' || e.key === '_') {
        setVp((v) => ({ ...v, px: clampPx(v.px / 1.4) }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, select]);

  // hjul-zoom
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
      if ((e.target as HTMLElement).closest('.bar') || (e.target as HTMLElement).closest('.cluster') || (e.target as HTMLElement).closest('.minimap')) return;
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

  const ticks = useMemo(() => ticksFor(left, right, vp.px), [left, right, vp.px]);

  // ---- Rows med collapse + klynger + lanes ----
  const activeFilter = useApp((s) => s.activeFilter);

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

  const hiddenByCollapse = useMemo(() => {
    const hidden = new Set<string>();
    const stack: string[] = [];
    for (const id of collapsedIds) {
      if (id.startsWith('grp:') || id.startsWith('tag:')) continue;
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

  // M15: Color inheritance — children without own color get parent’s color
  const effectiveColor = useMemo(() => {
    const typeMap = new Map(doc.itemTypes.map((t) => [t.id, t.color]));
    const itemMap = new Map(doc.items.map((it) => [it.id, it]));
    const cache = new Map<string, string>();
    function resolve(id: string): string {
      if (cache.has(id)) return cache.get(id)!;
      const it = itemMap.get(id);
      if (!it) return '#888';
      const own = it.color ?? typeMap.get(it.typeId) ?? '#888';
      // Use own color if explicitly set (not just type default)
      if (it.color) { cache.set(id, it.color); return it.color; }
      // Otherwise inherit from parent
      if (it.parentId && itemMap.has(it.parentId)) {
        const pc = resolve(it.parentId);
        cache.set(id, pc);
        return pc;
      }
      cache.set(id, own);
      return own;
    }
    for (const it of doc.items) resolve(it.id);
    return cache;
  }, [doc.items, doc.itemTypes]);

  const { rows, clusters, laneGroups, eraBands, datelessItems } = useMemo(() => {
    const filtered = applyFilter(doc.items, activeFilter).filter((it) => !hiddenByCollapse.has(it.id));
    const list = [...filtered]
      .map((it) => ({ it, bd: spanBounds(it.span) }))
      .filter((r): r is { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>> } => !!r.bd)
      .sort((a, b) => a.bd.a - b.bd.a || a.it.label.localeCompare(b.it.label));

    // Cluster detection
    const clustered = new Set<string>();
    const clusterList: { items: Item[]; x: number; y: number; count: number }[] = [];

    if (list.length > 10) {
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
      for (const g of groups) {
        if (g.items.length >= CLUSTER_THRESHOLD && vp.px < 0.005) {
          const cx = (g.minA + g.maxB) / 2;
          for (const it of g.items) clustered.add(it.id);
          clusterList.push({ items: g.items, x: cx, y: 0, count: g.items.length });
        }
      }
    }

    const unclustered = list.filter((r) => !clustered.has(r.it.id));

    // Lane mode: group by type
    let lanes: { typeId: string; typeName: string; items: typeof unclustered }[] = [];
    if (laneMode === 'type') {
      const byType = new Map<string, typeof unclustered>();
      for (const r of unclustered) {
        const arr = byType.get(r.it.typeId) ?? [];
        arr.push(r);
        byType.set(r.it.typeId, arr);
      }
      lanes = doc.itemTypes
        .filter((t) => (byType.get(t.id)?.length ?? 0) > 0)
        .map((t) => ({ typeId: t.id, typeName: t.name, items: byType.get(t.id)! }));
    }

    // Assign y-positions
    let yPos = 0;
    type Row = { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>>; y: number };
    let positioned: Row[];
    const laneInfo: { typeName: string; y: number; count: number; color: string }[] = [];

    if (laneMode === 'type' && lanes.length > 1) {
      positioned = [];
      for (const lane of lanes) {
        const type = doc.itemTypes.find((t) => t.id === lane.typeId);
        laneInfo.push({ typeName: lane.typeName, y: yPos, count: lane.items.length, color: type?.color ?? '#888' });
        for (const r of lane.items) {
          positioned.push({ ...r, y: yPos * ROW_H });
          yPos++;
        }
        yPos++; // gap between lanes
      }
    } else {
      positioned = unclustered.map((r, i) => ({ ...r, y: i * ROW_H }));
    }

    rowsRef.current = positioned;

    // M14: Era bands — parent items with many descendants + long span
    const ERA_MIN_DESC = 3;
    const ERA_MIN_SPAN_DAYS = 18250; // 50 years
    const eras: { id: string; label: string; a: number; b: number; color: string }[] = [];
    for (const it of doc.items) {
      const kids = childrenMap.get(it.id);
      if (!kids || kids.length < ERA_MIN_DESC) continue;
      const bd = spanBounds(it.span);
      if (!bd) continue;
      if (bd.b - bd.a < ERA_MIN_SPAN_DAYS) continue;
      const type = doc.itemTypes.find((t) => t.id === it.typeId);
      eras.push({ id: it.id, label: it.label, a: bd.a, b: bd.b, color: it.color ?? type?.color ?? '#888' });
    }

    // M14: Dateless items (no valid date bounds)
    const dless = applyFilter(doc.items, activeFilter).filter((it) => !hiddenByCollapse.has(it.id) && !spanBounds(it.span));

    return { rows: positioned, clusters: clusterList, laneGroups: laneInfo, eraBands: eras, datelessItems: dless };
  }, [doc.items, doc.itemTypes, activeFilter, hiddenByCollapse, vp.px, laneMode]);

  const visible = rows.filter((r) => x(r.bd.b) > -200 && x(r.bd.a) < width + 200);
  const hidden = rows.length - visible.length;

  // ---- Minimap helpers ----
  const contentBd = useMemo(() => contentBounds(doc.items.map((i) => i.span)), [doc.items]);
  const totalRows = rows.length;

  function minimapX(jd: number): number {
    if (!contentBd) return 0;
    return ((jd - contentBd.left) / (contentBd.right - contentBd.left)) * width;
  }

  // Minimap drag
  const mmDrag = useRef(false);
  useEffect(() => {
    const el = minimapRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.minimap')) {
        mmDrag.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        const rect = el.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        if (contentBd) {
          const jd = contentBd.left + frac * (contentBd.right - contentBd.left);
          setVp((v) => ({ ...v, center: jd }));
        }
      }
    };
    const move = (e: PointerEvent) => {
      if (!mmDrag.current || !contentBd) return;
      const rect = el.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      const jd = contentBd.left + frac * (contentBd.right - contentBd.left);
      setVp((v) => ({ ...v, center: jd }));
    };
    const up = () => { mmDrag.current = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
  }, [contentBd]);

  const zoom = (factor: number) =>
    setVp((v) => ({ ...v, px: clampPx(v.px * factor) }));

  return (
    <div className="tl-layout">
      <EntitySidebar />
      <div className="tl-main">
        <div className="toolbar">
          <button onClick={() => zoom(1.6)} title="Zoom ind (+)">＋</button>
          <button onClick={() => zoom(1 / 1.6)} title="Zoom ud (−)">－</button>
          <button onClick={fit}>Tilpas</button>
          {/* M15: Zoom-presets */}
          <span className="zoom-presets">
            <button onClick={() => setVp((v) => ({ ...v, px: clampPx(1 / 365.25) }))} title="Zoom til århundrede-overblik">årh.</button>
            <button onClick={() => setVp((v) => ({ ...v, px: clampPx(1 / 30) }))} title="Zoom til årtier">10 år</button>
            <button onClick={() => setVp((v) => ({ ...v, px: clampPx(1 / 3) }))} title="Zoom til enkeltår">3 år</button>
          </span>
          <button
            className={laneMode === 'type' ? 'on' : ''}
            onClick={() => setLaneMode((m) => m === 'chrono' ? 'type' : 'chrono')}
            title="Skift mellem kronologisk rækkefølge og spor pr. type"
          >
            {laneMode === 'type' ? '🔀 Spor pr. type' : '📅 Kronologisk'}
          </button>
          {/* Søg */}
          <div className="tl-search">
            <input
              type="text"
              placeholder="Søg post… (Ctrl+←/→ navigér)"
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

        {/* M13: Minimap */}
        {contentBd && (
          <div className="minimap" ref={minimapRef} style={{ height: MINIMAP_H, width }}>
            {/* content density bars */}
            {doc.items.map((it) => {
              const bd = spanBounds(it.span);
              if (!bd) return null;
              const x1 = minimapX(bd.a);
              const w = Math.max(1, minimapX(bd.b) - x1);
              const type = doc.itemTypes.find((t) => t.id === it.typeId);
              const color = it.color ?? type?.color ?? '#888';
              return <div key={it.id} className="minimap-bar" style={{ left: x1, width: w, background: color }} />;
            })}
            {/* viewport indicator */}
            <div
              className="minimap-viewport"
              style={{
                left: minimapX(left),
                width: Math.max(4, minimapX(right) - minimapX(left)),
              }}
            />
          </div>
        )}

        <div className="tl" ref={wrapRef}>
          <div className="ruler" style={{ height: 30 }}>
            {ticks.map((t, i) => (
              <div key={i} className="tick" style={{ left: x(t.jd) }}>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
          <div className="lanes" style={{ height: Math.max(totalRows, 1) * ROW_H }}>
            {/* M14: Æra-bånd (baggrundsperioder) */}
            {eraBands.map((era) => {
              const ex = x(era.a);
              const exb = x(era.b);
              if (exb < -500 || ex > width + 500) return null;
              return (
                <div key={era.id} className="era-band" style={{ left: ex, width: exb - ex, background: era.color + '12', borderLeft: `2px solid ${era.color}44`, borderRight: `2px solid ${era.color}44` }} title={era.label}>
                  <span className="era-label" style={{ color: era.color }}>{era.label}</span>
                </div>
              );
            })}
            {ticks.map((t, i) => (
              <div key={i} className="grid" style={{ left: x(t.jd), height: '100%' }} />
            ))}
            {Array.from({ length: totalRows }, (_, i) => (
              <div key={i} className={`lanebg ${i % 2 ? 'alt' : ''}`} style={{ top: i * ROW_H, height: ROW_H }} />
            ))}

            {/* Lane labels (type mode) */}
            {laneGroups.map((lg, i) => (
              <div key={i} className="lane-label" style={{ top: lg.y * ROW_H - 2, color: lg.color }}>
                <span className="lane-label-dot" style={{ background: lg.color }} />
                {lg.typeName} ({lg.count})
              </div>
            ))}

            {visible.map(({ it, bd, y }) => {
              const color = effectiveColor.get(it.id) ?? '#888';
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
                  {hasChildren && (
                    <button className={`bar-collapse ${isCollapsed ? 'collapsed' : ''}`} onClick={(e) => { e.stopPropagation(); toggleCollapse(it.id); }} title={isCollapsed ? `Vis ${childrenMap.get(it.id)!.length} children` : 'Skjul children'}>
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
                <div key={i} className="cluster" style={{ left: cx - 16, top: ROW_H / 2 - 16 }} title={`${cl.count} poster her. Klik for at zoome ind.`} onClick={() => setVp((v) => ({ center: cl.x, px: Math.min(0.1, v.px * 4) }))}>
                  {cl.count}
                </div>
              );
            })}

            {/* Dependency-pile + Profeti-buer (SVG overlay) */}
            <svg className="dep-overlay" width={width} height={Math.max(totalRows, 1) * ROW_H}>
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
        {/* M14: Dato-løse poster */}
        {datelessItems.length > 0 && (
          <div className={`dateless-section ${collapsedIds.has('grp:dateless') ? 'collapsed' : ''}`}>
            <button className="dateless-toggle" onClick={() => toggleCollapse('grp:dateless')}>
              {collapsedIds.has('grp:dateless') ? '▶' : '▼'} Uden dato ({datelessItems.length})
            </button>
            {!collapsedIds.has('grp:dateless') && (
              <div className="dateless-chips">
                {datelessItems.map((it) => {
                  const color = effectiveColor.get(it.id) ?? '#888';
                  return (
                    <span key={it.id} className={`dateless-chip ${selectedId === it.id ? 'selected' : ''}`} style={{ borderColor: color, background: color + '18' }} onClick={() => { select(it.id); jumpTo(it.id); }}>
                      {it.imageId ? '🖼 ' : ''}{it.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <p className="hint">Træk = pan · Hjul/+/− = zoom · Ctrl+←/→ = forrige/næste · Søg = hop til · Klik minimap = jump</p>
      </div>
    </div>
  );
}
