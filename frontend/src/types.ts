export type Route =
  | "home"
  | "dashboard"
  | "login"
  | "signup"
  | "personal"
  | "hierarchy"
  | "courses"
  | "course"
  | "generate"
  | "flashcards"
  | "quiz"
  | "results";
export type Mode = "flashcards" | "quiz";
export type Course = {
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
};
