export type QuizResultEntry = {
  id: string;
  setId: string;
  title: string;
  courseCode?: string;
  score: number;
  total: number;
  percent: number;
  timePerQuestion?: number | null;
  createdAt: string;
};

const STORAGE_KEY = "recappedu_quiz_results_v1";
const MAX_STORED = 60;

function safeParse(raw: string | null): QuizResultEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QuizResultEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.score === "number" &&
        typeof entry.total === "number" &&
        typeof entry.title === "string",
    );
  } catch {
    return [];
  }
}

export function getQuizResults(): QuizResultEntry[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function saveQuizResult(entry: Omit<QuizResultEntry, "id" | "createdAt" | "percent"> & { createdAt?: string }): QuizResultEntry {
  const record: QuizResultEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    percent: entry.total > 0 ? Math.round((entry.score / entry.total) * 100) : 0,
  };
  if (typeof localStorage !== "undefined") {
    const next = [record, ...safeParse(localStorage.getItem(STORAGE_KEY))].slice(0, MAX_STORED);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked — history is best-effort */
    }
  }
  return record;
}

export function deleteQuizResult(id: string) {
  if (typeof localStorage === "undefined") return;
  const next = safeParse(localStorage.getItem(STORAGE_KEY)).filter((entry) => entry.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearQuizResults() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getQuizStats() {
  const results = getQuizResults();
  if (results.length === 0) return { attempts: 0, average: 0, best: 0, streak: 0 };
  const average = Math.round(results.reduce((sum, r) => sum + r.percent, 0) / results.length);
  const best = Math.max(...results.map((r) => r.percent));
  // Simple streak: consecutive days with at least one attempt, ending today/yesterday.
  const days = new Set(results.map((r) => r.createdAt.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { attempts: results.length, average, best, streak };
}
