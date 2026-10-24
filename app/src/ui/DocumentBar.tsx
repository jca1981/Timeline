// **** Dokument-skifter: multi-doc profiles (M9) ****
import { useEffect } from 'react';
import { useApp } from '../store';

export function DocumentBar() {
  const docList = useApp((s) => s.docList);
  const doc = useApp((s) => s.doc);
  const switchDoc = useApp((s) => s.switchDoc);
  const newDoc = useApp((s) => s.newDoc);
  const deleteDoc = useApp((s) => s.deleteDoc);
  const saveAsDoc = useApp((s) => s.saveAsDoc);
  const refreshDocList = useApp((s) => s.refreshDocList);

  useEffect(() => { refreshDocList(); }, [refreshDocList]);

  return (
    <div className="doc-bar">
      <select
        className="doc-select"
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (id === '__new__') { newDoc(); }
          else if (id) { switchDoc(id); }
          e.target.value = '';
        }}
      >
        <option value="" disabled>📂 Dokument…</option>
        {docList.map((d) => (
          <option key={d.id} value={d.id}>{d.name} ({new Date(d.updatedAt).toLocaleDateString('da')})</option>
        ))}
        <option value="__new__">➕ Nyt dokument</option>
      </select>
      <button className="doc-btn" onClick={() => {
        const name = prompt('Gem som (navn):', doc.name);
        if (name) saveAsDoc(name);
      }} title="Gem som ny profil">💾 Gem som</button>
      {docList.length > 0 && (
        <button className="doc-btn doc-del" onClick={() => {
          const delId = prompt(`Slet hvilket? Skriv nr.:\n${docList.map((d, i) => `${i + 1}. ${d.name}`).join('\n')}`);
          const idx = parseInt(delId || '0') - 1;
          if (idx >= 0 && idx < docList.length) {
            if (window.confirm(`Slet “${docList[idx]!.name}”?`)) deleteDoc(docList[idx]!.id);
          }
        }} title="Slet dokument">🗑</button>
      )}
    </div>
  );
}
