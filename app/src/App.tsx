import { useState } from 'react';
import { useApp } from './store';
import { SpreadsheetView } from './ui/SpreadsheetView';
import { TimelineView } from './ui/TimelineView';
import { MatrixView } from './ui/MatrixView';
import { Inspector } from './ui/Inspector';

type View = 'ark' | 'tidslinje' | 'matrix';

export default function App() {
  const doc = useApp((s) => s.doc);
  const [view, setView] = useState<View>('ark');

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
      </header>
      <div className="body">
        <main>{view === 'ark' ? <SpreadsheetView /> : view === 'tidslinje' ? <TimelineView /> : <MatrixView />}</main>
        <Inspector />
      </div>
    </div>
  );
}
