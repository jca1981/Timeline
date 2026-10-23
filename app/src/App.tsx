import { useRef, useState } from 'react';
import { useApp } from './store';
import { SpreadsheetView } from './ui/SpreadsheetView';
import { TimelineView } from './ui/TimelineView';
import { MatrixView } from './ui/MatrixView';
import { Inspector } from './ui/Inspector';
import { importAeon } from './core/aeonImport';

type View = 'ark' | 'tidslinje' | 'matrix';

export default function App() {
  const doc = useApp((s) => s.doc);
  const importDoc = useApp((s) => s.importDoc);
  const [view, setView] = useState<View>('ark');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        <nav>
          <button className={view === 'ark' ? 'tab on' : 'tab'} onClick={() => setView('ark')}>Ark</button>
          <button className={view === 'tidslinje' ? 'tab on' : 'tab'} onClick={() => setView('tidslinje')}>
            Tidslinje
          </button>
          <button className={view === 'matrix' ? 'tab on' : 'tab'} onClick={() => setView('matrix')}>
            Matrix
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
      </header>
      <div className="body">
        <main>{view === 'ark' ? <SpreadsheetView /> : view === 'tidslinje' ? <TimelineView /> : <MatrixView />}</main>
        <Inspector />
      </div>
    </div>
  );
}
