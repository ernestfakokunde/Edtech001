export type Route =
  | "home"
  | "dashboard"
  | "login"
  | "signup"
  | "personal"
  | "hierarchy"
  | "material"
  | "courses"
  | "course"
  | "generate"
  | "flashcards"
  | "quiz"
  | "results"
  | "history"
  | "profile"
  | "admin";
export type Mode = "flashcards" | "quiz";
export type Course = {
  id?: string;
  code: string;
  title: string;
  papers: number;
  tone: string;
};
export type Paper = {
  id: string;
  title: string;
  detail: string;
  status: string;
  description?: string;
  level?: string;
  course?: string;
};
