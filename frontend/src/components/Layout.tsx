import type { ReactNode } from "react";
import { LayoutGrid, Menu } from "lucide-react";
import type { Route } from "../types";

export function go(route: Route) {
  window.location.hash = route;
}

export function Header({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => go("home")}>
        <span>
          <LayoutGrid size={16} />
        </span>{" "}
        RecappEdu
      </button>
      <nav>
        <button
          className={route === "courses" || route === "course" ? "active" : ""}
          onClick={() => go("courses")}
        >
          My courses
        </button>
        <button onClick={() => go("course")}>Repository</button>
        <button onClick={() => go("home")}>My sets</button>
      </nav>
      <button className="avatar" aria-label="Open profile menu">
        AO
      </button>
      <button className="menu-button" aria-label="Open menu">
        <Menu size={20} />
      </button>
    </header>
  );
}

export function PageFrame({
  children,
  eyebrow,
  title,
  subtitle,
  back,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  back?: Route;
}) {
  return (
    <main className="screen-wrap">
      {back && (
        <button className="back-link" onClick={() => go(back)}>
          Back
        </button>
      )}
      <div className="page-heading">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children}
    </main>
  );
}

export function Footer() {
  return (
    <footer>
      <span>© 2026 RecappEdu</span>
      <span>Structured practice, one course at a time.</span>
    </footer>
  );
}
