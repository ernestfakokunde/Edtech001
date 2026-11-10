import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

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
      <main className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#eaf2ff_0,transparent_30%),var(--color-wash)] text-ink grid min-h-screen place-items-center gap-12 text-center text-13 text-muted">
        <div className="grid max-w-420 gap-10 text-center">
          <strong className="text-15 text-ink">Something went wrong on this screen.</strong>
          <span>Your work is safe. Reload the page to carry on where you left off.</span>
          <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => window.location.reload()}>Reload the page</button>
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
