import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/**
 * Last line of defence: a render/lifecycle crash anywhere in the tree shows a
 * calm recovery card instead of React's raw error overlay or a blank page. The
 * real error is logged (and reported by the browser) rather than rendered.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ui] unrecoverable render error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-shell auth-loading">
        <div className="grid max-w-420 gap-10 text-center">
          <strong className="text-15 text-ink">Something went wrong on this screen.</strong>
          <span>Your work is safe. Reload the page to carry on where you left off.</span>
          <button className="primary-button" onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
