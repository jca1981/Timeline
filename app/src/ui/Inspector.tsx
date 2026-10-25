// **** Inspektør (M3+M4): detaljer, vers-links (jw.org), relationer, deps, alder, billeder ****
import { useState } from 'react';
import { useApp } from '../store';
import { ageAt, formatSpan } from '../core/format';
import { toJD } from '../core/jdn';
import { formatVerse, jwUrl } from '../core/bible';
import { generations, linksOf, relationTypes } from '../core/relations';
import { DEP_KIND_LABELS, DEP_KIND_SHORT, dependenciesOf, isDependencyViolated } from '../core/dependencies';
import { citeLabel, safeUrl, sourcesOf } from '../core/sources';
import { ItemImage } from './ItemImage';
import { putImage } from '../core/images';
import { BOOKS } from '../model/bibleBooks';
import type { DepKind, VerseRef } from '../model/doc';

export function Inspector() {
  const doc = useApp((s) => s.doc);
  const id = useApp((s) => s.selectedId);
  const select = useApp((s) => s.select);
  const { updateItem, setVerseRefs, addRelation, removeRelation, addDependency, removeDependency, addSource, toggleSource, setSourceIds } = useApp();
  const item = doc.items.find((it) => it.id === id);
  if (!item) return null;

  const type = doc.itemTypes.find((t) => t.id === item.typeId);
  const span = item.span;
  const links = linksOf(doc, item.id);
  const deps = dependenciesOf(doc, item.id);
  const srcs = sourcesOf(doc, item);
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
        <h4>Tags</h4>
        <TagsEditor tags={item.tags ?? []} onChange={(tags) => updateItem(item.id, { tags: tags.length ? tags : undefined })} />
      </section>

      <section>
        <h4>Billede</h4>
        {item.imageId && <ItemImage imageId={item.imageId} size={200} />}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <label className="btn small">
            {item.imageId ? 'Erstat' : 'Tilføj billede'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const id = `img-${Date.now()}`;
              const buf = await file.arrayBuffer();
              await putImage(id, { blob: buf, mimeType: file.type, filename: file.name });
              updateItem(item.id, { imageId: id });
            }} />
          </label>
          {item.imageId && <button onClick={() => updateItem(item.id, { imageId: undefined })}>Fjern</button>}
        </div>
      </section>

      <section>
        <h4>Overordnet (forælder)</h4>
        <select value={item.parentId ?? ''} onChange={(e) => updateItem(item.id, { parentId: e.target.value || undefined })}>
          <option value="">— ingen —</option>
          {doc.items.filter((it) => it.id !== item.id).map((it) => (
            <option key={it.id} value={it.id}>{it.label}</option>
          ))}
        </select>
      </section>

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
        <h4>Kilder {srcs.length > 0 && <span className="dim">({srcs.length})</span>}</h4>
        {srcs.length === 0 && <p className="dim">Ingen kilde er knyttet til denne post.</p>}
        {srcs.map((s) => {
          const href = safeUrl(s.url);
          return (
            <div className="verse" key={s.id}>
              {href ? <a href={href} target="_blank" rel="noreferrer">{citeLabel(s)} ↗</a> : <span>{citeLabel(s)}</span>}
              <button className="danger" title="Fjern kilde fra post" onClick={() => setSourceIds(item.id, (item.sourceIds ?? []).filter((x) => x !== s.id))}>✕</button>
              {s.notes && <blockquote>{s.notes}</blockquote>}
            </div>
          );
        })}
        <AddSource
          library={doc.sources ?? []}
          attached={new Set(item.sourceIds ?? [])}
          onAttach={(sid) => toggleSource(item.id, sid)}
          onCreate={(cand) => {
            const sid = addSource(cand);
            if (sid) toggleSource(item.id, sid);
          }}
        />
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

      <section>
        <h4>Afhængigheder</h4>
        {deps.length === 0 && <p className="dim">Ingen afhængigheder.</p>}
        {deps.map((d) => {
          const violated = isDependencyViolated(d, doc);
          const otherId = d.role === 'blocker' ? d.blockedId : d.blockerId;
          const dirLabel = d.role === 'blocker' ? `→ blokerer (${DEP_KIND_SHORT[d.kind]})` : `← blokeres af (${DEP_KIND_SHORT[d.kind]})`;
          return (
            <div className={`link ${violated ? 'dep-violated' : ''}`} key={d.id}>
              <span>
                <b>{dirLabel}</b> {labelOf(otherId)}
                {violated && <span className="warn"> ⚠️ brud</span>}
              </span>
              <button className="danger" title="Fjern dependency" onClick={() => removeDependency(d.id)}>✕</button>
            </div>
          );
        })}
        <AddDependency onAdd={(blockedId, kind) => addDependency(item.id, blockedId, kind)} exclude={item.id} />
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

/**
 * Kilde-valg (M28): link op på en eksisterende kilde i biblioteket, eller opret
 * en ny. Dedup sker i store.addSource, saa samme bog ikke dukker op to gange.
 */
function AddSource(props: {
  library: { id: string; title: string; locator?: string; url?: string }[];
  attached: Set<string>;
  onAttach: (id: string) => void;
  onCreate: (cand: { title: string; locator?: string; url?: string }) => void;
}) {
  const [pick, setPick] = useState('');
  const [title, setTitle] = useState('');
  const [locator, setLocator] = useState('');
  const [url, setUrl] = useState('');
  const free = props.library.filter((s) => !props.attached.has(s.id));
  return (
    <>
      <div className="addrow">
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">→ eksisterende kilde…</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>{citeLabel(s)}</option>
          ))}
        </select>
        <button
          disabled={!pick}
          title="Knyt valgte kilde til denne post"
          onClick={() => { props.onAttach(pick); setPick(''); }}
        >Knyt</button>
      </div>
      <div className="addrow">
        <input value={title} placeholder="Kilde (bog, artikel, netsted)…" onChange={(e) => setTitle(e.target.value)} />
        <input value={locator} placeholder="s. 214 / kap. 3" style={{ width: 90 }} onChange={(e) => setLocator(e.target.value)} />
        <input value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
        <button
          disabled={!title.trim()}
          title="Opret kilde og knyt til post"
          onClick={() => {
            props.onCreate({ title: title.trim(), locator: locator.trim() || undefined, url: url.trim() || undefined });
            setTitle(''); setLocator(''); setUrl('');
          }}
        >+ ny</button>
      </div>
    </>
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

function AddDependency({ onAdd, exclude }: { onAdd: (blockedId: string, kind: DepKind) => void; exclude: string }) {
  const doc = useApp((s) => s.doc);
  const [kind, setKind] = useState<DepKind>('FS');
  const [blockedId, setBlockedId] = useState('');
  const others = doc.items.filter((it) => it.id !== exclude);
  return (
    <div className="addrow">
      <select value={kind} onChange={(e) => setKind(e.target.value as DepKind)} title="Dependency-type">
        {(Object.entries(DEP_KIND_LABELS) as [DepKind, string][]).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <select value={blockedId} onChange={(e) => setBlockedId(e.target.value)}>
        <option value="">→ blokerer…</option>
        {others.map((it) => (
          <option key={it.id} value={it.id}>{it.label}</option>
        ))}
      </select>
      <button onClick={() => { if (blockedId) { onAdd(blockedId, kind); setBlockedId(''); } }}>+</button>
    </div>
  );
}

function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');
  function add() {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  }
  return (
    <div className="tags-editor">
      <div className="tag-list">
        {tags.map((t) => (
          <span key={t} className="tag-badge">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))}>✕</button>
          </span>
        ))}
      </div>
      <div className="addrow">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="nyt tag…" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add}>+</button>
      </div>
    </div>
  );
}
