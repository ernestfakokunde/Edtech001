import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpenCheck, CircleHelp, Loader2, Sparkles } from "lucide-react";
import { PageFrame, go } from "../components/Layout";
import { errorMessage, getSavedQuizzes, type GeneratedSet, type SavedQuiz } from "../lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** The quiz library: generated quizzes and their saved answer keys. */
export function ResultsHistory({ onPractice }: { onPractice: (set: GeneratedSet) => void }) {
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [selected, setSelected] = useState<SavedQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getSavedQuizzes()
      .then(({ sets }) => { if (alive) setQuizzes(sets); })
      .catch((reason: unknown) => { if (alive) setError(errorMessage(reason, "Could not load your saved quizzes.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (selected) {
    return (
      <PageFrame eyebrow={`${selected.course.code} · ${selected.course.title}`} title={selected.title} subtitle={`${selected.items.length} questions · Created ${formatDate(selected.createdAt)}`}>
        <div className="saved-quiz-actions no-print">
          <button className="secondary-button" onClick={() => setSelected(null)}><ArrowLeft size={15} /> My quizzes</button>
          <div>
            <button className="secondary-button" onClick={() => window.print()}><ArrowDownToLine size={15} /> Save as PDF</button>
            <button className="primary-button" onClick={() => onPractice(selected)}><Sparkles size={15} /> Take quiz</button>
          </div>
        </div>
        <section className="quiz-print-document" id="quiz-print-document">
          <header className="quiz-print-heading">
            <span>RECAPPEDU · QUIZ ANSWER KEY</span>
            <h1>{selected.course.code}: {selected.course.title}</h1>
            <p>{selected.title} · {formatDate(selected.createdAt)}</p>
          </header>
          {selected.items.map(({ position, question }) => {
            const options = question.metadata?.options ?? [];
            return (
              <article className="saved-question" key={question.id}>
                <h2><span>{position + 1}.</span> {question.prompt}</h2>
                {options.length > 0 && <ol type="A">{options.map((option) => <li key={option}>{option}</li>)}</ol>}
                <p className="saved-answer"><strong>Answer:</strong> {question.answer}</p>
                {question.explanation && <p className="saved-explanation">{question.explanation}</p>}
              </article>
            );
          })}
        </section>
      </PageFrame>
    );
  }

  return (
    <PageFrame eyebrow="Your library" title="My quizzes" subtitle="Every quiz you create is saved here with its questions and answers." back="dashboard">
      {error && <p className="saved-quiz-error" role="alert">{error}</p>}
      {loading ? (
        <div className="saved-quiz-empty"><Loader2 size={20} className="spin" /> Loading your quizzes…</div>
      ) : quizzes.length === 0 ? (
        <div className="saved-quiz-empty">
          <BookOpenCheck size={25} />
          <strong>Your quizzes will be saved here</strong>
          <span>Create a quiz from one of your course PDFs to keep the questions and answers in your library.</span>
          <button className="primary-button" onClick={() => go("generate")}><Sparkles size={15} /> Create a quiz</button>
        </div>
      ) : (
        <div className="saved-quiz-list">
          {quizzes.map((quiz) => (
            <article className="saved-quiz-card" key={quiz.id}>
              <span className="saved-quiz-icon"><CircleHelp size={19} /></span>
              <div className="saved-quiz-info">
                <strong>{quiz.course.code} <span>·</span> {quiz.course.title}</strong>
                <small>{quiz.items.length} questions <span>·</span> Created {formatDate(quiz.createdAt)}</small>
                {quiz.attempts[0] && <small className="saved-quiz-score">Last score: {quiz.attempts[0].percent}%</small>}
              </div>
              <button className="secondary-button" onClick={() => setSelected(quiz)}>Open answer key <ArrowRight size={14} /></button>
            </article>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
