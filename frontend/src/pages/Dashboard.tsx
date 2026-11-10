import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Flame,
  History,
  Layers3,
  Plus,
  Sparkles,
  Crown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { displayNameOf, go } from "../components/Layout";
import { addMyCourse, errorMessage, getGenerationQuota, getMyCourses, getMyXp, type AuthProfile, type GenerationQuota, type MySchool } from "../lib/api";
import { getQuizStats } from "../lib/results";
import practiceArt from "../assets/brand1.png";

/* Student study desk. */
export function Dashboard({ profile }: { profile: AuthProfile | null }) {
  const [stats, setStats] = useState({ attempts: 0, average: 0, best: 0, streak: 0 });
  const [school, setSchool] = useState<MySchool>(null);
  const [courses, setCourses] = useState<{ id: string; code: string; title: string }[]>([]);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ code: "", title: "" });
  const [courseMessage, setCourseMessage] = useState("");
  const [courseError, setCourseError] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);
  const [activePro, setActivePro] = useState(() => isProActive(profile?.tier, profile?.premiumUntil));
  const [quota, setQuota] = useState<GenerationQuota | null>(null);
  useEffect(() => {
    setStats(getQuizStats());
    // Each block is independent and best-effort: a failing call leaves its card
    // in the empty state instead of blanking the whole dashboard.
    getMyCourses()
      .then((result) => { setSchool(result.school); setCourses(result.courses); })
      .catch(() => { /* the courses card falls back to its empty state */ });
    getMyXp().then((account) => setActivePro(isProActive(account.tier, account.premiumUntil))).catch(() => undefined);
    getGenerationQuota().then(setQuota).catch(() => undefined);
  }, []);

  /* Nothing has been practised on this device yet, so the desk opens with the
     one thing the product is for. It retires itself after the first saved quiz
     (`stats.attempts` comes from lib/results). */
  const firstPractice = stats.attempts === 0;

  async function saveCourse() {
    setCourseError(""); setCourseMessage("");
    if (!courseForm.code.trim() || !courseForm.title.trim()) { setCourseError("Enter the course code and title."); return; }
    setSavingCourse(true);
    try {
      const result = await addMyCourse({ code: courseForm.code.trim(), title: courseForm.title.trim() });
      setCourses((current) => current.some((item) => item.id === result.course.id) ? current : [...current, result.course]);
      setCourseForm({ code: "", title: "" }); setCourseFormOpen(false); setCourseMessage(`${result.course.code} added.`);
    } catch (reason) { setCourseError(errorMessage(reason, "Could not save the course.")); }
    finally { setSavingCourse(false); }
  }

  return (
    <main className="mx-auto w-full max-w-[1020px] px-[clamp(20px,4vw,40px)] pt-44 pb-64 max-860:px-[clamp(16px,4vw,24px)] max-860:pt-32 max-860:pb-56 max-680:min-w-0 max-680:px-18 [&_h1]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere]">
      {firstPractice && (
        <section className="mb-8 grid grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)] items-center gap-28 overflow-hidden rounded-20 bg-[linear-gradient(145deg,#173c9e,#1d4ed8_62%,#477ce0)] px-[clamp(22px,3vw,38px)] py-30 shadow-[0_22px_40px_#1d4ed833] max-760:grid-cols-1 max-760:rounded-20 max-760:px-20 max-760:py-24">
          <div className="max-w-[560px] text-white [&_.eyebrow]:mb-10 [&_.eyebrow]:text-blue-200 [&_h2]:mb-10 [&_h2]:text-[clamp(24px,3vw,32px)] [&>p:not(.eyebrow)]:m-0 [&>p:not(.eyebrow)]:text-13 [&>p:not(.eyebrow)]:leading-170 [&>p:not(.eyebrow)]:text-blue-100">
            <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand"><Sparkles size={14} /> Start here</p>
            <h2>Create your first practice</h2>
            <p>
              This is what RecappEdu is for: your notes or an exam PDF become
              practice you can mark yourself — flashcards to flip, or a timed
              quiz that scores you.
            </p>
            <ol className="mt-18 grid list-none gap-8 p-0 [&>li]:flex [&>li]:items-center [&>li]:gap-9 [&>li]:text-12 [&>li]:text-blue-100 [&_li_span]:grid [&_li_span]:size-20 [&_li_span]:shrink-0 [&_li_span]:place-items-center [&_li_span]:rounded-full [&_li_span]:bg-white/15 [&_li_span]:font-grotesk [&_li_span]:text-10 [&_li_span]:font-bold">
              <li><span>1</span> Bring a PDF — yours, or one from your course archive</li>
              <li><span>2</span> Choose flashcards or a timed quiz</li>
              <li><span>3</span> Answer, get scored, and watch your streak build</li>
            </ol>
            <div className="mt-22 flex flex-wrap gap-10 [&_.primary-button]:bg-white [&_.primary-button]:text-brand [&_.primary-button]:shadow-lg [&_.secondary-button]:border-white/35 [&_.secondary-button]:bg-white/10 [&_.secondary-button]:text-white hover:[&_.secondary-button]:bg-white/20">
              <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go("generate")}>
                Use my own PDF <ArrowRight size={16} />
              </button>
              <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => go("hierarchy")}>Find my course</button>
            </div>
          </div>
          <img className="h-full max-h-[224px] w-full rounded-16 border border-white/15 object-cover shadow-[0_18px_30px_#0f172a3d] -rotate-[1.5deg] max-760:hidden" src={practiceArt} alt="" />
        </section>
      )}

      <section className="mt-47 mb-23 [&>.eyebrow]:mb-12 [&>h1]:mb-5 [&>h1]:mt-0 [&>h1]:text-[clamp(24px,3vw,32px)] [&>p:last-child]:m-0 [&>p:last-child]:text-13 [&>p:last-child]:text-muted">
        <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Your study desk</p>
        <h1>Welcome back, {displayNameOf(profile)}</h1>
        <p>{school ? `${school.facultyName} · ${school.universityName}` : "Add your school on your profile to organize PDFs by course."}</p>
      </section>

      {!activePro && <section className="mb-22 flex items-center gap-17 rounded-18 border border-[#cddcff] bg-[linear-gradient(110deg,#eef4ff,#fafbff_70%)] px-22 py-20 shadow-[0_10px_28px_#1d4ed80c] max-[640px]:flex-wrap max-[640px]:items-start [&>.primary-button]:shrink-0 max-[640px]:[&>.primary-button]:w-full">
        <div className="grid size-44 shrink-0 place-items-center rounded-14 bg-[#2858dc] text-white"><Crown size={20} /></div>
        <div className="flex-1 max-[640px]:min-w-[calc(100%-65px)] [&_.eyebrow]:mb-4 [&_.eyebrow]:text-10 [&_.eyebrow]:font-extrabold [&_.eyebrow]:uppercase [&_.eyebrow]:tracking-[.08em] [&_.eyebrow]:text-[#315bca] [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-18 [&_h2]:font-bold [&_h2]:text-ink [&_p]:mb-0 [&_p]:mt-4 [&_p]:text-12 [&_p]:text-muted"><span className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">RecappEdu Pro</span><h2>Practice without limits</h2><p>Get 50 AI credits monthly with Basic: ₦499 for month one, then ₦999/month.</p></div>
        <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)]" onClick={() => go("profile")}>Choose a plan <ArrowRight size={16} /></button>
      </section>}
      {quota && quota.limit !== null && <section className={`-mb-[8px] mt-[-8px] mb-24 flex flex-wrap items-center gap-8 rounded-11 border border-[#dbeafe] bg-[#f8fbff] px-13 py-11 text-11 text-brand [&>span]:min-w-0 [&>span]:flex-[1_1_240px] [&>span]:leading-[1.5] [&>button]:ml-auto [&>button]:flex-none [&>button]:cursor-pointer [&>button]:rounded-8 [&>button]:border-0 [&>button]:bg-[#2858dc] [&>button]:px-12 [&>button]:py-7 [&>button]:text-11 [&>button]:font-bold [&>button]:text-white ${quota.remaining === 0 ? "border-amber-200 bg-amber-50 text-warning" : ""}`}>
        <Sparkles size={14} />
        <span><strong>{quota.tier.replace("_", " ")} plan:</strong> {quota.remaining} of {quota.limit} AI credits left this month{quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleDateString()}` : ""}.</span>
        <button type="button" onClick={() => go(quota.remaining === 0 ? "profile" : "generate")}>{quota.remaining === 0 ? "View plans" : "Practice now"}</button>
      </section>}

      <section className="mb-31 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-10 max-760:gap-14">
        <Metric icon={<Flame size={15} />} value={String(stats.streak)} label="Day streak" tone="amber" />
        <Metric icon={<Layers3 size={15} />} value={String(stats.attempts)} label="Quizzes taken" tone="blue" />
        <Metric icon={<Check size={15} />} value={stats.attempts ? `${stats.average}%` : "—"} label="Avg. quiz score" tone="green" />
      </section>

      <DashboardSection title="Your courses" action="Manage" onAction={() => go("profile")}>
        <div className="grid grid-cols-2 gap-18 max-760:gap-14 max-680:grid-cols-1">
          {courses.length === 0 ? (
            <div className="grid min-h-[145px] place-content-center justify-items-center gap-7 rounded-16 border border-dashed border-[#bfdbfe] bg-[#f8fbff] p-18 text-center text-muted [&>svg]:text-brand [&>strong]:font-grotesk [&>strong]:text-14 [&>strong]:text-ink [&>span]:text-11"><BookOpen size={20} /><strong>No course added yet</strong><span>Browse course PDFs or add a course on your profile.</span></div>
          ) : (
            courses.slice(0, 4).map((course) => (
              <article className="flex min-h-[145px] flex-col items-stretch rounded-15 border border-line bg-white p-16 text-left hover:border-outline" key={course.id}>
                <div className="grid min-w-0 gap-4 [&>strong]:font-grotesk [&>strong]:text-18 [&>strong]:font-bold [&>strong]:leading-[1.25] [&>strong]:text-ink [&>small]:overflow-hidden [&>small]:text-ellipsis [&>small]:whitespace-nowrap [&>small]:text-13 [&>small]:text-muted">
                  <strong>{course.code}</strong>
                  <small>{course.title}</small>
                </div>
                <button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50 mt-5 min-h-44 w-full justify-center" onClick={() => go(`generate/${encodeURIComponent(course.id)}`)}><Sparkles size={14} /> Practice</button>
              </article>
            ))
          )}
          <button className="flex min-h-[145px] flex-col items-center justify-center gap-9 rounded-16 border-[1.5px] border-dashed border-outline bg-[#f8fbff] p-16 text-12 text-brand hover:border-brand hover:bg-pale [&>span]:grid [&>span]:size-32 [&>span]:place-items-center [&>span]:rounded-9 [&>span]:bg-pale" onClick={() => { setCourseFormOpen((open) => !open); setCourseError(""); }}><span><Plus size={15} /></span><strong>Add a course</strong></button>
        </div>
        {courseFormOpen && <div className="mt-12 grid grid-cols-[1fr_1.4fr_auto] items-center gap-9 rounded-14 border border-line bg-white p-14 max-[600px]:grid-cols-1 [&>input]:h-40 [&>input]:min-w-0 [&>input]:rounded-9 [&>input]:border [&>input]:border-line [&>input]:bg-white [&>input]:px-11 [&>input]:text-12 [&>small]:col-span-full [&>small]:text-11 [&>small]:text-muted max-[600px]:[&>small]:col-auto [&>div]:flex [&>div]:justify-end [&>div]:gap-8">
          {!school && <small>Save your university and faculty on Profile first to organize courses.</small>}
          <input aria-label="Course code" placeholder="Course code e.g. CSC 201" value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} disabled={!school} />
          <input aria-label="Course title" placeholder="Course title e.g. Data Structures" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} disabled={!school} />
          {courseError && <small className="upload-form-error">{courseError}</small>}
          <div><button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setCourseFormOpen(false)}>Cancel</button>{school ? <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={savingCourse || courses.length >= 10} onClick={() => void saveCourse()}>{savingCourse ? "Saving…" : "Save course"}</button> : <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go("profile")}>Go to profile</button>}</div>
        </div>}
        {courseMessage && <p className="mt-9 text-12 text-green-700">{courseMessage}</p>}
        {courseError && !courseFormOpen && <p className="upload-form-error">{courseError}</p>}
      </DashboardSection>

      <section className="mt-34 grid gap-9 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-12 [&_button]:rounded-13 [&_button]:border [&_button]:border-[#bfdbfe] [&_button]:bg-[#f8fbff] [&_button]:px-16 [&_button]:py-14 [&_button]:text-left [&_button]:text-brand [&_button_span]:flex-1 [&_button_strong]:block [&_button_strong]:text-12 [&_button_strong]:text-ink [&_button_small]:mt-3 [&_button_small]:block [&_button_small]:text-10 [&_button_small]:text-muted">
        <button onClick={() => go("generate")}><Sparkles size={16} /><span><strong>Create from my PDF</strong><small>Private AI practice set</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("hierarchy")}><FileText size={16} /><span><strong>Browse course library</strong><small>Find PDFs by course</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("history")}><History size={16} /><span><strong>My quizzes</strong><small>Saved quizzes and answer keys</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("rewards")}><Sparkles size={16} /><span><strong>Rewards</strong><small>XP, invites and promo codes</small></span><ArrowRight size={16} /></button>
      </section>
    </main>
  );
}

function isProActive(tier?: "FREE" | "PREMIUM", premiumUntil?: string | null) {
  return tier === "PREMIUM" && (!premiumUntil || new Date(premiumUntil).getTime() > Date.now());
}


function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: string }) { return <div className="min-h-[124px] rounded-16 border border-line bg-white px-18 py-14 max-760:px-12 max-760:py-13 [&>span]:mb-12 [&>span]:block [&>strong]:block [&>strong]:font-grotesk [&>strong]:text-[20px] [&>strong]:font-bold [&>small]:mt-2 [&>small]:block [&>small]:text-11 [&>small]:text-slate-icon"><span className={`mb-12 grid size-30 place-items-center rounded-9 ${tone === "amber" ? "bg-[#fef3c7] text-[#d97706]" : tone === "green" ? "bg-[#ecfdf5] text-[#059669]" : "bg-pale text-brand"}`}>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function DashboardSection({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) { return <section className="mb-29"><div className="mb-13 flex items-center justify-between [&>h2]:m-0 [&>h2]:text-16 [&>h2]:tracking-[-.02em] [&>button]:text-12 [&>button]:font-bold [&>button]:text-brand"><h2>{title}</h2><button onClick={onAction}>{action}</button></div>{children}</section>; }
