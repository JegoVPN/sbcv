import { Component, Suspense, type ReactNode } from "react";

// R2 — top-level lazy UI layers (mobile sheets, JSON viewer) were `Suspense fallback={null}` with NO
// error boundary: a failed/blocked dynamic import threw past the root and cleared `#root` (blank/black
// screen), and a slow chunk showed nothing. LazyLayerBoundary wraps a lazy layer slot so (a) a chunk
// load shows a visible skeleton, and (b) a chunk FAILURE is caught and rendered as a recoverable, closable
// error inside the layer slot — the app stays mounted. Scoped per slot, never app-wide. Retry bumps a key
// to remount the Suspense subtree (best-effort re-attempt of the dynamic import).
export class LazyLayerBoundary extends Component<
  {
    /** Closes the layer so the user can dismiss a failed/loading layer and keep using the app. */
    onClose?: () => void;
    /** Visible loading UI while the chunk loads (defaults to a neutral skeleton). */
    fallback?: ReactNode;
    children: ReactNode;
  },
  { failed: boolean; retryKey: number }
> {
  state = { failed: false, retryKey: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  private retry = () => this.setState((s) => ({ failed: false, retryKey: s.retryKey + 1 }));

  render() {
    if (this.state.failed) {
      return (
        <div role="alertdialog" aria-label="Panel failed to load" className="lazy-layer-error" data-testid="lazy-layer-error">
          <p className="lazy-layer-error__message">This panel couldn’t load — a network or chunk error interrupted it.</p>
          <div className="lazy-layer-error__actions">
            <button type="button" onClick={this.retry}>
              Retry
            </button>
            {this.props.onClose ? (
              <button type="button" onClick={this.props.onClose}>
                Close
              </button>
            ) : null}
          </div>
        </div>
      );
    }
    const skeleton = this.props.fallback ?? (
      <div className="lazy-layer-skeleton" data-testid="lazy-layer-loading" aria-busy="true" aria-label="Loading…" />
    );
    return (
      <Suspense key={this.state.retryKey} fallback={skeleton}>
        {this.props.children}
      </Suspense>
    );
  }
}
