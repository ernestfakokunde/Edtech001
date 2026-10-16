import { useState } from "react";
import { ArrowRight, BookOpen, GraduationCap, Loader2, Plus, SkipForward, X } from "lucide-react";
import { addMyCourse, errorMessage, saveMySchool } from "../lib/api";
import { go } from "../components/Layout";

export function Onboarding() {
  const [universityName, setUniversityName] = useState("");
  const [facultyName, setFacultyName] = useState("");
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
    if (!universityName.trim()) { setError("Enter your university to continue."); return; }
    setSaving(true); setError("");
    try {
      await saveMySchool({ universityName: universityName.trim(), ...(facultyName.trim() ? { facultyName: facultyName.trim() } : {}) });
      for (const item of courses) await addMyCourse(item);
      go("dashboard");
    } catch (reason) {
      setError(errorMessage(reason, "Could not save your setup. Please try again."));
    } finally { setSaving(false); }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-brand"><span className="onboarding-mark"><GraduationCap size={19} /></span> RecappEdu <span className="onboarding-step">SETUP · 1 MIN</span></div>
        <p className="eyebrow">A little setup, then you’re in</p>
        <h1>Make RecappEdu yours.</h1>
        <p className="onboarding-intro">Add your university so we can organize your papers and courses. You can change these details any time.</p>
        <label className="onboarding-field"><span>University <b>Required</b></span><input autoFocus value={universityName} onChange={(event) => setUniversityName(event.target.value)} placeholder="e.g. University of Lagos" /></label>
        <label className="onboarding-field"><span>Faculty <b>Optional</b></span><input value={facultyName} onChange={(event) => setFacultyName(event.target.value)} placeholder="e.g. Faculty of Science" /></label>
        <section className="onboarding-courses">
          <div className="onboarding-course-heading"><span className="onboarding-course-icon"><BookOpen size={16} /></span><div><strong>Add your courses</strong><small>Optional · you can do this later</small></div></div>
          <div className="onboarding-course-form"><input value={course.code} onChange={(event) => setCourse({ ...course, code: event.target.value })} placeholder="Course code" /><input value={course.title} onChange={(event) => setCourse({ ...course, title: event.target.value })} placeholder="Course name" /><button className="secondary-button" onClick={addCourse} type="button" aria-label="Add course"><Plus size={16} /></button></div>
          {courses.map((item, index) => <div className="onboarding-course-added" key={`${item.code}-${index}`}><span><strong>{item.code}</strong> · {item.title}</span><button onClick={() => setCourses((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.code}`}><X size={14} /></button></div>)}
        </section>
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <button className="primary-button onboarding-continue" disabled={saving} onClick={() => void finish()}>{saving ? <><Loader2 size={16} className="spin" /> Saving setup…</> : <>Continue to study desk <ArrowRight size={16} /></>}</button>
        <button className="onboarding-skip" disabled={saving} onClick={() => go("dashboard")}><SkipForward size={14} /> Skip for now</button>
        <p className="onboarding-privacy">Your school details help organize your study materials. You can update them from your profile.</p>
      </div>
    </main>
  );
}
