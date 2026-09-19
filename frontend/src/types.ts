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
  | "admin"
  | "admin-users"
  | "admin-admins"
  | "admin-missions"
  | "admin-promo"
  | "admin-submissions"
  | "admin-activity";
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
