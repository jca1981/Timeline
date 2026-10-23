// **** Spreadsheet-view (M1): lynhurtig entry, dato-felter med sync, farver, slet/dupliér ****
import { useMemo } from 'react';
import { useApp } from '../store';
import { formatSpan } from '../core/format';
import type { Item } from '../model/doc';
import { DateValueEditor, DurationEditor } from './DateFields';
import { demoDoc } from '../model/doc';

export function SpreadsheetView() {
  const doc = useApp((s) => s.doc);
  const errors = useApp((s) => s.errors);
  const { addItem, clearAll } = useApp();

  const rows = useMemo(
    () => [...doc.items].sort((a, b) => (a.span.start?.y ?? 9999) - (b.span.start?.y ?? 9999)),
    [doc.items],
  );

  return (
    <div>
      <div className="toolbar">
        <button className="primary" onClick={() => addItem()}>+ Tilføj post</button>
        <button onClick={() => useApp.setState({ doc: demoDoc(), selectedId: null })}>Indlæs bibel-demo</button>
        <button className="danger" onClick={clearAll}>Ryd alt</button>
        <span className="count">{doc.items.length} poster · gemmes lokalt i browseren</span>
      </div>
      <table className="sheet">
        <thead>
          <tr>
            <th></th>
            <th>Etiket</th>
            <th>Type</th>
            <th>Start</th>
            <th>Varighed</th>
            <th>Tidsramme (auto)</th>
            <th>Usikker</th>
            <th>Fortsat</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <Row key={it.id} item={it} error={errors[it.id]} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="empty">Ingen poster endnu — tryk “+ Tilføj post” eller “Indlæs bibel-demo”.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ item, error }: { item: Item; error?: string }) {
  const doc = useApp((s) => s.doc);
  const { updateItem, setSpan, removeItem, duplicateItem } = useApp();
  const selected = useApp((s) => s.selectedId) === item.id;
  const select = useApp((s) => s.select);
  const type = doc.itemTypes.find((t) => t.id === item.typeId) ?? doc.itemTypes[0];
  const span = item.span;

  return (
    <tr className={`${error ? 'err' : ''} ${selected ? 'sel' : ''}`} onClick={() => select(item.id)}>
      <td>
        <span
          className="dot"
          style={{ background: item.color ?? type?.color ?? '#888' }}
          title={error ?? type?.name}
        />
      </td>
      <td>
        <input className="label" value={item.label} onChange={(e) => updateItem(item.id, { label: e.target.value })} />
        {item.verseRefs?.length ? <span className="versebadge" title={`${item.verseRefs.length} vers-link(s)`}>📖{item.verseRefs.length}</span> : null}
      </td>
      <td>
        <select value={item.typeId} onChange={(e) => updateItem(item.id, { typeId: e.target.value })}>
          {doc.itemTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </td>
      <td>
        <DateValueEditor value={span.start} onChange={(v) => setSpan(item.id, { ...span, start: v, ongoing: false })} />
      </td>
      <td>
        <DurationEditor
          value={span.duration}
          disabled={span.ongoing}
          onChange={(v) => setSpan(item.id, { ...span, duration: v, ongoing: false })}
        />
      </td>
      <td className="range" title={error}>
        {formatSpan(span)}
        {span.uncertain && <span className="tilde"> ~</span>}
      </td>
      <td>
        <input type="checkbox" checked={!!span.uncertain} onChange={(e) => setSpan(item.id, { ...span, uncertain: e.target.checked ? (span.uncertain ?? {}) : undefined })} />
      </td>
      <td>
        <input type="checkbox" checked={!!span.ongoing} onChange={(e) => setSpan(item.id, { ...span, ongoing: e.target.checked })} />
      </td>
      <td className="rowbtns">
        <button onClick={(e) => { e.stopPropagation(); duplicateItem(item.id); }} title="Dupliér">⧉</button>
        <button className="danger" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} title="Slet">✕</button>
      </td>
    </tr>
  );
}
