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
        <div className="no-print mb-22 -mt-12 flex justify-between gap-10 max-760:flex-col">
          <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 no-print" onClick={() => setSelected(null)}><ArrowLeft size={15} /> My quizzes</button>
          <div className="flex flex-wrap gap-8">
            <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => window.print()}><ArrowDownToLine size={15} /> Save as PDF</button>
            <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none no-print" onClick={() => onPractice(selected)}><Sparkles size={15} /> Take quiz</button>
          </div>
        </div>
        <section className="rounded-18 border border-line bg-white px-28 py-24" id="quiz-print-document">
          <header className="mb-24 border-b border-line pb-18 [&>span]:text-10 [&>span]:font-extrabold [&>span]:tracking-[.13em] [&>span]:text-brand [&>h1]:my-8 [&>h1]:text-26 [&>p]:m-0 [&>p]:text-12 [&>p]:text-muted">
            <span>RECAPPEDU · QUIZ ANSWER KEY</span>
            <h1>{selected.course.code}: {selected.course.title}</h1>
            <p>{selected.title} · {formatDate(selected.createdAt)}</p>
          </header>
          {selected.items.map(({ position, question }) => {
            const options = question.metadata?.options ?? [];
            return (
              <article className="break-inside-avoid border-b border-line py-18 last:border-b-0 [&>h2]:mb-12 [&>h2]:mt-0 [&>h2]:text-15 [&>h2]:font-bold [&>h2]:leading-150 [&>h2]:tracking-normal [&>ol]:mb-13 [&>ol]:grid [&>ol]:gap-5 [&>ol]:pl-25 [&>ol]:text-12 [&>ol]:leading-150 [&>ol]:text-slate-600 [&>p]:mt-7 [&>p]:text-12 [&>p]:leading-160 [&_h2_span]:text-brand" key={question.id}>
                <h2><span>{position + 1}.</span> {question.prompt}</h2>
                {options.length > 0 && <ol type="A">{options.map((option) => <li key={option}>{option}</li>)}</ol>}
                <p className="mt-7 text-12 leading-160"><strong>Answer:</strong> {question.answer}</p>
                {question.explanation && <p className="mt-7 text-12 leading-160 text-muted">{question.explanation}</p>}
              </article>
            );
          })}
        </section>
      </PageFrame>
    );
  }

  return (
    <PageFrame eyebrow="Your library" title="My quizzes" subtitle="Every quiz you create is saved here with its questions and answers." back="dashboard">
      {error && <p className="rounded-11 bg-red-50 px-14 py-12 text-13 text-red-800" role="alert">{error}</p>}
      {loading ? (
        <div className="grid min-h-[220px] place-content-center justify-items-center gap-10 rounded-18 border border-dashed border-[#c7c9ed] bg-white p-26 text-center text-13 text-muted [&>svg]:text-brand [&>strong]:text-17 [&>strong]:font-bold [&>strong]:text-ink [&>span]:max-w-[430px] [&>span]:leading-160"><Loader2 size={20} className="animate-spin" /> Loading your quizzes…</div>
      ) : quizzes.length === 0 ? (
        <div className="grid min-h-[220px] place-content-center justify-items-center gap-10 rounded-18 border border-dashed border-[#c7c9ed] bg-white p-26 text-center text-13 text-muted [&>svg]:text-brand [&>strong]:text-17 [&>strong]:font-bold [&>strong]:text-ink [&>span]:max-w-[430px] [&>span]:leading-160">
          <BookOpenCheck size={25} />
          <strong>Your quizzes will be saved here</strong>
          <span>Create a quiz from one of your course PDFs to keep the questions and answers in your library.</span>
          <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go("generate")}><Sparkles size={15} /> Create a quiz</button>
        </div>
      ) : (
        <div className="grid gap-10">
          {quizzes.map((quiz) => (
            <article className="flex items-center gap-14 rounded-16 border border-line bg-white p-16 shadow-[0_6px_18px_#20244a06] max-760:flex-wrap" key={quiz.id}>
              <span className="grid size-42 shrink-0 place-items-center rounded-13 bg-pale text-brand"><CircleHelp size={19} /></span>
              <div className="grid min-w-0 flex-1 gap-5 max-760:basis-[calc(100%-60px)] [&>strong]:overflow-hidden [&>strong]:text-14 [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>strong]:text-ink [&>strong_span]:text-muted [&>small]:text-11 [&>small]:text-muted">
                <strong>{quiz.course.code} <span>·</span> {quiz.course.title}</strong>
                <small>{quiz.items.length} questions <span>·</span> Created {formatDate(quiz.createdAt)}</small>
                {quiz.attempts[0] && <small className="!text-brand-deep !font-bold">Last score: {quiz.attempts[0].percent}%</small>}
              </div>
              <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 max-760:w-full" onClick={() => setSelected(quiz)}>Open answer key <ArrowRight size={14} /></button>
            </article>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
