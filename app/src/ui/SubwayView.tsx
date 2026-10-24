// **** Subway-view (M6): parallelle spor som metro-kort. X=tid, Y=spor, cirkler=stationer. ****
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { spanBounds } from '../core/scale';
import type { Item } from '../model/doc';
import { applyFilter } from '../core/filters';

// Farvepalet til spor (16 farver, cykliske)
const PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#00bcd4', '#ff6b81', '#a29bfe',
  '#fd79a8', '#55efc4', '#fdcb6e', '#6c5ce7', '#00cec9', '#fab1a0',
];

interface Line {
  name: string;
  color: string;
  items: Array<{ item: Item; jd: number; jdEnd: number | null }>;
}

export function SubwayView() {
  const doc = useApp((s) => s.doc);
  const activeFilter = useApp((s) => s.activeFilter);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [vp, setVp] = useState({ x: 0, y: 0, scale: 1 });
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const dragging = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Resize
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Gruppér i linjer: forælder → børn på samme spor; orphans grupperes pr. tag/type
  const lines = useMemo(() => {
    const filtered = applyFilter(doc.items, activeFilter);
    const withDates: Array<{ item: Item; jd: number; jdEnd: number | null }> = [];
    for (const it of filtered) {
      const b = spanBounds(it.span);
      if (!b) continue;
      withDates.push({ item: it, jd: b.a, jdEnd: b.b });
    }

    // Group by parentId
    const parentMap = new Map<string | null, Item[]>();
    for (const it of filtered) {
      const key = it.parentId ?? null;
      if (!parentMap.has(key)) parentMap.set(key, []);
      parentMap.get(key)!.push(it);
    }

    const result: Line[] = [];
    const itemWithDates = new Map(withDates.map((w) => [w.item.id, w]));
    let ci = 0;

    // Parent → line (med børnene + selve forælderen)
    for (const [parentId, children] of parentMap) {
      if (!parentId) continue;
      const parent = doc.items.find((it) => it.id === parentId);
      const group = parent ? [parent, ...children] : children;
      const items = group
        .map((it) => itemWithDates.get(it.id))
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => a.jd - b.jd);
      if (items.length < 2) continue; // ensomme poster går i "Øvrige"
      const name = parent?.label ?? 'Gruppe';
      result.push({ name, color: PALETTE[ci % PALETTE.length], items });
      ci++;
    }

    // Øvrige (uden forælder eller ikke grupperet) → én linje pr. type eller pr. tag
    const covered = new Set(result.flatMap((l) => l.items.map((i) => i.item.id)));
    const orphans = withDates.filter((w) => !covered.has(w.item.id));
    // Group by tag[0], fallback typeId
    const orphanGroups = new Map<string, typeof orphans>();
    for (const w of orphans) {
      const key = w.item.tags?.[0] || doc.itemTypes.find((t) => t.id === w.item.typeId)?.name || 'Øvrige';
      if (!orphanGroups.has(key)) orphanGroups.set(key, []);
      orphanGroups.get(key)!.push(w);
    }
    for (const [name, items] of orphanGroups) {
      result.push({ name, color: PALETTE[ci % PALETTE.length], items: items.sort((a, b) => a.jd - b.jd) });
      ci++;
    }

    return result;
  }, [doc, activeFilter]);

  // Layout constants
  const TRACK_H = 50; // lodret afstand mellem spor
  const PAD_TOP = 60;
  const PAD_LEFT = 80;

  // Compute x-range (min/max JD over all items)
  const { jdMin, jdMax } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const line of lines) {
      for (const i of line.items) {
        if (i.jd < min) min = i.jd;
        if ((i.jdEnd ?? i.jd) > max) max = i.jdEnd ?? i.jd;
      }
    }
    if (!isFinite(min)) { min = 0; max = 1; }
    return { jdMin: min, jdMax: max };
  }, [lines]);

  const totalW = Math.max(2000, size.w - PAD_LEFT * 2); // base pixel width for time axis
  const totalH = lines.length * TRACK_H + PAD_TOP * 2;

  // Auto-fit
  const fittedKey = useRef('');
  useEffect(() => {
    if (!lines.length || !size.w) return;
    const key = `${lines.length}:${size.w}:${size.h}`;
    if (fittedKey.current === key) return;
    fittedKey.current = key;
    const scale = Math.min(1, size.h / totalH);
    setVp({ x: 40, y: 0, scale });
  }, [lines.length, size, totalH]);

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
        const ns = Math.max(0.05, Math.min(5, prev.scale * factor));
        const nx = mx - (mx - prev.x) * (ns / prev.scale);
        const ny = my - (my - prev.y) * (ns / prev.scale);
        return { x: nx, y: ny, scale: ns };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pan
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as SVGElement).closest('.station')) return;
    dragging.current = { sx: e.clientX, sy: e.clientY, ox: vpRef.current.x, oy: vpRef.current.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const d = dragging.current;
    setVp((prev) => ({ ...prev, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
  }, []);
  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  // JD → pixel x
  const jdToX = (jd: number) => PAD_LEFT + ((jd - jdMin) / (jdMax - jdMin || 1)) * totalW;

  // Empty state
  if (!lines.length) {
    return (
      <div ref={wrapRef} className="subway-view" style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
        <p style={{ opacity: 0.6, textAlign: 'center', maxWidth: 420 }}>
          Ingen poster med datoer at vise på spor.<br />
          Opret poster, tildel tags/forældre eller brug skabeloner for at se metro-kortet.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="subway-view"
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: dragging.current ? 'grabbing' : 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg width={size.w} height={size.h}>
        <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>
          {/* Spor (linjer) */}
          {lines.map((line, li) => {
            const y = PAD_TOP + li * TRACK_H;
            const stations = line.items;
            if (!stations.length) return null;
            const xStart = jdToX(stations[0].jd);
            const xEnd = jdToX(stations[stations.length - 1].jdEnd ?? stations[stations.length - 1].jd);

            return (
              <g key={li}>
                {/* Linje-strækning (tyk farvet linje) */}
                <line x1={xStart} y1={y} x2={xEnd} y2={y} stroke={line.color} strokeWidth={4} strokeLinecap="round" opacity={0.7} />

                {/* Spor-label (til venstre) */}
                <text x={4} y={y - 8} fill={line.color} fontSize={11} fontWeight={700}>{line.name}</text>

                {/* Stationer */}
                {stations.map((st, si) => {
                  const cx = jdToX(st.jd);
                  const isSel = st.item.id === selectedId;
                  return (
                    <g
                      key={si}
                      className="station"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); select(isSel ? null : st.item.id); }}
                    >
                      <circle cx={cx} cy={y} r={isSel ? 8 : 6} fill={line.color} stroke={isSel ? '#fff' : '#222'} strokeWidth={isSel ? 2 : 1} />
                      {/* Label oven/under (skift for at undgå overlap) */}
                      <text
                        x={cx}
                        y={y + (si % 2 === 0 ? -14 : 18)}
                        textAnchor="middle"
                        fill="#ccc"
                        fontSize={10}
                      >
                        {st.item.label.length > 14 ? st.item.label.slice(0, 13) + '…' : st.item.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* M7: Profeti→Opfyldelse tværspor-buer */}
          {(() => {
            const posMap = new Map<string, { x: number; y: number }>();
            lines.forEach((line, li) => {
              const y = PAD_TOP + li * TRACK_H;
              for (const st of line.items) posMap.set(st.item.id, { x: jdToX(st.jd), y });
            });
            return (doc.relations ?? []).filter((r) => r.typeId === 'rt-fulfillment').map((rel) => {
              const from = posMap.get(rel.fromId);
              const to = posMap.get(rel.toId);
              if (!from || !to) return null;
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2 - Math.abs(from.y - to.y) * 0.3 - 15;
              return (
                <g key={rel.id} opacity={0.7}>
                  <path d={`M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`} fill="none" stroke="#d4a017" strokeWidth={2} strokeDasharray="6 3" />
                  <text x={midX} y={midY + 4} textAnchor="middle" fontSize={10} fill="#d4a017">📜</text>
                </g>
              );
            });
          })()}

          {/* Tidakse-bund: vis årstal-mærker */}
          <g>
            {(() => {
              const ticks: Array<{ x: number; label: string }> = [];
              // vælg en passende årtierde (år 10, 50, 100, 500...)
              // konverter JD-range til ca. år-range
              const yearMin = Math.round(jdMinToYear(jdMin));
              const yearMax = Math.round(jdToYear(jdMax));
              const yearRange = yearMax - yearMin || 1;
              const step = yearRange > 2000 ? 500 : yearRange > 500 ? 100 : yearRange > 100 ? 20 : yearRange > 20 ? 5 : 1;
              const startYear = Math.floor(yearMin / step) * step;
              for (let yr = startYear; yr <= yearMax; yr += step) {
                const jd = yearToJD(yr);
                if (jd < jdMin || jd > jdMax) continue;
                ticks.push({ x: jdToX(jd), label: yr < 0 ? `${-yr} f.Kr.` : `${yr} e.Kr.` });
              }
              return ticks.map((t, i) => (
                <g key={i}>
                  <line x1={t.x} y1={PAD_TOP - 20} x2={t.x} y2={PAD_TOP + lines.length * TRACK_H} stroke="#333" strokeWidth={0.5} />
                  <text x={t.x} y={PAD_TOP - 25} textAnchor="middle" fill="#888" fontSize={9}>{t.label}</text>
                </g>
              ));
            })()}
          </g>
        </g>
      </svg>

      {/* Zoom-knapper */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 4 }}>
        <button className="ft-btn" onClick={() => setVp((v) => ({ ...v, scale: Math.min(5, v.scale * 1.3) }))}>+</button>
        <button className="ft-btn" onClick={() => setVp((v) => ({ ...v, scale: Math.max(0.05, v.scale / 1.3) }))}>−</button>
        <button className="ft-btn" onClick={() => setVp({ x: 40, y: 0, scale: 1 })}>⊡</button>
      </div>
    </div>
  );
}

// Hjælpefunktioner: JD ↔ årstal (tilpas nøjagtig til label-formål)
function jdToYear(jd: number): number {
  // Rough conversion: JD 1721424.5 ≈ 0 (1 Jan 1 CE astronomical year 1)
  return (jd - 1721424.5) / 365.25 + 1;
}
function jdMinToYear(jd: number): number {
  return jdToYear(jd);
}
function yearToJD(year: number): number {
  return (year - 1) * 365.25 + 1721424.5;
}
