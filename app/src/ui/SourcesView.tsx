// **** Kilder-visning (M28): kilde-bibliotek på tværs af dokumentet ****
import { useState } from 'react';
import { useApp } from '../store';
import { citationsBySource, citeLabel, safeUrl } from '../core/sources';

/**
 * Alt om en kilde ét sted: hvad den hedder, lokator, URL, hvor mange poster der
 * citerer den, og hvilke. Find ubrugte kilder (troværdighed ikke vurderet) og
 * kilder med mange citater (værd at slå op først).
 */
export function SourcesView() {
  const doc = useApp((s) => s.doc);
  const { addSource, updateSource, removeSource, select } = useApp();
  const [title, setTitle] = useState('');
  const [locator, setLocator] = useState('');
  const [url, setUrl] = useState('');

  const sources = doc.sources ?? [];
  const cites = citationsBySource(doc);
  const rows = [...sources].sort((a, b) => {
    const n = (cites.get(b.id)?.length ?? 0) - (cites.get(a.id)?.length ?? 0);
    return n !== 0 ? n : citeLabel(a).localeCompare(citeLabel(b), 'da');
  });
  const uncited = rows.filter((s) => (cites.get(s.id)?.length ?? 0) === 0).length;

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
        <span className="count">{sources.length} kilder · {uncited} uden citater</span>
      </div>

      {rows.length === 0 && <p className="dim">Endnu ingen kilder. Knyt en kilde til en post i inspektøren, eller tilføj den her — så kan troværdighed vurderes én gang og genbruges på alle poster.</p>}

      {rows.length > 0 && (
        <table className="sheet">
          <thead>
            <tr>
              <th>Kilde</th>
              <th>Lokator</th>
              <th>URL</th>
              <th title="Poster der citerer kilden">Citater</th>
              <th>Citerende poster</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const items = cites.get(s.id) ?? [];
              const href = safeUrl(s.url);
              return (
                <tr key={s.id} className={items.length === 0 ? 'uncited' : ''}>
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
