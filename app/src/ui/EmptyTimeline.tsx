// **** Tom-tilstand i tidslinjen (M31): startpanelet viser aksen med rigtigt indhold i ****
import { useMemo } from 'react';
import { useApp } from '../store';
import { demoDoc, type Item, type ItemType } from '../model/doc';
import { spanBounds } from '../core/scale';
import { formatSpan, displayYear } from '../core/format';
import { fromJD } from '../core/jdn';
import { TEMPLATES } from '../model/templates';

const PREVIEW_ROWS = 13;

type PreviewRow = { id: string; label: string; color: string; when: string; left: number; width: number };
type Preview = { title: string; count: number; from: string; to: string; types: (ItemType & { n: number })[]; rows: PreviewRow[] };

/** Skabelonen tegnes med samme bjælke-geometri som den rigtige tidslinje. */
function usePreview(): Preview {
  return useMemo(() => {
    const tpl = TEMPLATES[0];
    const doc = tpl.build();
    const color = new Map(doc.itemTypes.map((t) => [t.id, t.color]));
    const dated = doc.items
      .map((it) => ({ it, b: spanBounds(it.span) }))
      .filter((r): r is { it: Item; b: NonNullable<ReturnType<typeof spanBounds>> } => !!r.b)
      .sort((a, b) => a.b.a - b.b.a);
    const min = dated[0]?.b.a ?? 0;
    const max = dated.reduce((m, r) => Math.max(m, r.b.b), min);
    const span = Math.max(max - min, 1);
    const n = new Map<string, number>();
    for (const it of doc.items) n.set(it.typeId, (n.get(it.typeId) ?? 0) + 1);
    return {
      title: tpl.name,
      count: doc.items.length,
      from: displayYear(fromJD(min, 'year').y),
      to: displayYear(fromJD(max, 'year').y),
      types: doc.itemTypes.filter((t) => (n.get(t.id) ?? 0) > 0).map((t) => ({ ...t, n: n.get(t.id) ?? 0 })),
      rows: dated.slice(0, PREVIEW_ROWS).map(({ it, b }) => ({
        id: it.id,
        label: it.label,
        color: color.get(it.typeId) ?? 'var(--dim)',
        when: formatSpan(it.span),
        left: ((b.a - min) / span) * 100,
        width: Math.max(((b.b - b.a) / span) * 100, 0.35),
      })),
    };
  }, []);
}

function load(doc: ReturnType<typeof demoDoc>) {
  // importDoc ( ikke bare setState): persister og saetter hydrate-guard, ellers kan
  // IndexedDB-hydrate paa en frisk profil overskrive handlingen faa millisekunder efter klik
  useApp.getState().importDoc(doc);
}

/** Dokument uden poster: handlinger + aksen med skabelonens egne bjælker. */
export function EmptyTimeline() {
  const p = usePreview();

  return (
    <div className="tl-empty">
      <div className="empty-start">
        <h2>Tom tidslinje</h2>
        <p className="empty-note">År, perioder, personer og riger på samme vandrette akse — med vers, kilder og usikre datoer.</p>
        <div className="empty-actions">
          <button className="primary" onClick={() => load(demoDoc())}>Indlæs bibel-demo</button>
          {TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => load(t.build())}>{t.name}</button>
          ))}
        </div>
      </div>

      <div className="empty-legend" data-ui>
        <h3>Farver i {p.title}</h3>
        {p.types.map((t) => (
          <div className="lg-row" key={t.id}>
            <i style={{ background: t.color }} />
            <span>{t.name}</span>
            <b>{t.n}</b>
          </div>
        ))}
      </div>

      <div className="empty-preview" data-ui>
        <div className="ep-head">
          <h3>Forhåndsvisning</h3>
          <span>{p.rows.length} af {p.count} poster</span>
        </div>
        <div className="ep-scale">
          <span>{p.from}</span>
          <span>{p.to}</span>
        </div>
        <div className="ep-rows">
          {p.rows.map((r) => (
            <div className="ep-row" key={r.id}>
              <span className="ep-label" title={r.label}>{r.label}</span>
              <span className="ep-track">
                <i style={{ left: `${r.left}%`, width: `${Math.max(r.width, 0.6)}%`, background: r.color }} />
              </span>
              <span className="ep-when">{r.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Poster findes, men filtrene skjuler dem alle. */
export function FilteredOutTimeline() {
  const setFilter = useApp((s) => s.setFilter);
  return (
    <div className="tl-empty slim">
      <p className="empty-note">Ingen poster matcher filtrene.</p>
      <div className="empty-actions">
        <button onClick={() => setFilter(null)}>Ryd filtre</button>
      </div>
    </div>
  );
}
