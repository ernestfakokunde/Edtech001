import type { ReactNode } from "react";
import { LayoutGrid, Menu } from "lucide-react";
import type { Route } from "../types";

export function go(route: Route | string) {
  window.location.hash = route;
}

export function Header({ route, isAdmin = false }: { route: Route; isAdmin?: boolean }) {
  const isApplicationRoute = route !== "home" && route !== "login" && route !== "signup";

  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => go(isApplicationRoute ? "dashboard" : "home")}>
        <span>
          <LayoutGrid size={16} />
        </span>{" "}
        RecappEdu
      </button>
      <nav>
        <button
          className={route === "hierarchy" || route === "material" ? "active" : ""}
          onClick={() => go("hierarchy")}
        >
          My courses
        </button>
        <button onClick={() => go("hierarchy")}>Repository</button>
        <button onClick={() => go(isApplicationRoute ? "dashboard" : "home")}>My sets</button>
        {isAdmin && <button className={route === "admin" ? "active" : ""} onClick={() => go("admin")}>Admin</button>}
      </nav>
      <button className="avatar" aria-label="Open profile" onClick={() => go("profile")}>
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
