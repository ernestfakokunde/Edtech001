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
} from "./pages/Study";
import { getRepositoryPaper, type RepositoryPaper } from "./lib/api";
import type { Route } from "./types";
import { getCurrentProfile, logout } from "./lib/api";
import { ProfilePage } from "./pages/Profile";
import { AdminPage } from "./pages/Admin";

const protectedRoutes: Route[] = [
  "dashboard",
  "personal",
  "hierarchy",
  "profile",
  "admin",
];

function App() {
  const hashRoute = () => window.location.hash.slice(1).split("/")[0] as Route || "home";
  const [route, setRoute] = useState<Route>(
    hashRoute(),
  );
  const [selectedMaterial, setSelectedMaterial] = useState<RepositoryPaper | null>(null);
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
      {route === "profile" && <ProfilePage />}
      {route === "admin" && isAdmin && <AdminPage />}
      {showFooter && <Footer />}
    </div>
  );
}

export default App;
