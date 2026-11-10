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
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_50%_0%,#e9eaff_0,transparent_48%),#f7f8fc] px-18 py-28">
      <div className="w-[min(100%,610px)] rounded-[24px] border border-line bg-white p-[clamp(24px,5vw,46px)] shadow-[0_24px_70px_#25245d12]">
        <div className="mb-35 flex items-center gap-10 font-grotesk text-16 font-extrabold"><span className="grid size-34 place-items-center rounded-11 bg-brand text-white"><GraduationCap size={19} /></span> RecappEdu <span className="ml-auto text-[9px] font-bold tracking-[.1em] text-muted">SETUP · 1 MIN</span></div>
        <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">A little setup, then you’re in</p>
        <h1 className="m-0 text-[clamp(29px,5vw,38px)] leading-[1.12]">Make RecappEdu yours.</h1>
        <p className="mb-25 mt-11 text-13 leading-[1.65] text-muted">Add courses if you like, or skip this and start practising right away. You can organize your courses later.</p>
        <section className="mt-24 rounded-15 border border-[#eaebf2] bg-[#fafaff] p-17">
          <div className="mb-13 flex items-center gap-10"><span className="grid size-32 place-items-center rounded-10 bg-pale text-brand"><BookOpen size={16} /></span><div><strong className="block text-12">Add your courses</strong><small className="mt-3 block text-10 text-muted">Optional · you can do this later</small></div></div>
          <div className="grid grid-cols-[.8fr_1.2fr_auto] gap-7 max-760:grid-cols-1"><input className="min-h-40 min-w-0 w-full rounded-10 border border-[#e2e5ef] bg-white px-12 text-12 outline-none focus:border-outline focus:shadow-focus" value={course.code} onChange={(event) => setCourse({ ...course, code: event.target.value })} placeholder="Course code" /><input className="min-h-40 min-w-0 w-full rounded-10 border border-[#e2e5ef] bg-white px-12 text-12 outline-none focus:border-outline focus:shadow-focus" value={course.title} onChange={(event) => setCourse({ ...course, title: event.target.value })} placeholder="Course name" /><button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 max-760:justify-self-start" onClick={addCourse} type="button" aria-label="Add course"><Plus size={16} /></button></div>
          {courses.map((item, index) => <div className="mt-8 flex justify-between gap-10 rounded-9 border border-[#eaebf2] bg-white px-10 py-8 text-11 text-slate-600" key={`${item.code}-${index}`}><span><strong className="text-[#312e81]">{item.code}</strong> · {item.title}</span><button onClick={() => setCourses((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.code}`}><X size={14} /></button></div>)}
        </section>
        {error && <p className="mb-0 mt-12 text-12 text-danger" role="alert">{error}</p>}
        <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none mt-20 w-full" disabled={saving} onClick={() => void finish()}>{saving ? <><Loader2 size={16} className="animate-spin" /> Saving setup…</> : <>Continue to study desk <ArrowRight size={16} /></>}</button>
        <button className="mx-auto mt-14 flex items-center justify-center gap-6 text-12 font-semibold text-slate-600" disabled={saving} onClick={() => go("dashboard")}><SkipForward size={14} /> Skip for now</button>
        <p className="mb-0 mt-20 text-center text-10 leading-150 text-slate-icon">Your school details help organize your study materials. You can update them from your profile.</p>
      </div>
    </main>
  );
}
