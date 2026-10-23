// **** Inspektør (M3): detaljer, vers-links (jw.org), relationer, alder ****
import { useState } from 'react';
import { useApp } from '../store';
import { ageAt, formatSpan } from '../core/format';
import { toJD } from '../core/jdn';
import { formatVerse, jwUrl } from '../core/bible';
import { generations, linksOf, relationTypes } from '../core/relations';
import { BOOKS } from '../model/bibleBooks';
import type { VerseRef } from '../model/doc';

export function Inspector() {
  const doc = useApp((s) => s.doc);
  const id = useApp((s) => s.selectedId);
  const select = useApp((s) => s.select);
  const { updateItem, setVerseRefs, addRelation, removeRelation } = useApp();
  const item = doc.items.find((it) => it.id === id);
  if (!item) return null;

  const type = doc.itemTypes.find((t) => t.id === item.typeId);
  const span = item.span;
  const links = linksOf(doc, item.id);
  const labelOf = (itemId: string) => doc.items.find((it) => it.id === itemId)?.label ?? '(slettet)';

  return (
    <aside className="inspector">
      <div className="insp-head">
        <span className="dot" style={{ background: item.color ?? type?.color ?? '#888' }} />
        <input value={item.label} onChange={(e) => updateItem(item.id, { label: e.target.value })} />
        <button title="Luk inspektør" onClick={() => select(null)}>✕</button>
      </div>

      <p className="insp-range">
        {formatSpan(span, item.dateStyle, undefined)}
        {type?.name === 'Person' && span.start && span.end && (
          <span className="age"> · alder: {ageAt(span.start, toJD(span.end))}</span>
        )}
      </p>
      <p className="insp-type">{type?.name}</p>

      <textarea
        className="notes"
        placeholder="Noter…"
        value={item.notes ?? ''}
        onChange={(e) => updateItem(item.id, { notes: e.target.value || undefined })}
      />

      <section>
        <h4>Bibelvers (jw.org)</h4>
        {(item.verseRefs ?? []).map((v, i) => (
          <div className="verse" key={i}>
            <a href={jwUrl(v)} target="_blank" rel="noreferrer">{formatVerse(v)} ↗</a>
            <button className="danger" title="Fjern vers" onClick={() => setVerseRefs(item.id, (item.verseRefs ?? []).filter((_, j) => j !== i))}>✕</button>
            {v.quote && <blockquote>”{v.quote}”</blockquote>}
          </div>
        ))}
        <AddVerse onAdd={(v) => setVerseRefs(item.id, [...(item.verseRefs ?? []), v])} />
      </section>

      <section>
        <h4>Relationer</h4>
        {links.length === 0 && <p className="dim">Ingen relationer endnu.</p>}
        {links.map((l) => {
          const gen = l.type.id === 'rt-parent'
            ? (doc.relations && generations(doc, item.id, l.otherId) >= 0 ? ` (${generations(doc, item.id, l.otherId)} led ned)` : '')
            : '';
          return (
            <div className="link" key={l.rel.id}>
              <span><b>{l.label}</b> → <a onClick={() => select(l.otherId)}>{labelOf(l.otherId)}</a>{gen}{l.rel.note ? ` · ${l.rel.note}` : ''}</span>
              <button className="danger" title="Fjern relation" onClick={() => removeRelation(l.rel.id)}>✕</button>
            </div>
          );
        })}
        <AddRelation onAdd={(typeId, toId) => addRelation(item.id, toId, typeId)} exclude={item.id} />
      </section>
    </aside>
  );
}

function AddVerse({ onAdd }: { onAdd: (v: VerseRef) => void }) {
  const [book, setBook] = useState(BOOKS[0].slug);
  const [ch, setCh] = useState(1);
  const [vs, setVs] = useState('');
  const [vsEnd, setVsEnd] = useState('');
  return (
    <div className="addrow">
      <select value={book} onChange={(e) => setBook(e.target.value)}>
        {BOOKS.map((b) => (
          <option key={b.slug} value={b.slug}>{b.name}</option>
        ))}
      </select>
      <input type="number" min={1} value={ch} onChange={(e) => setCh(+e.target.value || 1)} title="Kapitel" style={{ width: 52 }} />
      <input value={vs} placeholder="v" onChange={(e) => setVs(e.target.value)} style={{ width: 40 }} title="Vers" />
      <input value={vsEnd} placeholder="–v" onChange={(e) => setVsEnd(e.target.value)} style={{ width: 40 }} title="Vers til" />
      <button onClick={() => {
        onAdd({ bookSlug: book, ch, vs: +vs || undefined, vsEnd: +vsEnd || undefined });
        setVs(''); setVsEnd('');
      }}>+</button>
    </div>
  );
}

function AddRelation({ onAdd, exclude }: { onAdd: (typeId: string, toId: string) => void; exclude: string }) {
  const doc = useApp((s) => s.doc);
  const [typeId, setTypeId] = useState(relationTypes(doc)[0]?.id ?? '');
  const [toId, setToId] = useState('');
  const others = doc.items.filter((it) => it.id !== exclude);
  return (
    <div className="addrow">
      <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
        {relationTypes(doc).map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select value={toId} onChange={(e) => setToId(e.target.value)}>
        <option value="">→ vælg post…</option>
        {others.map((it) => (
          <option key={it.id} value={it.id}>{it.label}</option>
        ))}
      </select>
      <button onClick={() => { if (toId) { onAdd(typeId, toId); setToId(''); } }}>+</button>
    </div>
  );
}
