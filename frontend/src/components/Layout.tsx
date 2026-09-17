import type { ReactNode } from "react";
import { LayoutGrid, Menu } from "lucide-react";
import type { Route } from "../types";

export function go(route: Route | string) {
  window.location.hash = route;
}

/* Phase 4 conversion — the `.topbar`, `.topbar nav`, `.topbar nav button`,
   `.menu-button`, `.page-heading`, `.page-subtitle`, `.screen-wrap h1` and
   `footer` rules (plus their 1160/860/680 overrides) were Layout.tsx-exclusive,
   so they are utilities here and have been deleted from App.css. Classes still
   shared with unconverted pages deliberately stay as CSS: `.wordmark` and
   `.back-link` (Auth.tsx), `.avatar` (Admin/Dashboard), `.eyebrow` (most
   pages) and `.screen-wrap` (Generate.tsx). See docs/phase-4-layout.md. */
const navButton = "py-30 px-0 text-muted text-13 border-b-2 border-transparent hover:text-ink hover:border-brand max-860:py-20";
const navButtonActive = "text-ink border-brand";

export function Header({ route, isAdmin = false }: { route: Route; isAdmin?: boolean }) {
  const isApplicationRoute = route !== "home" && route !== "login" && route !== "signup";
  const myCoursesActive = route === "hierarchy" || route === "material";
  const adminActive = route === "admin";

  return (
    <header className="sticky top-0 z-30 w-full h-64 px-[clamp(16px,4vw,44px)] max-1160:px-[clamp(14px,3vw,28px)] flex items-center justify-between border-b border-[#e2e8f0bf] bg-wash">
      <button className="wordmark" onClick={() => go(isApplicationRoute ? "dashboard" : "home")}>
        <span>
          <LayoutGrid size={16} />
        </span>{" "}
        RecappEdu
      </button>
      <nav className="flex gap-30 ml-auto mr-34 max-1160:gap-18 max-680:gap-8 max-680:overflow-x-auto">
        <button
          className={`${navButton} ${myCoursesActive ? navButtonActive : ""}`}
          onClick={() => go("hierarchy")}
        >
          My courses
        </button>
        <button className={navButton} onClick={() => go("hierarchy")}>Repository</button>
        <button className={navButton} onClick={() => go(isApplicationRoute ? "dashboard" : "home")}>My sets</button>
        {isAdmin && (
          <button
            className={`${navButton} ${adminActive ? navButtonActive : ""}`}
            onClick={() => go("admin")}
          >
            Admin
          </button>
        )}
      </nav>
      <button className="avatar" aria-label="Open profile" onClick={() => go("profile")}>
        AO
      </button>
      <button className="hidden" aria-label="Open menu">
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
      <div className="mb-29 max-680:mb-18">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="m-0 mb-8 text-[clamp(26px,3.4vw,34px)]">{title}</h1>
        {subtitle && <p className="text-muted text-13 leading-160">{subtitle}</p>}
      </div>
      {children}
    </main>
  );
}

export function Footer() {
  return (
    <footer className="w-full pt-26 pb-35 px-[clamp(16px,4vw,44px)] flex justify-between text-slate-icon text-11 border-t border-line max-680:flex-col max-680:items-start max-680:gap-9">
      <span>© 2026 RecappEdu</span>
      <span>Structured practice, one course at a time.</span>
    </footer>
  );
}
