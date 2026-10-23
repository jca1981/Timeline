// **** Timeline-view (M2): vandret zoombar tidslinje — årtusinder ↔ timer ****
// Zoom: musehjul (eller +/−), pan: træk. Usikker = gradient-halo, fortsat = pil.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { formatSpan, formatUncertainty } from '../core/format';
import { clampPx, contentBounds, pickStep, spanBounds, stepLabel, ticksFor } from '../core/scale';
import type { Item } from '../model/doc';

interface Viewport {
  center: number; // JD i midten
  px: number; // pixels pr. dag
}

const ROW_H = 30;

export function TimelineView() {
  const doc = useApp((s) => s.doc);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [vp, setVp] = useState<Viewport>({ center: 1730000, px: 1 / 40 }); // overskrives af fit()
  const vpRef = useRef(vp);
  vpRef.current = vp;

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

  const left = vp.center - width / 2 / vp.px;
  const right = vp.center + width / 2 / vp.px;
  const x = useCallback((jd: number) => (jd - left) * vp.px, [left, vp.px]);

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
      if ((e.target as HTMLElement).closest('.bar')) return; // klik på bjælke = ikke pan
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

  // rækker: sortér kronologisk, cull til viewporten
  const rows = useMemo(() => {
    const list = [...doc.items]
      .map((it) => ({ it, bd: spanBounds(it.span) }))
      .filter((r): r is { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>> } => !!r.bd)
      .sort((a, b) => a.bd.a - b.bd.a || a.it.label.localeCompare(b.it.label));
    return list.map((r, i) => ({ ...r, y: i * ROW_H }));
  }, [doc.items]);

  const visible = rows.filter((r) => x(r.bd.b) > -200 && x(r.bd.a) < width + 200);
  const hidden = rows.length - visible.length;

  const zoom = (factor: number) =>
    setVp((v) => ({ ...v, px: clampPx(v.px * factor) }));

  return (
    <div>
      <div className="toolbar">
        <button onClick={() => zoom(1.6)} title="Zoom ind">＋</button>
        <button onClick={() => zoom(1 / 1.6)} title="Zoom ud">－</button>
        <button onClick={fit}>Tilpas efter indhold</button>
        <span className="count">
          Zoom: 1 streg ≈ {stepLabel(step)} · {doc.items.length} poster{hidden > 0 ? ` (${hidden} uden for view)` : ''}
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
            const tip = `${it.label} — ${formatSpan(it.span)}${formatUncertainty(it.span) ? ` (${formatUncertainty(it.span)})` : ''}`;
            return (
              <div key={it.id} className={`bar ${w > 140 ? 'wide' : ''} ${selectedId === it.id ? 'selected' : ''}`} title={tip} onClick={() => select(it.id)} style={{ left: xa, top: y + 5, width: w, background: color }}>
                {bd.ua !== undefined && bd.ua > bd.a && (
                  <span
                    className="halo"
                    style={{ left: x(bd.a) - xa, width: x(bd.ua) - x(bd.a), background: `linear-gradient(90deg, ${color}55, ${color}22)` }}
                  />
                )}
                {bd.ub !== undefined && bd.ub < bd.b && (
                  <span
                    className="halo"
                    style={{ left: x(bd.ub) - xa, width: x(bd.b) - x(bd.ub), background: `linear-gradient(90deg, ${color}22, ${color}55)` }}
                  />
                )}
                {it.span.ongoing && <span className="arrow" style={{ borderColor: color }} />}
                <span className="barlabel" style={{ color: w > 140 ? '#fff' : color }}>
                  {w > 26 ? it.label : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="hint">Træk for at panore · hjul for at zoome (årtusinder ↔ timer) · hold mus over en bjælke for detaljer</p>
    </div>
  );
}
