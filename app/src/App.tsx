import { useEffect, useRef, useState } from 'react';
import { hydrateStore, useApp } from './store';
import { historyInfo } from './core/history';
import { SpreadsheetView } from './ui/SpreadsheetView';
import { TimelineView } from './ui/TimelineView';
import { MatrixView } from './ui/MatrixView';
import { FamilyTreeView } from './ui/FamilyTreeView';
import { SubwayView } from './ui/SubwayView';
import { NarrativeView } from './ui/NarrativeView';
import { CompareView } from './ui/CompareView';
import { SourcesView } from './ui/SourcesView';
import { PeopleView } from './ui/PeopleView';
import { DocumentBar } from './ui/DocumentBar';
import { Inspector } from './ui/Inspector';
import { FilterBar } from './ui/FilterBar';
import { importAeon } from './core/aeonImport';
import ErrorBoundary from './ui/ErrorBoundary';
import { putImages } from './core/images';
import { downloadHtml } from './core/exportHtml';
import { downloadSvg } from './core/exportSvg';
import { TEMPLATES } from './model/templates';

type View = 'ark' | 'tidslinje' | 'matrix' | 'slægtstræ' | 'subway' | 'fortælling' | 'sammenlign' | 'kilder' | 'personer';

export default function App() {
  const doc = useApp((s) => s.doc);
  const importDoc = useApp((s) => s.importDoc);
  const mergeDoc = useApp((s) => s.mergeDoc);
  const [view, setView] = useState<View>('tidslinje');
  const [importing, setImporting] = useState(false);
  // M20: Theme toggle
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('tl-theme') as 'dark' | 'light') || 'dark');
  useEffect(() => { document.body.classList.toggle('light', theme === 'light'); localStorage.setItem('tl-theme', theme); }, [theme]);
  // M21: Auto-save indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const prevDocRef = useRef(doc);
  useEffect(() => {
    if (doc === prevDocRef.current) return;
    prevDocRef.current = doc;
    setSaveStatus('saving');
    const t = setTimeout(() => setSaveStatus('saved'), 600);
    return () => clearTimeout(t);
  }, [doc]);

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
      const replace = window.confirm(`Importer "${json.name || file.name}" (${json.items.length} poster)?\n\nOK = Erstat alt\nCancel = Merge ind (spring over dupliker)`);
        if (replace) { importDoc(json); } else { mergeDoc(json); }
        setView('ark');
    } catch (e) {
      alert('JSON-import fejlede: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      if (jsonRef.current) jsonRef.current.value = '';
    }
  }

  async function onFile(file: File) {
    setImporting(true);
    try {
      const { doc: imported, images, warnings } = importAeon(await file.arrayBuffer(), file.name.replace(/\.aeon$/i, ''));
      const replace = window.confirm(`Importer ${imported.items.length} poster, ${imported.relations?.length ?? 0} relationer${imported.sources?.length ? `, ${imported.sources.length} kilder` : ''}${images.length ? ` og ${images.length} billeder` : ''}?\n\nOK = Erstat alt\nCancel = Merge ind (spring over dupliker)`);
      if (imported.items.length) {
        if (images.length) await putImages(images.map((img) => ({ id: img.id, entry: { blob: img.blob, mimeType: img.mimeType, filename: img.filename } })));
        if (replace) { importDoc(imported); } else { mergeDoc(imported); }
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
        <h1>Timeline</h1>
        <input
          id="doc"
          value={doc.name}
          onChange={(e) => useApp.setState((s) => ({ doc: { ...s.doc, name: e.target.value } }))}
        />
        <DocumentBar />
        <button className="tab undo-btn" onClick={undoAction} title={`Fortryd (Ctrl+Z) [${historyInfo().undoCount}]`}>↩</button>
        <button className="tab undo-btn" onClick={redoAction} title={`Gentag (Ctrl+Shift+Z) [${historyInfo().redoCount}]`}>↪</button>
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
          <button className={view === 'sammenlign' ? 'tab on' : 'tab'} onClick={() => setView('sammenlign')}>
            Sammenlign
          </button>
          <button className={view === 'kilder' ? 'tab on' : 'tab'} onClick={() => setView('kilder')} title="Kildeliste på tværs af alle poster">
            Kilder{doc.sources?.length ? ` (${doc.sources.length})` : ''}
          </button>
          <button className={view === 'personer' ? 'tab on' : 'tab'} onClick={() => setView('personer')} title="Alle personer med levetid, forældre, børn og kilder">
            Personer
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
        <button className="tab" onClick={exportJson} title="Eksportér som JSON">Eksportér JSON</button>
        <button className="tab" onClick={() => downloadHtml(doc)} title="Eksportér statisk HTML-tidslinje">HTML</button>
        <button className="tab" onClick={() => downloadSvg(doc)} title="Eksportér SVG-billede">SVG</button>
        <button className="tab" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Skift tema">{theme === 'dark' ? 'Lys' : 'Mørk'} tilstand</button>
        <label className="tab" title="Importér JSON-fil">
          Importér JSON
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
      {/* FilterBar ligger OVER .body – som flex-barn i .body (row) ville den med mange typer/mærker
          drukne <main> (max-content > containerbredde → main:0px → tomt timeline-view). */}
      <FilterBar />
      <div className="body">
        <main>
          <ErrorBoundary key={view} label={`visningen “${view}”`}>
            {view === 'ark' && <SpreadsheetView />}
            {view === 'tidslinje' && <TimelineView />}
            {view === 'matrix' && <MatrixView />}
            {view === 'slægtstræ' && <FamilyTreeView />}
            {view === 'subway' && <SubwayView />}
            {view === 'fortælling' && <NarrativeView />}
            {view === 'sammenlign' && <CompareView />}
            {view === 'kilder' && <SourcesView />}
            {view === 'personer' && <PeopleView />}
          </ErrorBoundary>
        </main>
        <Inspector />
      </div>
      {saveStatus !== 'idle' && (
        <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Gemmer…' : 'Gemt'}</span>
      )}
    </div>
  );
}
