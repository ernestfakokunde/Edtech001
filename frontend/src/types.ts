export type Route =
  | "home"
  | "dashboard"
  | "login"
  | "signup"
  | "forgot"
  | "reset"
  | "verify-email"
  | "personal"
  | "hierarchy"
  | "material"
  | "courses"
  | "course"
  | "generate"
  | "paper"
  | "learn"
  | "flashcards"
  | "quiz"
  | "theory"
  | "results"
  | "history"
  | "rewards"
  | "leaderboard"
  | "onboarding"
  | "profile"
  | "privacy"
  | "terms"
  | "admin"
  | "admin-users"
  | "admin-admins"
  | "admin-missions"
  | "admin-promo"
  | "admin-submissions"
  | "admin-activity"
  | "admin-ai";
export type Mode = "flashcards" | "quiz" | "theory";
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
