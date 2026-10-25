// **** Pan-matematik (trail) ****
// Vigtig invariant: React korer en state-opdatering (setVp(fn)) LDERE end h ndelsen.
// En pointerup kan derfor have nulstillet drag-ref'en, mens opdateringen venter —
// af den grund må opdateringen aldrig læse i en ref; den skal have en værdi-kopi.
// Tal-forsvar: uggyldig px/NaN må aldrig smide eller producere et uggyldigt viewport.

export interface CenterViewport { center: number; px: number }
export interface CenterDrag { x: number; center: number }
export interface PointViewport { x: number; y: number }
export interface PointDrag { startX: number; startY: number; origX: number; origY: number }

/** Vandret pan: flyt center så punktet under markøren følger med. */
export function panCenter<T extends CenterViewport>(v: T, drag: CenterDrag | null, clientX: number): T {
  if (!drag || !Number.isFinite(v.px) || v.px <= 0 || !Number.isFinite(clientX)) return v;
  const center = drag.center - (clientX - drag.x) / v.px;
  if (!Number.isFinite(center)) return v;
  return { ...v, center };
}

/** Fri 2D-pan (fx slægtstræ). */
export function panPoint<T extends PointViewport>(v: T, drag: PointDrag | null, clientX: number, clientY: number): T {
  if (!drag || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return v;
  const x = drag.origX + (clientX - drag.startX);
  const y = drag.origY + (clientY - drag.startY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return v;
  return { ...v, x, y };
}
