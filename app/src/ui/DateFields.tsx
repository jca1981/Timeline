// **** Præcisions-bevidste dato-input: år/måned/dag valgfri + f.Kr./e.Kr.-knap (bibel-venlig) ****
import type { DateValue, Duration } from '../core/types';
import { displayYear } from '../core/format';

function splitAstr(y: number): { shown: number; bc: boolean } {
  return y < 1 ? { shown: 1 - y, bc: true } : { shown: y, bc: false };
}
function joinAstr(shown: number, bc: boolean): number {
  return bc ? 1 - shown : shown;
}

export function DateValueEditor({ value, onChange }: { value?: DateValue; onChange: (v: DateValue | undefined) => void }) {
  const shown = value ? splitAstr(value.y) : null;
  const bc = value ? value.y < 1 : false;
  const mo = value?.mo;
  const d = value?.d;

  const emit = (astrY: number, moV?: number, dV?: number) => {
    onChange(
      dV && moV
        ? { y: astrY, mo: moV, d: dV, precision: 'day' }
        : moV
          ? { y: astrY, mo: moV, precision: 'month' }
          : { y: astrY, precision: 'year' },
    );
  };

  // hjælp: hvis måned/dag tastes før år, antag indeværende år
  const fallbackY = () => (value ? value.y : new Date().getFullYear());

  return (
    <span className="dedit">
      <input
        type="number"
        min={1}
        placeholder="år"
        value={shown ? shown.shown : ''}
        onChange={(e) => {
          if (e.target.value === '') return onChange(undefined);
          emit(joinAstr(Math.max(1, Math.abs(Math.trunc(Number(e.target.value)))), bc), mo, d);
        }}
        title="Årstal (positivt tal; f.Kr. via knappen)"
      />
      <input
        type="number"
        min={1}
        max={12}
        placeholder="md"
        value={mo ?? ''}
        onChange={(e) => emit(fallbackY(), e.target.value ? Number(e.target.value) : undefined, d)}
      />
      <input
        type="number"
        min={1}
        max={31}
        placeholder="dg"
        value={d ?? ''}
        onChange={(e) => emit(fallbackY(), mo, e.target.value ? Number(e.target.value) : undefined)}
      />
      <button
        className={`bcbtn ${bc ? 'on' : ''}`}
        onClick={() => {
          const y = value ? value.y : joinAstr(new Date().getFullYear(), true);
          const cur = splitAstr(y);
          emit(joinAstr(cur.shown, !cur.bc), mo, d);
        }}
        title="Skift mellem f.Kr. og e.Kr."
      >
        f.Kr.
      </button>
    </span>
  );
}

export function DurationEditor({ value, onChange, disabled }: { value?: Duration; onChange: (v: Duration | undefined) => void; disabled?: boolean }) {
  const set = (k: 'y' | 'mo' | 'd', n: number | undefined) => {
    const next = { ...value };
    if (n) next[k] = n;
    else delete next[k];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <span className="dedit">
      <input type="number" min={0} placeholder="år" disabled={disabled} value={value?.y ?? ''} onChange={(e) => set('y', e.target.value ? Number(e.target.value) : undefined)} />
      <input type="number" min={0} max={11} placeholder="md" disabled={disabled} value={value?.mo ?? ''} onChange={(e) => set('mo', e.target.value ? Number(e.target.value) : undefined)} />
      <input type="number" min={0} max={3650} placeholder="dg" disabled={disabled} value={value?.d ?? ''} onChange={(e) => set('d', e.target.value ? Number(e.target.value) : undefined)} />
    </span>
  );
}

export { displayYear };
