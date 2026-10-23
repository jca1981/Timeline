// **** Relations-matrix (M3): poster × poster, klik = tilføj/fjern relation af valgt type ****
import { useState } from 'react';
import { useApp } from '../store';
import { findRelation, relationTypes } from '../core/relations';

export function MatrixView() {
  const doc = useApp((s) => s.doc);
  const toggleRelation = useApp((s) => s.toggleRelation);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const types = relationTypes(doc);
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const type = types.find((t) => t.id === typeId);
  const items = [...doc.items].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <div className="toolbar">
        <label>
          Relationstype: <b>{type?.name}</b> / <b>{type?.reverseName}</b>{' '}
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ⇄ {t.reverseName}</option>
            ))}
          </select>
        </label>
        <span className="count">{(doc.relations ?? []).filter((r) => r.typeId === typeId).length} relationer af denne type · klik i en celle = til/fra (række = fra)</span>
      </div>
      <div className="matrix-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th className="corner">↓ fra / til →</th>
              {items.map((c) => (
                <th key={c.id} className={selectedId === c.id ? 'sel' : ''} title={c.label}><a onClick={() => select(c.id)}>{short(c.label)}</a></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <th className={selectedId === r.id ? 'sel' : ''} title={r.label}><a onClick={() => select(r.id)}>{short(r.label)}</a></th>
                {items.map((c) => {
                  if (c.id === r.id) return <td key={c.id} className="diag" />;
                  const rel = findRelation(doc, r.id, c.id, typeId);
                  return (
                    <td
                      key={c.id}
                      className={rel ? 'on' : ''}
                      title={rel ? `${r.label} ${type?.name} ${c.label} (klik fjerner)` : `tilføj: ${r.label} → ${c.label}`}
                      onClick={() => toggleRelation(r.id, c.id, typeId)}
                    >
                      {rel ? '●' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function short(label: string): string {
  return label.length > 14 ? label.slice(0, 13) + '…' : label;
}
