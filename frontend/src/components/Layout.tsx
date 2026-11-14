import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, Gift, History, LayoutDashboard, LogOut, Mail, Menu, MessageCircle, Moon, ShieldCheck, Sparkles, Sun, UserRound, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import type { Route } from "../types";
import { resendVerificationEmail, type AuthProfile } from "../lib/api";

export function go(route: Route | string) {
  window.location.hash = route;
}

export type ProfileIdentity = Pick<AuthProfile, "displayName" | "username" | "email" | "tier" | "subscriptionPlan" | "premiumUntil" | "emailVerifiedAt"> | null | undefined;

function scrollToHomeSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Two-letter monogram for a profile ("Ernest Fakokunde" → "EF", "ada@x.com" → "AD"). */
export function initialsOf(profile: ProfileIdentity) {
  const source = (profile?.displayName || profile?.username || profile?.email || "").trim();
  if (!source) return "ST";
  const parts = source.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The name a student should see about themselves — never a hard-coded placeholder. */
export function displayNameOf(profile: ProfileIdentity) {
  return (profile?.displayName || profile?.username || profile?.email?.split("@")[0] || "Student").trim();
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== "light");
  useEffect(() => {
    const syncTheme = () => setDark(document.documentElement.dataset.theme === "dark");
    window.addEventListener("recappedu-theme-change", syncTheme);
    return () => window.removeEventListener("recappedu-theme-change", syncTheme);
  }, []);

  const toggle = () => {
    const next = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("recappedu-theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("recappedu-theme-change"));
  };
  return <button className="grid size-36 place-items-center rounded-9 border border-line bg-surface text-muted transition hover:bg-pale hover:text-ink" onClick={toggle} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>;
}

function planLabel(profile: ProfileIdentity) {
  const planNames = { FREE: "Free", BASIC: "Basic", STUDENT_PLUS: "Student Plus", PREMIUM: "Premium" } as const;
  if (profile?.subscriptionPlan && profile.subscriptionPlan !== "FREE" && profile.premiumUntil && new Date(profile.premiumUntil) > new Date()) {
    return `${planNames[profile.subscriptionPlan]} until ${new Date(profile.premiumUntil).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  if (profile?.tier === "PREMIUM") {
    const until = profile.premiumUntil ? new Date(profile.premiumUntil) : null;
    if (!until || until > new Date()) {
      return until ? `Pro until ${until.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Pro";
    }
  }
  return "Free";
}

function pageTitle(route: Route) {
  const titles: Partial<Record<Route, string>> = {
    dashboard: "Study desk",
    hierarchy: "Browse courses",
    material: "Study material",
    learn: "Learn with AI",
    generate: "Practice sets",
    history: "My quizzes",
    quiz: "Quiz",
    flashcards: "Flashcards",
    results: "Quiz results",
    personal: "Practice from my PDF",
    rewards: "Rewards",
    profile: "My profile",
    privacy: "Privacy policy",
    terms: "Terms of use",
  };
  return titles[route] ?? "RecappEdu";
}

/* Phase 4 conversion — the `.topbar`, `.topbar nav`, `.topbar nav button`,
   `.menu-button`, `.page-heading`, `.page-subtitle`, `.screen-wrap h1` and
   `footer` rules (plus their 1160/860/680 overrides) were Layout.tsx-exclusive,
   so they are utilities here and have been deleted from App.css. Classes still
   shared with unconverted pages deliberately stay as CSS: `.wordmark` and
   `.back-link` (Auth.tsx), `.avatar` (Admin/Dashboard), `.eyebrow` (most
   pages) and `.screen-wrap` (Generate.tsx). See docs/phase-4-layout.md. */
const navButton = "py-22 px-0 text-muted text-13 border-b-2 border-transparent hover:text-ink hover:border-brand max-860:py-16 max-680:whitespace-nowrap";
const navButtonActive = "text-ink border-brand";

export function Header({ route, isAdmin = false, profile }: { route: Route; isAdmin?: boolean; profile?: ProfileIdentity }) {
  if (route === "home") {
    return (
      <header className="site-header home-header sticky top-0 z-30 w-full border-b border-white/10 bg-[#08090fe8] backdrop-blur-xl">
        <div className="mx-auto grid h-76 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-20 px-[clamp(20px,6vw,88px)] max-1160:px-[clamp(14px,3vw,28px)] max-680:grid-cols-[1fr_auto]">
          <button className="wordmark flex w-fit items-center" onClick={() => go("home")} aria-label="RecappEdu home">
            <BrandLogo className="h-36 max-[480px]:h-30" />
          </button>
          <nav className="flex items-center gap-[clamp(20px,3vw,42px)] max-680:hidden [&>button]:relative [&>button]:py-12 [&>button]:text-12 [&>button]:font-medium [&>button]:text-[#b5b0c3] [&>button]:transition-colors [&>button:hover]:text-white" aria-label="Main navigation">
            <button onClick={() => scrollToHomeSection("how-it-works")}>How it works</button>
            <button onClick={() => scrollToHomeSection("pricing")}>Pricing</button>
          </nav>
          <div className="flex items-center justify-self-end gap-14 max-680:gap-9">
            <ThemeToggle />
            <button className="inline-flex min-h-24 items-center text-12 font-semibold text-[#c2bdce] transition-colors hover:text-white max-[480px]:hidden" onClick={() => go("login")}>Sign in</button>
            <button className="btn btn-primary max-[380px]:px-11" onClick={() => go("signup")}><span className="max-[380px]:hidden">Get started</span><span className="hidden max-[380px]:inline">Start</span><ArrowUpRight size={15} /></button>
          </div>
        </div>
      </header>
    );
  }
  const isApplicationRoute = route !== "login" && route !== "signup";
  const myCoursesActive = route === "hierarchy" || route === "material";
  const adminActive = route === "admin";
  const isAuthenticated = Boolean(profile);

  return (
    <header className="site-header sticky top-0 z-30 flex h-64 w-full items-center justify-between border-b border-line bg-surface px-[clamp(16px,4vw,44px)] max-1160:px-[clamp(14px,3vw,28px)]">
      <button className="wordmark flex items-center gap-10 font-grotesk text-18 font-bold" onClick={() => go(isApplicationRoute ? "dashboard" : "home")}>
        {/* The brand lock-up (mark + wordmark) ships as one image so the site
            always shows the artwork exactly as it was drawn. */}
        <BrandLogo />
      </button>
      {isAuthenticated ? (
        <>
          <nav className="ml-auto mr-34 flex gap-30 max-1160:gap-18 max-680:hidden" aria-label="Application navigation">
            <button
              className={`${navButton} ${myCoursesActive ? navButtonActive : ""}`}
              onClick={() => go("hierarchy")}
            >
              My courses
            </button>
            <button className={navButton} onClick={() => go("hierarchy")}>Repository</button>
            <button className={navButton} onClick={() => go("history")}>My sets</button>
            {isAdmin && (
              <button
                className={`${navButton} ${adminActive ? navButtonActive : ""}`}
                onClick={() => go("admin")}
              >
                Admin
              </button>
            )}
          </nav>
      <div className="flex items-center gap-10"><button className="avatar size-35 rounded-full bg-pale text-12 font-bold text-brand" aria-label="Open profile" onClick={() => go("profile")}>
            {initialsOf(profile)}
      </button></div>
        </>
      ) : (
        <nav className="ml-auto flex items-center gap-12">
          <button className={navButton} onClick={() => go("login")}>Log in</button>
          <button className="btn btn-primary btn-sm" onClick={() => go("signup")}>Sign up</button>
        </nav>
      )}
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
    <main className="mx-auto w-full max-w-[1180px] px-[clamp(20px,4vw,40px)] pt-36 pb-56 max-1020:pt-30 max-1020:pb-48 max-860:px-[clamp(16px,4vw,24px)] max-860:pt-26 max-680:min-w-0 max-680:px-18 max-680:pb-40 [&_h1]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere] [&>label:not(.upload-zone)]:mb-8 [&>label:not(.upload-zone)]:block [&>label:not(.upload-zone)]:text-12 [&>label:not(.upload-zone)]:font-semibold [&>label:not(.upload-zone)]:text-muted">
      {back && (
        <button className="mb-24 -mx-6 -my-7 inline-flex min-h-28 items-center gap-7 px-6 py-7 text-12 font-semibold text-muted transition-colors hover:text-brand" onClick={() => go(back)}>
          Back
        </button>
      )}
      <div className="mb-29 max-680:mb-18">
        {eyebrow && <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">{eyebrow}</p>}
        <h1 className="m-0 mb-8 text-[clamp(26px,3.4vw,34px)] font-extrabold leading-[1.12]">{title}</h1>
        {subtitle && <p className="max-w-640 text-muted text-14 leading-160">{subtitle}</p>}
      </div>
      {children}
    </main>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Student navigation (Phase 6). A fixed left rail on desktop that becomes a
   slide-over drawer at ≤1020px (same breakpoint and mechanics as the admin
   board's sidebar), so the same nav works on a phone. All Tailwind utilities —
   no new rules were added to App.css. Items either switch hash route or land on
   the dedicated Rewards page.

   Missions and Promo codes are deliberately part of the student nav: they are
   student surfaces (claim XP / redeem a code), not admin ones.
   ─────────────────────────────────────────────────────────────────────────── */

type UserNavItem = { key: string; hash: string; label: string; icon: ReactNode; group: "Study" | "Account"; adminOnly?: boolean };

const USER_NAV: UserNavItem[] = [
  { key: "dashboard", hash: "dashboard", label: "Study desk", icon: <LayoutDashboard size={18} />, group: "Study" },
  { key: "hierarchy", hash: "hierarchy", label: "Course repository", icon: <BookOpen size={18} />, group: "Study" },
  { key: "learn", hash: "learn", label: "Learn with AI", icon: <MessageCircle size={18} />, group: "Study" },
  { key: "generate", hash: "generate", label: "Practice sets", icon: <Sparkles size={18} />, group: "Study" },
  { key: "history", hash: "history", label: "My quizzes", icon: <History size={18} />, group: "Study" },
  { key: "rewards", hash: "rewards", label: "Rewards", icon: <Gift size={18} />, group: "Account" },
  { key: "profile", hash: "profile", label: "Profile settings", icon: <UserRound size={18} />, group: "Account" },
  { key: "admin", hash: "admin", label: "Admin board", icon: <ShieldCheck size={18} />, group: "Account", adminOnly: true },
];

const userNavBase = "flex w-full shrink-0 items-center gap-11 rounded-9 px-12 py-10 text-left text-13 font-medium transition-colors [&_svg]:stroke-[1.9]";
const userNavActive = "bg-brand font-semibold text-[var(--theme-on-brand)] shadow-brand-sm";
const userNavIdle = "text-muted hover:bg-pale hover:text-ink";

function navActive(item: UserNavItem, route: Route, sub: string) {
  const [itemRoute, itemSub] = item.hash.split("/");
  if (itemRoute !== route) return false;
  if (itemSub) return itemSub === sub;
  // A plain "profile" item must not look active while a profile section is open.
  if (item.key === "profile" && sub) return false;
  return true;
}

function UserSidebar({ route, sub, isAdmin, open, onClose, onLogout }: {
  route: Route;
  sub: string;
  isAdmin: boolean;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const items = USER_NAV.filter((item) => item.key !== "profile" && (!item.adminOnly || isAdmin));
  return (
    <aside
      id="student-navigation"
      aria-label="Student navigation"
      className={`user-sidebar font-inter antialiased fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-line transition-transform duration-200 ${open ? "translate-x-0" : "max-1020:-translate-x-full"}`}
    >
      <div className="flex h-56 items-center gap-11 border-b border-line px-15">
        <BrandLogo className="h-27" />
        <span className="flex-1" />
        <button className="hidden h-32 w-32 shrink-0 place-items-center rounded-10 text-muted hover:bg-pale hover:text-ink max-1020:grid" aria-label="Close navigation" onClick={onClose}>
          <X size={16} />
        </button>
      </div>


      <nav className="flex flex-1 flex-col gap-22 overflow-y-auto p-14 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["Study", "Account"] as const).map((group) => (
          <div key={group} className="grid gap-3">
            <p className="px-10 pb-2 text-[9px] font-extrabold uppercase tracking-[.14em] text-muted">{group}</p>
            {items.filter((item) => item.group === group).map((item) => {
              const active = navActive(item, route, sub);
              return (
                <button
                  key={item.key}
                  aria-current={active ? "page" : undefined}
                  className={`${userNavBase} ${active ? userNavActive : userNavIdle}`}
                  onClick={() => { go(item.hash); onClose(); }}
                >
                  <span className={`grid size-32 shrink-0 place-items-center rounded-8 ${active ? "bg-[var(--theme-on-brand)] text-brand" : "bg-pale text-muted"}`}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="grid gap-3 border-t border-line p-14">
        <div className="flex items-center justify-between px-8 py-5">
          <span className="text-10 font-semibold text-muted">Appearance</span>
          <ThemeToggle />
        </div>
        <button className={`${userNavBase} signout-button`} onClick={onLogout}>
          <span className="grid size-32 shrink-0 place-items-center rounded-8 bg-danger-surface text-danger"><LogOut size={18} /></span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

/**
 * Shown across the student shell until the address is confirmed. AI practice
 * and uploads are gated server-side, so this is the one place a student needs
 * to act; resending is rate-limited on the API.
 */
function EmailVerificationBanner({ email }: { email?: string | null }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setState("sending");
    try {
      await resendVerificationEmail();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-10 border-b border-warning-surface bg-warning-surface px-18 py-9 text-11 leading-145 text-warning" role="status">
      <Mail size={15} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {state === "sent"
          ? "Verification email sent. Check your inbox and spam folder."
          : state === "error"
            ? "We could not send that email just now. Please try again shortly."
            : <>Verify <strong className="font-semibold">{email ?? "your email"}</strong> to unlock AI practice and uploads.</>}
      </span>
      {state !== "sent" && (
        <button
          type="button"
          className="shrink-0 rounded-8 border border-warning px-10 py-5 text-10 font-bold transition-colors hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={state === "sending"}
          onClick={() => void resend()}
        >
          {state === "sending" ? "Sending…" : state === "error" ? "Try again" : "Resend email"}
        </button>
      )}
    </div>
  );
}

/**
 * Page frame for signed-in students: fixed rail + a compact top bar that only
 * appears below 1020px (menu button, brand, avatar). Children keep their own
 * layouts; the shell only handles the offset and the drawer.
 */
export function UserShell({ route, sub, profile, isAdmin, onLogout, children }: {
  route: Route;
  sub: string;
  profile: ProfileIdentity;
  isAdmin: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  // Any navigation closes the drawer so a tap on a nav item reveals the page.
  useEffect(() => { setOpen(false); }, [route, sub]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("scroll-lock");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("scroll-lock");
    };
  }, [open]);
  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="min-h-screen">
      {open && <button className="fixed inset-0 z-40 hidden bg-backdrop backdrop-blur-[1px] max-1020:block" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <UserSidebar
        route={route}
        sub={sub}
        isAdmin={isAdmin}
        open={open}
        onClose={() => setOpen(false)}
        onLogout={onLogout}
      />
      {/* `overflow-x-clip` (not `hidden`) keeps wide content contained without
          turning this wrapper into a scroll container, which would stop the
          sticky top bar from sticking to the viewport. */}
      <div className="user-shell-content ml-[240px] min-h-screen min-w-0 overflow-x-clip max-1020:ml-0">
        <header className="shell-topbar sticky top-0 z-20 flex h-64 items-center gap-10 border-b border-line px-18">
          <button className="hidden h-36 w-36 shrink-0 place-items-center rounded-9 border border-line bg-surface text-muted transition-colors hover:text-ink max-1020:grid" aria-label="Open navigation" aria-expanded={open} aria-controls="student-navigation" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="ml-12 min-w-0">
            <strong className="block truncate text-13 font-semibold text-ink">{pageTitle(route)}</strong>
            <small className="hidden text-10 text-muted max-680:block">Study smarter</small>
          </div>
          <div className="ml-auto flex items-center gap-10">
            <div className="relative" ref={profileMenuRef}>
              <button className="flex items-center gap-8 rounded-10 px-4 py-4 hover:bg-pale" aria-label="Open profile menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((value) => !value)}>
                <span className="grid h-32 w-32 shrink-0 place-items-center rounded-half bg-pale text-11 font-bold text-brand">{initialsOf(profile)}</span>
                <span className="hidden max-w-130 text-left max-860:block"><strong className="block truncate text-11 font-semibold text-ink">{displayNameOf(profile)}</strong><small className="block truncate text-10 text-muted">{planLabel(profile)}</small></span>
                <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {profileMenuOpen && <div className="absolute right-0 top-44 z-50 w-230 rounded-12 border border-line bg-surface p-8 shadow-card">
                <div className="border-b border-line px-8 pb-8"><strong className="block truncate text-12 text-ink">{displayNameOf(profile)}</strong><small className="block truncate text-10 text-muted">{profile?.email ?? "Signed in"}</small><span className={`mt-5 inline-flex shrink-0 items-center gap-6 whitespace-nowrap rounded-full border border-ghost-border bg-pale px-12 py-5 text-11 font-bold tracking-[.02em] text-brand ${planLabel(profile) === "Free" ? "" : "border-amber-300 bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 shadow-[0_2px_6px_rgba(180,83,9,.15)]"}`}>{planLabel(profile)}</span></div>
                <button className="flex w-full items-center gap-8 rounded-8 px-8 py-9 text-left text-11 text-muted hover:bg-pale hover:text-ink" onClick={() => { setProfileMenuOpen(false); go("profile"); }}><UserRound size={14} /> Profile settings</button>
                <button className="flex w-full items-center gap-8 rounded-8 px-8 py-9 text-left text-11 text-muted hover:bg-pale hover:text-ink" onClick={onLogout}><LogOut size={14} /> Log out</button>
              </div>}
            </div>
          </div>
        </header>
        {profile && profile.emailVerifiedAt === null && <EmailVerificationBanner email={profile.email} />}
        {children}
      </div>
    </div>
  );
}
