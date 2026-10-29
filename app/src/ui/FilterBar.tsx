// **** Filter-bar: type, tag, dato-ramge, tekst (M4) ****
import { useState } from 'react';
import { useApp } from '../store';
import { toJD } from '../core/jdn';
import { applyFilter } from '../core/filters';
import type { Filter } from '../model/doc';

export function FilterBar() {
  const doc = useApp((s) => s.doc);
  const activeFilter = useApp((s) => s.activeFilter);
  const setFilter = useApp((s) => s.setFilter);
  const saveFilter = useApp((s) => s.saveFilter);
  const removeSavedFilter = useApp((s) => s.removeSavedFilter);

  const [text, setText] = useState(activeFilter?.text ?? '');
  const [types, setTypes] = useState<string[]>(activeFilter?.types ?? []);
  const [fromY, setFromY] = useState('');
  const [toY, setToY] = useState('');

  function buildFilter(): Filter | null {
    const f: Filter = { match: 'all' };
    if (text.trim()) f.text = text.trim();
    if (types.length) f.types = types;
    // tag-filtrering haandteres i entry-listen (sidebar); bevar evt. eksisterende saa Filtrer ikke overskriver den
    if (activeFilter?.tags?.length) f.tags = activeFilter.tags;
    if (fromY || toY) {
      f.dateRange = {};
      if (fromY) f.dateRange.from = toJD({ y: +fromY, precision: 'year' });
      if (toY) f.dateRange.to = toJD({ y: +toY, precision: 'year' });
    }
    const hasAny = f.text || f.types || f.tags || f.dateRange;
    return hasAny ? f : null;
  }

  function apply() {
    setFilter(buildFilter());
  }

  function clear() {
    setText('');
    setTypes([]);
    setFromY('');
    setToY('');
    setFilter(null);
  }

  function save() {
    const f = buildFilter();
    if (!f) return;
    const name = prompt('Gem filter som:');
    if (name) saveFilter(name, f);
  }

  const savedFilters = doc.savedFilters ?? {};

  return (
    <div className="filter-bar">
      <input
        className="filter-text"
        placeholder="Søg…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
      />

      <div className="filter-types">
        {doc.itemTypes.map((t) => (
          <label key={t.id} className="filter-chip" style={{ opacity: types.length === 0 || types.includes(t.id) ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={types.length === 0 || types.includes(t.id)}
              onChange={(e) => {
                if (types.length === 0) {
                  // first uncheck → exclude this one → select all others
                  setTypes(doc.itemTypes.map((x) => x.id).filter((id) => id !== t.id));
                } else if (e.target.checked) {
                  setTypes([...types, t.id]);
                } else {
                  const next = types.filter((id) => id !== t.id);
                  setTypes(next.length === 0 ? [] : next);
                }
              }}
            />
            <span className="dot" style={{ background: t.color }} />
            {t.name}
          </label>
        ))}
      </div>

      <div className="filter-dates">
        <input type="number" placeholder="fra år" value={fromY} onChange={(e) => setFromY(e.target.value)} title="Fra år (negativt = f.Kr.)" />
        <input type="number" placeholder="til år" value={toY} onChange={(e) => setToY(e.target.value)} title="Til år" />
      </div>

      <button onClick={apply}>Filtrér</button>
      <button onClick={clear} className="dim">Ryd</button>
      <button onClick={save} title="Gem aktivt filter">Gem filter</button>

      {Object.keys(savedFilters).length > 0 && (
        <div className="saved-filters">
          {Object.entries(savedFilters).map(([name]) => (
            <span key={name} className="filter-chip">
              <button onClick={() => setFilter(savedFilters[name])}>{name}</button>
              <button className="chip-del" onClick={() => removeSavedFilter(name)} title="Fjern gemt filter">×</button>
            </span>
          ))}
        </div>
      )}

      {activeFilter && (
        <span className="filter-active dim">
          ({applyFilter(doc.items, activeFilter).length}/{doc.items.length} vist)
        </span>
      )}
    </div>
  );
}
