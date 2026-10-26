// **** Fejlgrænse: et view må aldrig tage hele appen med ned ****
// Uden denne vil en exception under render/håndterer afmontere hele rodtræet → hvid side,
// brugeren skal genindlæse (og billederne/dokumentet ligger trygt i IndexedDB).
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Fejl i ${this.props.label ?? 'visning'}:`, error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h2>Noget gik galt i {this.props.label ?? 'denne visning'}</h2>
        <p>
          Dine data er ikke tabt. De ligger gemt lokalt. Prøv at prøve igen, eller skift visning.
        </p>
        <pre>{String(error.message ?? error)}</pre>
        <div className="crash-actions">
          <button className="primary" onClick={() => this.setState({ error: null })}>Prøv igen</button>
          <button onClick={() => window.location.reload()}>Genindlæs siden</button>
        </div>
      </div>
    );
  }
}
