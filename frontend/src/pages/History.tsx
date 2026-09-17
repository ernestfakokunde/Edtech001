import { useEffect, useState } from "react";
import { ArrowRight, Award, CalendarDays, History, Target, Trash2, Trophy } from "lucide-react";
import { go, PageFrame } from "../components/Layout";
import { clearQuizAttempts, deleteQuizAttempt, getQuizAttempts, type QuizAttempt } from "../lib/api";
import { clearQuizResults, deleteQuizResult, getQuizResults, getQuizStats, saveQuizResult, type QuizResultEntry } from "../lib/results";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

type Row = {
  key: string; title: string; courseCode: string;
  score: number; total: number; percent: number; createdAt: string;
  attemptId?: string; localId?: string;
};

function mergeRows(server: QuizAttempt[], local: QuizResultEntry[]): Row[] {
  const seen = new Set<string>();
  const merged: Row[] = [];
  for (const attempt of server) {
    seen.add(`${attempt.setId}-${attempt.score}-${attempt.total}-${attempt.createdAt.slice(0, 16)}`);
    merged.push({
      key: `server-${attempt.id}`, title: attempt.set.title, courseCode: attempt.set.course.code,
      score: attempt.score, total: attempt.total, percent: attempt.percent,
      createdAt: attempt.createdAt, attemptId: attempt.id,
    });
  }
  for (const entry of local) {
    const fingerprint = `${entry.setId}-${entry.score}-${entry.total}-${entry.createdAt.slice(0, 16)}`;
    if (seen.has(fingerprint)) continue;
    merged.push({
      key: `local-${entry.id}`, title: entry.title, courseCode: entry.courseCode ?? "",
      score: entry.score, total: entry.total, percent: entry.percent,
      createdAt: entry.createdAt, localId: entry.id,
    });
  }
  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Past quiz results: server history first, merged with the device copy. */
export function ResultsHistory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ attempts: 0, average: 0, best: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const local = getQuizResults();
    (async () => {
      try {
        const result = await getQuizAttempts(1, 100);
        if (!alive) return;
        for (const attempt of result.attempts) {
          saveQuizResult({
            setId: attempt.setId, title: attempt.set.title,
            courseCode: attempt.set.course.code,
            score: attempt.score, total: attempt.total, createdAt: attempt.createdAt,
          });
        }
        const refreshed = getQuizResults();
        if (!alive) return;
        setRows(mergeRows(result.attempts, refreshed));
        const localStats = getQuizStats();
        setStats({
          attempts: Math.max(result.stats.attempts, localStats.attempts),
          average: result.stats.attempts > 0 ? result.stats.average : localStats.average,
          best: Math.max(result.stats.best, localStats.best),
          streak: localStats.streak,
        });
      } catch {
        if (!alive) return;
        setRows(mergeRows([], local));
        setStats(getQuizStats());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function remove(row: Row) {
    if (row.attemptId) { try { await deleteQuizAttempt(row.attemptId); } catch { /* local still clears */ } }
    if (row.localId) deleteQuizResult(row.localId);
    setRows((current) => current.filter((item) => item.key !== row.key));
    setStats(getQuizStats());
  }

  async function clearAll() {
    if (!window.confirm("Clear all saved quiz results?")) return;
    try { await clearQuizAttempts(); } catch { /* local clear still applies */ }
    clearQuizResults();
    setRows([]);
    setStats({ attempts: 0, average: 0, best: 0, streak: 0 });
  }

  return (
    <PageFrame
      eyebrow="Progress"
      title="Past quiz results"
      subtitle="Every quiz you finish is saved here so you can track your scores over time."
      back="dashboard"
    >
      <div className="history-summary">
        <div><strong>{loading ? "…" : stats.attempts}</strong><span>Quizzes taken</span></div>
        <div><strong>{loading ? "…" : `${stats.average}%`}</strong><span>Average score</span></div>
        <div><strong>{loading ? "…" : `${stats.best}%`}</strong><span>Best score</span></div>
        <div><strong>{loading ? "…" : stats.streak}</strong><span>Day streak</span></div>
      </div>

      {loading ? (
        <div className="history-empty"><strong>Loading your results…</strong></div>
      ) : rows.length === 0 ? (
        <div className="history-empty">
          <History size={22} />
          <strong>No results yet</strong>
          <span>Finish a quiz and it will appear here automatically.</span>
          <div style={{ marginTop: 12 }}>
            <button className="primary-button" onClick={() => go("generate")}>
              Generate a quiz <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="history-list">
            {rows.map((row) => (
              <article className="history-card" key={row.key}>
                <span className={`history-badge ${row.percent >= 70 ? "good" : row.percent < 50 ? "poor" : ""}`}>
                  {row.percent}%
                </span>
                <div>
                  <strong>{row.title}</strong>
                  <small>
                    <CalendarDays size={11} style={{ verticalAlign: "-1px" }} /> {formatDate(row.createdAt)}
                    {" · "}{row.score}/{row.total} correct
                    {row.courseCode ? ` · ${row.courseCode}` : ""}
                  </small>
                </div>
                <button className="ghost-button danger" aria-label={`Delete result ${row.title}`} onClick={() => void remove(row)}>
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={() => go("generate")}>
              <Target size={15} /> New quiz
            </button>
            <button className="ghost-button danger" onClick={() => void clearAll()}>
              Clear history
            </button>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 18, color: "var(--muted)", fontSize: 11 }}>
        <Trophy size={13} /> <span>Tip: scores of 70%+ earn a green badge. Keep your streak alive with one quiz a day.</span>
        <Award size={13} style={{ marginLeft: "auto" }} />
      </div>
    </PageFrame>
  );
}
