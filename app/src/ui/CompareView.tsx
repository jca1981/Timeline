// **** Sammenligningsvisning (M15): to tidslinjer side om side med uafhængige filtre ****
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { applyFilter } from '../core/filters';
import { spanBounds, clampPx, ticksFor } from '../core/scale';
import { panCenter } from '../core/pan';
import { textColorFor, readableOn } from '../core/color';
import type { Filter, Item } from '../model/doc';

export function CompareView() {
  const doc = useApp((s) => s.doc);
  const [filterL, setFilterL] = useState<Filter>({ match: 'all' });
  const [filterR, setFilterR] = useState<Filter>({ match: 'all' });

  return (
    <div className="compare-layout">
      <div className="compare-pane">
        <div className="compare-header">
          <label>Venstre: </label>
          <select value={filterL.types?.[0] ?? ''} onChange={(e) => setFilterL({ ...filterL, types: e.target.value ? [e.target.value] : undefined })}>
            <option value="">Alle typer</option>
            {doc.itemTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <MiniTimeline filter={filterL} />
      </div>
      <div className="compare-pane">
        <div className="compare-header">
          <label>Højre: </label>
          <select value={filterR.types?.[0] ?? ''} onChange={(e) => setFilterR({ ...filterR, types: e.target.value ? [e.target.value] : undefined })}>
            <option value="">Alle typer</option>
            {doc.itemTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <MiniTimeline filter={filterR} />
      </div>
    </div>
  );
}

function MiniTimeline({ filter }: { filter: Filter }) {
  const doc = useApp((s) => s.doc);
  const [vp, setVp] = useState({ center: 1730000, px: 1 / 40 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const items = useMemo(() => {
    return applyFilter(doc.items, filter)
      .map((it) => ({ it, bd: spanBounds(it.span) }))
      .filter((r): r is { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>> } => !!r.bd)
      .sort((a, b) => a.bd.a - b.bd.a);
  }, [doc.items, filter]);

  const left = vp.center - width / 2 / vp.px;
  const right = vp.center + width / 2 / vp.px;
  const x = (jd: number) => (jd - left) * vp.px;
  const ticks = useMemo(() => ticksFor(left, right, vp.px), [left, right, vp.px]);

  // Wheel zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setVp((v) => ({ ...v, px: clampPx(v.px * (e.deltaY < 0 ? 1.15 : 1 / 1.15)) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pan
  const dragRef = useRef<{ x: number; center: number } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => { dragRef.current = { x: e.clientX, center: vp.center }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      const d = dragRef.current; // v rdi-kopi: ref kan nulstilles for opdateringen k rer
      if (!d) return;
      setVp((v) => panCenter(v, d, e.clientX));
    };
    const up = () => (dragRef.current = null);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
  }, [vp.center]);

  const ROW_H = 18;
  const H = Math.max(items.length * ROW_H + 20, 100);
  const visible = items.filter(({ bd }) => { const xa = x(bd.a); return x(bd.b) > -200 && xa < width + 200; });

  return (
    <div ref={wrapRef} className="mini-timeline" style={{ overflow: 'hidden' }}>
      <svg width={width} height={H}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={x(t.jd)} y1={0} x2={x(t.jd)} y2={H} stroke="#333" strokeWidth={0.5} />
            {t.label && <text x={x(t.jd) + 2} y={10} fontSize={9} fill={readableOn('#777')}>{t.label}</text>}
          </g>
        ))}
        {visible.map(({ it, bd }, i) => {
          const type = doc.itemTypes.find((t) => t.id === it.typeId);
          const color = it.color ?? type?.color ?? '#888';
          const xa = x(bd.a);
          const w = Math.max(2, x(bd.b) - xa);
          return (
            <g key={it.id}>
              <rect x={xa} y={i * ROW_H + 14} width={w} height={ROW_H - 4} rx={2} fill={color} opacity={0.85} />
              {w > 80 && <text x={xa + 3} y={i * ROW_H + 25} fontSize={9} fill={textColorFor(color).color} style={{ textShadow: textColorFor(color).shadow }}>{it.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
