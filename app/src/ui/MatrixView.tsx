// **** Relations-matrix (M3+M8): poster × poster, klik = tilføj/fjern relation, drill-down-detail ****
import { useState } from 'react';
import { useApp } from '../store';
import { findRelation, relationTypes } from '../core/relations';
import { linksOf } from '../core/relations';

export function MatrixView() {
  const doc = useApp((s) => s.doc);
  const toggleRelation = useApp((s) => s.toggleRelation);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const types = relationTypes(doc);
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const type = types.find((t) => t.id === typeId);
  const items = [...doc.items].sort((a, b) => a.label.localeCompare(b.label));

  // M8: drill-down state — which cell was last clicked for detail view
  const [detail, setDetail] = useState<{ fromId: string; toId: string } | null>(null);

  const detailFrom = detail ? items.find((it) => it.id === detail.fromId) : null;
  const detailTo = detail ? items.find((it) => it.id === detail.toId) : null;
  const detailRel = detail ? findRelation(doc, detail.fromId, detail.toId, typeId) : null;
  const detailNote = (detailRel as any)?.note as string | undefined;

  // M8: shared-links summary per item (shown in drill-down)
  const detailLinksFrom = detailFrom ? linksOf(doc, detailFrom.id).filter((l) => l.type.id === typeId) : [];

  function onCellClick(fromId: string, toId: string, hasRel: boolean) {
    if (hasRel) {
      // drill-down: show detail
      setDetail({ fromId, toId });
    } else {
      // add relation immediately
      toggleRelation(fromId, toId, typeId);
      setDetail(null);
    }
  }

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
        <span className="count">{(doc.relations ?? []).filter((r) => r.typeId === typeId).length} relationer af denne type · klik tom celle = opret · klik ● = detalje · højreklik = fjern</span>
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
                  const isDetail = detail?.fromId === r.id && detail?.toId === c.id;
                  const note = (rel as any)?.note as string | undefined;
                  return (
                    <td
                      key={c.id}
                      className={`${rel ? 'on' : ''} ${isDetail ? 'detail' : ''}`}
                      title={rel ? `${r.label} → ${c.label}${note ? ` (${note})` : ''}` : `${r.label} → ${c.label}`}
                      onClick={() => onCellClick(r.id, c.id, !!rel)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (rel) { toggleRelation(r.id, c.id, typeId); setDetail(null); }
                      }}
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

      {/* M8: Drill-down detail-kort */}
      {detail && detailFrom && detailTo && (
        <div className="matrix-detail">
          <div className="detail-header">
            <span className="detail-arrow">{type?.name}</span>
            <button className="close" onClick={() => setDetail(null)}>✕</button>
          </div>
          <div className="detail-body">
            <div className="detail-pair">
              <button className="detail-item" onClick={() => { select(detailFrom.id); }}>
                <span className="detail-role">{type?.name}:</span> {detailFrom.label}
              </button>
              <span className="detail-link-arrow">→</span>
              <button className="detail-item" onClick={() => { select(detailTo.id); }}>
                <span className="detail-role">{type?.reverseName}:</span> {detailTo.label}
              </button>
            </div>
            {detailNote && <div className="detail-note">📝 {detailNote}</div>}
            <div className="detail-actions">
              <button className="danger" onClick={() => { toggleRelation(detail.fromId, detail.toId, typeId); setDetail(null); }}>Fjern relation</button>
            </div>

            {/* All relations for this pair of items */}
            {detailLinksFrom.length > 1 && (
              <div className="detail-sub">
                <h4>Alle {type?.name}-relationer for “{detailFrom.label}”:</h4>
                <ul>{detailLinksFrom.map((l, i) => (
                  <li key={i}>
                    <button onClick={() => select(l.otherId)}>
                      {l.otherId === detailTo.id ? '→ ' : ''}{l.rel.fromId === detailFrom.id ? l.type.name : l.type.reverseName} {doc.items.find((it) => it.id === l.otherId)?.label ?? '?'}
                    </button>
                  </li>
                ))}</ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function short(label: string): string {
  return label.length > 14 ? label.slice(0, 13) + '…' : label;
}
