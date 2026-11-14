import { useState } from "react";
import { ArrowRight, BookOpen, GraduationCap, Loader2, Plus, SkipForward, X } from "lucide-react";
import { addMyCourse, errorMessage } from "../lib/api";
import { go } from "../components/Layout";

export function Onboarding() {
  const [courses, setCourses] = useState<{ code: string; title: string }[]>([]);
  const [course, setCourse] = useState({ code: "", title: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addCourse() {
    setError("");
    if (!course.code.trim() || !course.title.trim()) { setError("Add both a course code and name."); return; }
    if (courses.length >= 10) { setError("You can add up to 10 courses."); return; }
    setCourses((items) => [...items, { code: course.code.trim().toUpperCase(), title: course.title.trim() }]);
    setCourse({ code: "", title: "" });
  }

  async function finish() {
    setSaving(true); setError("");
    try {
      for (const item of courses) await addMyCourse(item);
      go("dashboard");
    } catch (reason) {
      setError(errorMessage(reason, "Could not save your setup. Please try again."));
    } finally { setSaving(false); }
  }

  return (
    <main className="app-canvas grid place-items-center px-18 py-28">
      <div className="panel w-[min(100%,610px)] rounded-[24px] p-[clamp(24px,5vw,46px)]">
        <div className="mb-30 flex items-center gap-10 font-grotesk text-16 font-extrabold">
          <span className="grid size-34 place-items-center rounded-11 bg-brand text-[var(--theme-on-brand)]"><GraduationCap size={19} /></span>
          RecappEdu
          <span className="ml-auto text-10 font-bold tracking-[.1em] text-muted">SETUP · 1 MIN</span>
        </div>
        <p className="eyebrow">A little setup, then you’re in</p>
        <h1 className="m-0 text-[clamp(29px,5vw,38px)] leading-[1.12] tracking-[-.03em]">Make RecappEdu yours.</h1>
        <p className="mb-24 mt-10 text-13 leading-[1.65] text-muted">Add courses if you like, or skip this and start practising right away. You can organize your courses later.</p>
        <section className="mt-24 rounded-16 border border-line bg-wash p-17">
          <div className="mb-13 flex items-center gap-10">
            <span className="grid size-32 place-items-center rounded-10 bg-pale text-brand"><BookOpen size={16} /></span>
            <div><strong className="block text-12 text-ink">Add your courses</strong><small className="mt-3 block text-10 text-muted">Optional · you can do this later</small></div>
          </div>
          <div className="grid grid-cols-[.8fr_1.2fr_auto] gap-7 max-760:grid-cols-1">
            <input className="field-input min-w-0" value={course.code} onChange={(event) => setCourse({ ...course, code: event.target.value })} placeholder="Course code" aria-label="Course code" />
            <input className="field-input min-w-0" value={course.title} onChange={(event) => setCourse({ ...course, title: event.target.value })} placeholder="Course name" aria-label="Course name" />
            <button className="btn btn-secondary btn-sm max-760:justify-self-start" onClick={addCourse} type="button" aria-label="Add course"><Plus size={16} /></button>
          </div>
          {courses.map((item, index) => (
            <div className="mt-8 flex items-center justify-between gap-10 rounded-9 border border-line bg-surface px-10 py-8 text-11 text-muted" key={`${item.code}-${index}`}>
              <span className="min-w-0 truncate"><strong className="text-brand">{item.code}</strong> · {item.title}</span>
              <button className="shrink-0 text-muted transition-colors hover:text-danger" onClick={() => setCourses((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.code}`}><X size={14} /></button>
            </div>
          ))}
        </section>
        {error && <p className="notice notice-error mt-12" role="alert">{error}</p>}
        <button className="btn btn-primary mt-20 w-full" disabled={saving} onClick={() => void finish()}>{saving ? <><Loader2 size={16} className="animate-spin" /> Saving setup…</> : <>Continue to study desk <ArrowRight size={16} /></>}</button>
        <button className="btn btn-ghost mx-auto mt-10" disabled={saving} onClick={() => go("dashboard")}><SkipForward size={14} /> Skip for now</button>
        <p className="mb-0 mt-16 text-center text-10 leading-150 text-slate-icon">Your school details help organize your study materials. You can update them from your profile.</p>
      </div>
    </main>
  );
}
