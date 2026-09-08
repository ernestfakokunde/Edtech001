import { useEffect, useState } from "react";
import "./App.css";
import { Header, Footer, go } from "./components/Layout";
import { Home } from "./pages/Home";
import { AuthPage } from "./pages/Auth";
import {
  CoursePage,
  CourseSelection,
  Flashcards,
  Generate,
  Hierarchy,
  PersonalPractice,
  Quiz,
  Results,
} from "./pages/Study";
import { courses, papers } from "./data";
import type { Course, Mode, Paper, Route } from "./types";

function App() {
  const [route, setRoute] = useState<Route>(
    (window.location.hash.slice(1) as Route) || "home",
  );
  const [selectedCourse, setSelectedCourse] = useState<Course>(courses[0]);
  const [selectedPaper, setSelectedPaper] = useState<Paper>(papers[0]);
  const [mode, setMode] = useState<Mode>("flashcards");
  const [length, setLength] = useState("30");
  const [isUploaded, setIsUploaded] = useState(false);

  useEffect(() => {
    const onHashChange = () =>
      setRoute((window.location.hash.slice(1) as Route) || "home");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const chooseCourse = (course: Course) => {
    setSelectedCourse(course);
    go("course");
  };
  const beginGeneration = () =>
    go(mode === "flashcards" ? "flashcards" : "quiz");
  const showHeader = !["login", "signup", "flashcards", "quiz"].includes(route);
  const showFooter = ["home", "hierarchy", "courses"].includes(route);

  return (
    <div className="app-shell">
      {showHeader && <Header route={route} />}
      {route === "home" && <Home />}
      {route === "login" && <AuthPage mode="login" />}
      {route === "signup" && <AuthPage mode="signup" />}
      {route === "personal" && <PersonalPractice />}
      {route === "hierarchy" && <Hierarchy onCourse={chooseCourse} />}
      {route === "courses" && <CourseSelection onCourse={chooseCourse} />}
      {route === "course" && (
        <CoursePage
          course={selectedCourse}
          uploaded={isUploaded}
          onUpload={() => setIsUploaded(true)}
          onGenerate={(paper) => {
            setSelectedPaper(paper);
            go("generate");
          }}
        />
      )}
      {route === "generate" && (
        <Generate
          course={selectedCourse}
          paper={selectedPaper}
          mode={mode}
          length={length}
          onMode={setMode}
          onLength={setLength}
          onGenerate={beginGeneration}
        />
      )}
      {route === "flashcards" && (
        <Flashcards
          onExit={() => go("course")}
          onQuiz={() => {
            setMode("quiz");
            go("quiz");
          }}
        />
      )}
      {route === "quiz" && (
        <Quiz onExit={() => go("course")} onFinish={() => go("results")} />
      )}
      {route === "results" && (
        <Results
          course={selectedCourse}
          onRetake={() => go("quiz")}
          onBack={() => go("course")}
        />
      )}
      {showFooter && <Footer />}
    </div>
  );
}

export default App;
