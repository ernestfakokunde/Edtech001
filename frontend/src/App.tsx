import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Header, UserShell, go } from "./components/Layout";
import { Home } from "./pages/Home";
import { AuthPage } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import {
  Hierarchy,
  MaterialDetails,
  PersonalPractice,
  Flashcards,
  Quiz,
  Results,
} from "./pages/Study";
import { GenerateFlow } from "./pages/Generate";
import { getRepositoryPaper, recordQuizAttempt, type RepositoryPaper, type GeneratedSet } from "./lib/api";
import type { Route } from "./types";
import { errorMessage, getCurrentProfile, hasProfileCache, invalidateProfileCache, logout, prefetchCsrfToken, type AuthProfile } from "./lib/api";
import { saveQuizResult } from "./lib/results";
import { ProfilePage } from "./pages/Profile";
import { AdminPage } from "./pages/Admin";
import { ResultsHistory } from "./pages/History";
import { Onboarding } from "./pages/Onboarding";
import { RewardsPage } from "./pages/Rewards";
import { PrivacyPage, TermsPage } from "./pages/Legal";
import { LearnWithAI } from "./pages/Learn";
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "./pages/AccountAccess";
import { AnimatePresence, motion } from "motion/react";

const protectedRoutes: Route[] = [
  "dashboard",
  "personal",
  "learn",
  "hierarchy",
  "generate",
  "flashcards",
  "quiz",
  "results",
  "history",
  "rewards",
  "onboarding",
  "profile",
  "admin",
  "admin-users",
  "admin-admins",
  "admin-missions",
  "admin-promo",
  "admin-submissions",
  "admin-activity",
];

const adminRoutes: Route[] = [
  "admin",
  "admin-users",
  "admin-admins",
  "admin-missions",
  "admin-promo",
  "admin-submissions",
  "admin-activity",
];

/* Page titles. The scaffold shipped `<title>frontend</title>`, and because the
   app routes on the hash the document never reloads — index.html cannot fix it
   per page, so the title is set here on every route change. */
const ROUTE_TITLES: Record<Route, string> = {
  home: "Turn past papers into practice",
  privacy: "Privacy policy",
  terms: "Terms of use",
  dashboard: "Dashboard",
  login: "Sign in",
  signup: "Create your account",
  forgot: "Forgot password",
  reset: "Choose a new password",
  "verify-email": "Verify your email",
  personal: "Practise from my PDF",
  learn: "Learn with AI",
  hierarchy: "Browse courses",
  material: "Material",
  courses: "Courses",
  course: "Course",
  generate: "Generate a study set",
  flashcards: "Flashcards",
  quiz: "Quiz",
  results: "Quiz results",
  history: "Past results",
  rewards: "Rewards",
  onboarding: "Set up your study desk",
  profile: "Profile",
  admin: "Admin overview",
  "admin-users": "Students",
  "admin-admins": "Admins",
  "admin-missions": "Missions",
  "admin-promo": "Promo codes",
  "admin-submissions": "Submissions",
  "admin-activity": "Activity",
};

function adminSection(route: Route): string {
  switch (route) {
    case "admin-users": return "users";
    case "admin-admins": return "admins";
    case "admin-missions": return "missions";
    case "admin-promo": return "promo";
    case "admin-submissions": return "submissions";
    case "admin-activity": return "activity";
    default: return "overview";
  }
}

function routeParts() {
  return window.location.hash.slice(1).split("/");
}

/** Hash segments are only decoded for token links, where a malformed escape
 * must show the "invalid link" screen rather than break the router. */
function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function App() {
  const hashRoute = () => window.location.hash.slice(1).split("/")[0] as Route || "home";
  const hashSub = () => window.location.hash.slice(1).split("/")[1] ?? "";
  const [route, setRoute] = useState<Route>(
    hashRoute(),
  );
  const [sub, setSub] = useState(hashSub());
  const [selectedMaterial, setSelectedMaterial] = useState<RepositoryPaper | null>(null);
  const [generatedSet, setGeneratedSet] = useState<GeneratedSet | null>(null);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number } | null>(null);
  // A warm identity cache means we already know who this is, so the app never
  // shows the "Checking your session..." flash on every reload.
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "anonymous">(hasProfileCache() ? "authenticated" : "checking");
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const routeProgressTimer = useRef<number | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      setRouteLoading(true);
      setRoute(hashRoute());
      setSub(hashSub());
      if (routeProgressTimer.current !== null) window.clearTimeout(routeProgressTimer.current);
      routeProgressTimer.current = window.setTimeout(() => {
        setRouteLoading(false);
        routeProgressTimer.current = null;
      }, 280);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      if (routeProgressTimer.current !== null) window.clearTimeout(routeProgressTimer.current);
    };
  }, []);

  useEffect(() => {
    document.title = `${ROUTE_TITLES[route]} · RecappEdu`;
  }, [route]);

  useEffect(() => {
    // Warm the CSRF token while the page settles: login (the first state-changing
    // request most people make) then skips a whole round trip before its POST.
    prefetchCsrfToken();
    getCurrentProfile()
      .then((result) => {
        setAuthStatus("authenticated");
        setIsAdmin(result.profile.isAdmin);
        setProfile(result.profile);
        if (hashRoute() === "home") go("dashboard");
      })
      .catch((reason: unknown) => {
        setAuthStatus("anonymous");
        setProfile(null);
        // The session check is a background concern, so the message is only shown
        // on the sign-in screen — never as an uncaught error in the console.
        setAuthNotice(errorMessage(reason, "Your session has expired. Please sign in again."));
      });
  }, []);

  const signedIn = (next: AuthProfile) => {
    setProfile(next);
    setIsAdmin(Boolean(next.isAdmin));
    setAuthNotice("");
    setAuthStatus("authenticated");
  };

  const signOut = async () => {
    try { await logout() } catch { /* the cookie is cleared locally either way */ }
    setAuthStatus("anonymous");
    setIsAdmin(false);
    setProfile(null);
    go("home");
  };

  useEffect(() => {
    if (authStatus === "anonymous" && protectedRoutes.includes(route)) {
      go("login");
    }
  }, [authStatus, route]);

  useEffect(() => {
    if (authStatus === "authenticated" && adminRoutes.includes(route) && !isAdmin) go("dashboard");
  }, [authStatus, isAdmin, route]);

  const materialId = route === "material" ? window.location.hash.slice(1).split("/")[1] : undefined;

  /** After a verification link succeeds, replace the cached identity so the
   * resend banner disappears without forcing a full reload. */
  const refreshProfile = async () => {
    invalidateProfileCache();
    try {
      const result = await getCurrentProfile();
      setProfile(result.profile);
      setIsAdmin(Boolean(result.profile.isAdmin));
      setAuthStatus("authenticated");
    } catch { /* the banner stays until the next page load */ }
  };

  useEffect(() => {
    if (route !== "material") return;
    if (!materialId) { go("hierarchy"); return; }
    if (selectedMaterial?.id === materialId) return;
    getRepositoryPaper(materialId).then((result) => setSelectedMaterial(result.paper)).catch(() => go("hierarchy"));
  }, [route, materialId, selectedMaterial]);

  useEffect(() => {
    if (route === "course" || route === "courses") go("hierarchy");
  }, [route]);

  const chooseMaterial = (paper: RepositoryPaper) => {
    setSelectedMaterial(paper);
    go(`material/${encodeURIComponent(paper.id)}`);
  };
  const studentRoutes: Route[] = ["dashboard", "hierarchy", "history", "rewards", "generate", "learn", "flashcards", "quiz", "results", "profile"];
  const showHeader = !["login", "signup", "forgot", "reset", "verify-email", "onboarding", "privacy", "terms", ...studentRoutes].includes(route) && !adminRoutes.includes(route);
  if (authStatus === "checking" && protectedRoutes.includes(route)) {
    return <div className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#612b8250_0,transparent_30%),var(--color-wash)] text-ink grid min-h-screen place-items-center gap-12 text-center text-13 text-muted"><div className="grid min-w-[min(360px,calc(100vw-36px))] justify-items-center gap-7 rounded-12 border border-line bg-white px-24 py-22 shadow-[0_12px_28px_rgba(31,55,92,.06)] [&>strong]:text-14 [&>strong]:text-ink [&>span:last-child]:text-12 [&>span:last-child]:text-muted"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} className="size-28 rounded-8 border-[3px] border-[#454367] border-t-[#b4a6ff]" aria-hidden="true" /><strong>Checking your session</strong><span>Getting your study desk ready…</span></div></div>;
  }

  // Every signed-in destination except the admin board and the study players
  // renders inside the student rail, which is the app's responsive navigation.
  const page = (
    <>
      {route === "home" && <Home />}
      {route === "privacy" && <PrivacyPage />}
      {route === "terms" && <TermsPage />}
      {route === "dashboard" && <Dashboard profile={profile} />}
      {route === "login" && <AuthPage mode="login" onAuthenticated={signedIn} notice={authNotice} />}
      {route === "signup" && <AuthPage mode="signup" onAuthenticated={signedIn} />}
      {route === "forgot" && <ForgotPasswordPage />}
      {route === "reset" && <ResetPasswordPage token={safeDecode(sub)} />}
      {route === "verify-email" && <VerifyEmailPage token={safeDecode(sub)} onVerified={() => void refreshProfile()} />}
      {route === "personal" && <PersonalPractice />}
      {route === "learn" && <LearnWithAI />}
      {route === "hierarchy" && <Hierarchy onMaterial={chooseMaterial} />}
      {route === "material" && (selectedMaterial ? <MaterialDetails paper={selectedMaterial} /> : <div className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#612b8250_0,transparent_30%),var(--color-wash)] text-ink grid min-h-screen place-items-center gap-12 text-center text-13 text-muted"><div className="grid min-w-[min(360px,calc(100vw-36px))] justify-items-center gap-7 rounded-12 border border-line bg-white px-24 py-22 shadow-[0_12px_28px_rgba(31,55,92,.06)] [&>strong]:text-14 [&>strong]:text-ink [&>span:last-child]:text-12 [&>span:last-child]:text-muted"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} className="size-28 rounded-8 border-[3px] border-[#454367] border-t-[#b4a6ff]" aria-hidden="true" /><strong>Loading material</strong><span>Opening the paper details…</span></div></div>)}
      {route === "generate" && (
        <GenerateFlow
          courseId={routeParts()[1]}
          onComplete={(set) => {
            setGeneratedSet(set);
            setQuizResult(null);
            go(set.type === "QUIZ" ? `quiz/${set.id}` : `flashcards/${set.id}`);
          }}
        />
      )}
      {route === "flashcards" && (generatedSet && generatedSet.type === "FLASHCARD" ? (
        <Flashcards set={generatedSet} onExit={() => { setGeneratedSet(null); go("dashboard"); }} />
      ) : (
        <MissingSet back="generate" />
      ))}
      {route === "quiz" && (generatedSet && generatedSet.type === "QUIZ" ? (
        quizResult ? (
          <Results
            set={generatedSet}
            score={quizResult.score}
            total={quizResult.total}
            onRetake={() => { setQuizResult(null); go(`quiz/${generatedSet.id}`); }}
            onBack={() => { setQuizResult(null); setGeneratedSet(null); go("history"); }}
          />
        ) : (
          <Quiz
            set={generatedSet}
            onExit={() => { setQuizResult(null); go("dashboard"); }}
            onCreateNew={() => { setGeneratedSet(null); setQuizResult(null); go("generate"); }}
            onFinish={(score, total) => {
              /* Persist the run locally (offline-safe; this is what the dashboard
                 + history page read) and mirror it to the server, which also
                 feeds the admin activity log. Best-effort: a failed POST must
                 never block the results screen. */
              setQuizResult({ score, total });
              saveQuizResult({
                setId: generatedSet.id,
                title: generatedSet.title,
                score,
                total,
                timePerQuestion: generatedSet.timePerQuestion,
              });
              void recordQuizAttempt(generatedSet.id, { score, total }).catch(() => undefined);
              go("results");
            }}
          />
        )
      ) : (
        <MissingSet back="generate" />
      ))}
      {route === "results" && (generatedSet && generatedSet.type === "QUIZ" && quizResult ? (
        <Results
          set={generatedSet}
          score={quizResult.score}
          total={quizResult.total}
          onRetake={() => { setQuizResult(null); go(`quiz/${generatedSet.id}`); }}
          onBack={() => { setQuizResult(null); setGeneratedSet(null); go("history"); }}
        />
      ) : (
        <MissingSet back="dashboard" />
      ))}
      {route === "history" && <ResultsHistory onPractice={(set) => { setGeneratedSet(set); setQuizResult(null); go(`quiz/${set.id}`); }} />}
      {route === "profile" && <ProfilePage profile={profile} />}
      {route === "rewards" && <RewardsPage />}
      {route === "onboarding" && <Onboarding />}
    </>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#612b8250_0,transparent_32%),var(--color-wash)] text-ink">
      <AnimatePresence>{routeLoading && <motion.div key="route-loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-x-0 top-0 z-[100] h-3 overflow-hidden bg-[#393759]" role="status" aria-label="Loading page"><motion.span className="block h-full w-[40%] bg-gradient-to-r from-violet-400 via-fuchsia-200 to-pink-200 shadow-[0_0_14px_#9b83f5]" initial={{ x: "-100%" }} animate={{ x: "250%" }} transition={{ duration: .8, repeat: Infinity, ease: "easeInOut" }} /></motion.div>}</AnimatePresence>
      {showHeader && <Header route={route} isAdmin={isAdmin} profile={profile} />}
      {!adminRoutes.includes(route) && <AnimatePresence mode="wait" initial={false}><motion.div key={route} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2, ease: "easeOut" }} className="min-h-screen">
        {studentRoutes.includes(route)
          ? <UserShell route={route} sub={sub} profile={profile} isAdmin={isAdmin} onLogout={() => void signOut()}>{page}</UserShell>
          : page}
      </motion.div></AnimatePresence>}
      {adminRoutes.includes(route) && isAdmin && <AdminPage section={adminSection(route)} />}
    </div>
  );
}

function MissingSet({ back }: { back: Route }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#612b8250_0,transparent_30%),var(--color-wash)] text-ink grid min-h-screen place-items-center gap-12 text-center text-13 text-muted">
      <div className="grid min-w-[min(360px,calc(100vw-36px))] justify-items-center gap-7 rounded-12 border border-line bg-white px-24 py-22 shadow-[0_12px_28px_rgba(31,55,92,.06)] [&>strong]:text-14 [&>strong]:text-ink [&>span:last-child]:text-12 [&>span:last-child]:text-muted">
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} className="size-28 rounded-8 border-[3px] border-[#454367] border-t-[#b4a6ff]" aria-hidden="true" />
        <strong>This study set is not loaded on this device.</strong>
        <span>Generate a fresh practice set to continue.</span>
      </div>
      <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go(back)}>Generate a set</button>
    </div>
  );
}

export default App;
