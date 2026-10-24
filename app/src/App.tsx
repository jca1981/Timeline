import { useEffect, useRef, useState } from 'react';
import { hydrateStore, useApp } from './store';
import { SpreadsheetView } from './ui/SpreadsheetView';
import { TimelineView } from './ui/TimelineView';
import { MatrixView } from './ui/MatrixView';
import { FamilyTreeView } from './ui/FamilyTreeView';
import { SubwayView } from './ui/SubwayView';
import { NarrativeView } from './ui/NarrativeView';
import { DocumentBar } from './ui/DocumentBar';
import { Inspector } from './ui/Inspector';
import { FilterBar } from './ui/FilterBar';
import { importAeon } from './core/aeonImport';
import { TEMPLATES } from './model/templates';

type View = 'ark' | 'tidslinje' | 'matrix' | 'slægtstræ' | 'subway' | 'fortælling';

export default function App() {
  const doc = useApp((s) => s.doc);
  const importDoc = useApp((s) => s.importDoc);
  const [view, setView] = useState<View>('ark');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const undoAction = useApp((s) => s.undoAction);
  const redoAction = useApp((s) => s.redoAction);

  // Hydrate fra IndexedDB ved opstart
  useEffect(() => { hydrateStore(); }, []);

  // M10: Undo/Redo keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoAction();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoAction();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoAction, redoAction]);

  // JSON export
  function exportJson() {
    const json = JSON.stringify(doc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.name || 'timeline'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // JSON import
  async function onJsonFile(file: File) {
    try {
      const json = JSON.parse(await file.text());
      if (!json.items || !Array.isArray(json.items)) throw new Error('Ugyldigt JSON: mangler items[]');
      if (window.confirm(`Importer “${json.name || file.name}” (${json.items.length} poster)?

Nuværende indhold erstattes.`)) {
        importDoc(json);
        setView('ark');
      }
    } catch (e) {
      alert('JSON-import fejlede: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      if (jsonRef.current) jsonRef.current.value = '';
    }
  }

  async function onFile(file: File) {
    setImporting(true);
    try {
      const { doc: imported, warnings } = importAeon(await file.arrayBuffer(), file.name.replace(/\.aeon$/i, ''));
      if (window.confirm(`Importer ${imported.items.length} poster og ${imported.relations?.length ?? 0} relationer?

Nuværende indhold erstattes.`)) {
        importDoc(imported);
        setView('ark');
        if (warnings.length) alert('Advarsler:\n' + warnings.join('\n'));
      }
    } catch (e) {
      alert('Import fejlede: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="app">
      <header>
        <h1>📜 Timeline</h1>
        <input
          id="doc"
          value={doc.name}
          onChange={(e) => useApp.setState((s) => ({ doc: { ...s.doc, name: e.target.value } }))}
        />
        <DocumentBar />
        <button className="tab undo-btn" onClick={undoAction} title="Fortryd (Ctrl+Z)">↩</button>
        <button className="tab undo-btn" onClick={redoAction} title="Gentag (Ctrl+Shift+Z)">↪</button>
        <nav>
          <button className={view === 'ark' ? 'tab on' : 'tab'} onClick={() => setView('ark')}>Ark</button>
          <button className={view === 'tidslinje' ? 'tab on' : 'tab'} onClick={() => setView('tidslinje')}>
            Tidslinje
          </button>
          <button className={view === 'matrix' ? 'tab on' : 'tab'} onClick={() => setView('matrix')}>
            Matrix
          </button>
          <button className={view === 'slægtstræ' ? 'tab on' : 'tab'} onClick={() => setView('slægtstræ')}>
            Slægtstræ
          </button>
          <button className={view === 'subway' ? 'tab on' : 'tab'} onClick={() => setView('subway')}>
            Subway
          </button>
          <button className={view === 'fortælling' ? 'tab on' : 'tab'} onClick={() => setView('fortælling')}>
            Fortælling
          </button>
        </nav>
        <label className="tab importbtn" title="Importer en .aeon-fil fra Aeon Timeline">
          {importing ? 'Importer…' : 'Importer .aeon'}
          <input
            ref={fileRef}
            type="file"
            accept=".aeon"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
        <button className="tab" onClick={exportJson} title="Eksportér som JSON">💾 JSON</button>
        <label className="tab" title="Importér JSON-fil">
          📂 JSON
          <input ref={jsonRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && onJsonFile(e.target.files[0])} />
        </label>
        <select className="tab" onChange={(e) => {
          const tpl = TEMPLATES.find((t) => t.name === e.target.value);
          if (tpl && window.confirm(`Anvend skabelon “${tpl.name}”? Nuværende indhold erstattes.`)) {
            importDoc(tpl.build());
            setView('ark');
          }
          e.target.value = '';
        }} defaultValue="">
          <option value="" disabled>Skabeloner…</option>
          {TEMPLATES.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
      </header>
      <div className="body">
        <FilterBar />
        <main>
          {view === 'ark' && <SpreadsheetView />}
          {view === 'tidslinje' && <TimelineView />}
          {view === 'matrix' && <MatrixView />}
          {view === 'slægtstræ' && <FamilyTreeView />}
          {view === 'subway' && <SubwayView />}
          {view === 'fortælling' && <NarrativeView />}
        </main>
        <Inspector />
      </div>
    </div>
  );
}
