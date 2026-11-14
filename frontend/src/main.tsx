import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/* The product ships dark-first; light is the opt-in theme persisted by the
   theme toggle. Defaulting to dark here keeps the first paint consistent with
   the :root tokens in index.css instead of flashing a light page. */
const savedTheme = window.localStorage.getItem("recappedu-theme");
document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";

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
      <main className="app-canvas grid place-items-center gap-12 px-18 text-center text-13 text-muted">
        <div className="grid max-w-420 gap-10 text-center">
          <strong className="text-15 text-ink">Something went wrong on this screen.</strong>
          <span>Your work is safe. Reload the page to carry on where you left off.</span>
          <button className="btn btn-primary mx-auto" onClick={() => window.location.reload()}>Reload the page</button>
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
