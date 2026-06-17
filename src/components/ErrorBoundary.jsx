import { Component } from "react";

/* ------------------------------ error boundary --------------------------- */
// A thrown render in any tab would otherwise white-screen the whole PWA. This
// catches it, shows a calm recovery card, and lets the user retry (re-render)
// or reload. Wrapped per-tab (keyed by tab) so switching tabs also clears it.
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card p-8 text-center max-w-md mx-auto rise" role="alert">
        <h2 className="font-display text-xl mb-2" style={{ fontWeight: 600 }}>Something went sideways</h2>
        <p className="t-soft text-sm mb-4">This view hit an unexpected error. Your saved data is safe.</p>
        <div className="flex gap-2 justify-center">
          <button className="btn btn-soft" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload app</button>
        </div>
      </div>
    );
  }
}
