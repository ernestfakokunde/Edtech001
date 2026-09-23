import { useEffect, useState } from "react";
import "./App.css";
import { Header, Footer, UserShell, go } from "./components/Layout";
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
import { errorMessage, getCurrentProfile, hasProfileCache, logout, prefetchCsrfToken, type AuthProfile } from "./lib/api";
import { saveQuizResult } from "./lib/results";
import { ProfilePage } from "./pages/Profile";
import { AdminPage } from "./pages/Admin";
import { ResultsHistory } from "./pages/History";

const protectedRoutes: Route[] = [
  "dashboard",
  "personal",
  "hierarchy",
  "generate",
  "flashcards",
  "quiz",
  "results",
  "history",
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

  useEffect(() => {
    const onHashChange = () => {
      setRoute(hashRoute());
      setSub(hashSub());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
  const studentRoutes: Route[] = ["dashboard", "hierarchy", "history", "generate", "flashcards", "quiz", "results", "profile"];
  const showHeader = !["login", "signup", ...studentRoutes].includes(route) && !adminRoutes.includes(route);
  // The rail replaces the old standalone dashboard top line, so the dashboard
  // no longer shows the global header — and its footer never made sense there.
  const showFooter = ["home", "hierarchy", "courses"].includes(route);

  if (authStatus === "checking" && protectedRoutes.includes(route)) {
    return <div className="app-shell auth-loading"><span>Checking your session...</span></div>;
  }

  // Every signed-in destination except the admin board and the study players
  // renders inside the student rail, which is the app's responsive navigation.
  const page = (
    <>
      {route === "home" && <Home />}
      {route === "dashboard" && <Dashboard profile={profile} />}
      {route === "login" && <AuthPage mode="login" onAuthenticated={signedIn} notice={authNotice} />}
      {route === "signup" && <AuthPage mode="signup" onAuthenticated={signedIn} />}
      {route === "personal" && <PersonalPractice />}
      {route === "hierarchy" && <Hierarchy onMaterial={chooseMaterial} />}
      {route === "material" && (selectedMaterial ? <MaterialDetails paper={selectedMaterial} /> : <div className="app-shell auth-loading"><span>Loading material...</span></div>)}
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
      {route === "history" && <ResultsHistory />}
      {route === "profile" && <ProfilePage section={sub} profile={profile} />}
    </>
  );

  return (
    <div className="app-shell">
      {showHeader && <Header route={route} isAdmin={isAdmin} profile={profile} />}
      {studentRoutes.includes(route)
        ? <UserShell route={route} sub={sub} profile={profile} isAdmin={isAdmin} onLogout={() => void signOut()}>{page}</UserShell>
        : page}
      {adminRoutes.includes(route) && isAdmin && <AdminPage section={adminSection(route)} />}
      {showFooter && <Footer />}
    </div>
  );
}

function MissingSet({ back }: { back: Route }) {
  return (
    <div className="app-shell auth-loading">
      <span>This study set is not loaded on this device.</span>
      <button className="primary-button" onClick={() => go(back)}>Generate a set</button>
    </div>
  );
}

export default App;
