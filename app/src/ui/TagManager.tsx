// **** M23: Global tag-håndtering — vis alle tags, omdøb/slet på tværs af items ****
import { useMemo, useState } from 'react';
import { useApp } from '../store';

export function TagManager() {
  const doc = useApp((s) => s.doc);
  const updateItem = useApp((s) => s.updateItem);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of doc.items) {
      for (const t of it.tags ?? []) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [doc.items]);

  const renameTag = (oldTag: string, newName: string) => {
    if (!newName.trim() || newName === oldTag) { setRenaming(null); return; }
    for (const it of doc.items) {
      if (it.tags?.includes(oldTag)) {
        updateItem(it.id, { tags: it.tags.map((t) => (t === oldTag ? newName : t)) });
      }
    }
    setRenaming(null);
  };

  const deleteTag = (tag: string) => {
    if (!confirm(`Slet tag "${tag}" fra alle items?`)) return;
    for (const it of doc.items) {
      if (it.tags?.includes(tag)) {
        updateItem(it.id, { tags: it.tags.filter((t) => t !== tag) });
      }
    }
  };

  if (!tagCounts.length) return null;

  return (
    <details className="tag-manager">
      <summary>🏷 Tags ({tagCounts.length})</summary>
      <div className="tm-list">
        {tagCounts.map(([tag, count]) => (
          <div key={tag} className="tm-row">
            {renaming === tag ? (
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                onBlur={() => renameTag(tag, newName)}
                onKeyDown={(e) => { if (e.key === 'Enter') renameTag(tag, newName); if (e.key === 'Escape') setRenaming(null); }} />
            ) : (
              <span className="tm-tag" onDoubleClick={() => { setRenaming(tag); setNewName(tag); }} title="Dobbeltklik for at omdøbe">{tag}</span>
            )}
            <span className="tm-count">{count}</span>
            <button className="tm-del" onClick={() => deleteTag(tag)} title="Slet tag">✕</button>
          </div>
        ))}
      </div>
    </details>
  );
}
