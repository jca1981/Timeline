// **** Kilder-visning (M28/M29): kilde-bibliotek med type, troværdighed og link-tjek ****
import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { citationsBySource, citeLabel, isStaleLink, RELIABILITY, reliabilityLabel, reliabilityStars, safeUrl, sortSources, SOURCE_KINDS } from '../core/sources';
import type { SourceKind } from '../model/doc';

/** I dag som YYYY-MM-DD (bruges til "tjekket nu" — ISO så sorteringen virker). */
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Alt om en kilde ét sted: titel, lokator, URL, kildetype, troværdighed, hvornår
 * linket er tjekket, og hvilke poster der citerer den. Find ubrugte kilder og
 * links der bør genbesøges (døde links er den almindelige årsag til at en
 * tidslinje langsomt bliver ubrugelig).
 */
export function SourcesView() {
  const doc = useApp((s) => s.doc);
  const { addSource, updateSource, removeSource, select } = useApp();
  const [title, setTitle] = useState('');
  const [locator, setLocator] = useState('');
  const [url, setUrl] = useState('');
  const [onlyStale, setOnlyStale] = useState(false);

  const sources = doc.sources ?? [];
  const cites = useMemo(() => citationsBySource(doc), [doc]);
  const rowsAll = sortSources(sources, cites);
  const stale = rowsAll.filter((s) => isStaleLink(s));
  const rows = onlyStale ? stale : rowsAll;
  const uncited = rowsAll.filter((s) => (cites.get(s.id)?.length ?? 0) === 0).length;
  const unrated = rowsAll.filter((s) => !s.reliability).length;

  const add = () => {
    if (!title.trim()) return;
    addSource({ title: title.trim(), locator: locator.trim() || undefined, url: url.trim() || undefined });
    setTitle(''); setLocator(''); setUrl('');
  };

  return (
    <div className="sources">
      <div className="toolbar">
        <input value={title} placeholder="Ny kilde — titel…" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input value={locator} placeholder="s. 214 / kap. 3" style={{ width: 120 }} onChange={(e) => setLocator(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input value={url} placeholder="https://…" style={{ width: 200 }} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="primary" disabled={!title.trim()} onClick={add}>+ tilføj kilde</button>
        <button
          className={onlyStale ? 'primary' : ''}
          title="Kun kilder med link, der ikke er tjekket i mere end et år"
          onClick={() => setOnlyStale((v) => !v)}
        >{stale.length ? `skal genbesøges: ${stale.length}` : 'alle links friske'}</button>
        <span className="count">{sources.length} kilder · {uncited} uden citater · {unrated} ikke vurderet</span>
      </div>

      {rowsAll.length === 0 && <p className="dim">Endnu ingen kilder. Knyt en kilde til en post i inspektøren, eller tilføj den her — så kan troværdighed vurderes én gang og genbruges på alle poster.</p>}
      {rowsAll.length > 0 && rows.length === 0 && <p className="dim">Alle kilder med link er tjekket for nylig. (Vis alle igen med knappen ovenfor.)</p>}

      {rows.length > 0 && (
        <table className="sheet">
          <thead>
            <tr>
              <th>Kilde</th>
              <th>Lokator</th>
              <th>URL</th>
              <th title="Hvor direkte er kilden? egne øjenvidner → referater">Type</th>
              <th title="Troværdighed 1-5 — bruges til sortering og i eksport">Troværdighed</th>
              <th title="Sidst tjekket (dødt link?)">Tjekket</th>
              <th title="Poster der citerer kilden">Citater</th>
              <th>Citerende poster</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const items = cites.get(s.id) ?? [];
              const href = safeUrl(s.url);
              const staleRow = isStaleLink(s);
              return (
                <tr key={s.id} className={`${items.length === 0 ? 'uncited' : ''}${staleRow ? ' stale' : ''}`}>
                  <td>
                    <input className="cell" value={s.title} title="Titel" onChange={(e) => updateSource(s.id, { title: e.target.value })} />
                    {s.notes && <div className="dim src-notes" title={s.notes}>{s.notes}</div>}
                  </td>
                  <td><input className="cell narrow" value={s.locator ?? ''} placeholder="—" onChange={(e) => updateSource(s.id, { locator: e.target.value || undefined })} /></td>
                  <td>
                    {href
                      ? <a href={href} target="_blank" rel="noreferrer" title={href}>Åbn ↗</a>
                      : s.url ? <span className="warn" title="Kun http/https kan linkes">{s.url}</span> : <input className="cell" placeholder="https://…" onChange={(e) => updateSource(s.id, { url: e.target.value || undefined })} />}
                  </td>
                  <td>
                    <select
                      className="cell pick"
                      value={s.kind ?? ''}
                      title="Kildetype"
                      onChange={(e) => updateSource(s.id, { kind: (e.target.value || undefined) as SourceKind | undefined })}
                    >
                      <option value="">—</option>
                      {SOURCE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      className="cell pick"
                      value={s.reliability ?? ''}
                      title={`Troværdighed: ${reliabilityLabel(s.reliability)}`}
                      onChange={(e) => updateSource(s.id, { reliability: e.target.value ? Number(e.target.value) : undefined })}
                    >
                      <option value="">ikke vurderet</option>
                      {RELIABILITY.map((r) => <option key={r.v} value={r.v}>{reliabilityStars(r.v)} {r.label}</option>)}
                    </select>
                  </td>
                  <td>
                    {href ? (
                      <span className="chk">
                        <input
                          type="date"
                          className="cell date"
                          value={s.checkedAt ?? ''}
                          title="Sidst tjekket"
                          onChange={(e) => updateSource(s.id, { checkedAt: e.target.value || undefined })}
                        />
                        <button
                          className={staleRow ? 'warn' : 'quiet'}
                          title={staleRow ? 'Linket bør genbesøges — markér det som tjekket i dag' : 'Markér tjekket i dag'}
                          onClick={() => updateSource(s.id, { checkedAt: todayIso() })}
                        >nu</button>
                      </span>
                    ) : <span className="dim">intet link</span>}
                  </td>
                  <td className={items.length ? 'cite-count' : 'dim'}>{items.length}</td>
                  <td className="src-items">
                    {items.slice(0, 12).map((it) => <a key={it.id} onClick={() => select(it.id)}>{it.label}</a>)}
                    {items.length > 12 && <span className="dim"> +{items.length - 12} flere</span>}
                  </td>
                  <td>
                    <button
                      className="danger"
                      title={items.length ? `Slet kilde og fjern ${items.length} citat(er)` : 'Slet kilde'}
                      onClick={() => { if (items.length === 0 || confirm(`Slet "${citeLabel(s)}" og ${items.length} citat(er)?`)) removeSource(s.id); }}
                    >✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
