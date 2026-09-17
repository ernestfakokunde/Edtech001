import { useEffect, useState } from "react";
import "./App.css";
import { Header, Footer, go } from "./components/Layout";
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
import { getCurrentProfile, logout } from "./lib/api";
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
];

function routeParts() {
  return window.location.hash.slice(1).split("/");
}

function App() {
  const hashRoute = () => window.location.hash.slice(1).split("/")[0] as Route || "home";
  const [route, setRoute] = useState<Route>(
    hashRoute(),
  );
  const [selectedMaterial, setSelectedMaterial] = useState<RepositoryPaper | null>(null);
  const [generatedSet, setGeneratedSet] = useState<GeneratedSet | null>(null);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number } | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "anonymous">("checking");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const onHashChange = () =>
      setRoute(hashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    getCurrentProfile()
      .then((result) => {
        setAuthStatus("authenticated");
        setIsAdmin(result.profile.isAdmin);
        if (hashRoute() === "home") go("dashboard");
      })
      .catch(() => setAuthStatus("anonymous"));
  }, []);

  useEffect(() => {
    if (authStatus === "anonymous" && protectedRoutes.includes(route)) {
      go("login");
    }
  }, [authStatus, route]);

  useEffect(() => {
    if (authStatus === "authenticated" && route === "admin" && !isAdmin) go("dashboard");
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
  const showHeader = !["login", "signup", "dashboard"].includes(route);
  const showFooter = ["home", "hierarchy", "courses"].includes(route);

  if (authStatus === "checking" && protectedRoutes.includes(route)) {
    return <div className="app-shell auth-loading"><span>Checking your session...</span></div>;
  }

  return (
    <div className="app-shell">
      {showHeader && <Header route={route} isAdmin={isAdmin} />}
      {route === "home" && <Home />}
      {route === "dashboard" && <Dashboard isAdmin={isAdmin} onLogout={async () => { try { await logout(); } finally { setAuthStatus("anonymous"); setIsAdmin(false); go("home"); } }} />}
      {route === "login" && <AuthPage mode="login" onAuthenticated={() => setAuthStatus("authenticated")} />}
      {route === "signup" && <AuthPage mode="signup" onAuthenticated={() => setAuthStatus("authenticated")} />}
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
      {route === "profile" && <ProfilePage />}
      {route === "admin" && isAdmin && <AdminPage />}
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
