import {
  ArrowRight,
  BookOpen,
  FileText,
  History,
  Plus,
  Sparkles,
  Crown,
  Trophy,
  Zap,
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
    <main className="mx-auto min-w-0 w-full max-w-[1180px] overflow-x-hidden px-[clamp(20px,4vw,40px)] pt-36 pb-56 max-860:px-[clamp(16px,4vw,24px)] max-860:pt-28 max-860:pb-48 max-680:px-18 [&_h1]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere]">
      {firstPractice && (
        <section className="panel mb-24 grid grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] items-center gap-24 overflow-hidden max-760:grid-cols-1 max-760:p-18">
          <div className="min-w-0">
            <p className="eyebrow"><Sparkles size={14} /> Start here</p>
            <h2 className="m-0 mb-8 font-grotesk text-[clamp(22px,3vw,29px)] leading-[1.15] tracking-[-.02em]">Create your first practice</h2>
            <p className="m-0 max-w-[560px] text-13 leading-170 text-muted">
              This is what RecappEdu is for: your notes or an exam PDF become
              practice you can mark yourself — flashcards to flip, or a timed
              quiz that scores you.
            </p>
            <ol className="m-0 mt-16 grid list-none gap-8 p-0">
              {[
                "Bring a PDF — yours, or one from your course archive",
                "Choose flashcards or a timed quiz",
                "Answer, get scored, and watch your streak build",
              ].map((step, index) => (
                <li key={step} className="flex items-center gap-9 text-12 leading-145 text-muted">
                  <span className="grid size-20 shrink-0 place-items-center rounded-half border border-brand/40 font-grotesk text-10 font-bold text-brand">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-20 flex flex-wrap gap-9">
              <button className="btn btn-primary btn-sm" onClick={() => go("generate")}>
                Use my own PDF <ArrowRight size={15} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => go("hierarchy")}>Find my course</button>
            </div>
          </div>
          <img className="h-full max-h-[220px] w-full rounded-16 border border-line object-cover shadow-card -rotate-[1.5deg] max-760:hidden" src={practiceArt} alt="" />
        </section>
      )}

      <section className="mb-20 mt-8">
        <p className="eyebrow">Your study desk</p>
        <h1 className="m-0 mb-6 text-[clamp(24px,3vw,32px)] leading-[1.15] tracking-[-.03em]">Welcome back, {displayNameOf(profile)}</h1>
        <p className="m-0 text-13 text-muted">{school ? `${school.facultyName} · ${school.universityName}` : "Add your school on your profile to organize PDFs by course."}</p>
      </section>

      {!activePro && (
        <section className="notice notice-info mb-18 flex-wrap items-center gap-14">
          <span className="grid size-42 shrink-0 place-items-center rounded-13 bg-brand text-[var(--theme-on-brand)]"><Crown size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-3">RecappEdu Pro</p>
            <h2 className="m-0 font-grotesk text-17 font-bold text-ink">Practice without limits</h2>
            <p className="m-0 mt-3 text-12 font-normal leading-150 text-muted">Get 100 AI credits monthly with Basic: ₦499 for month one, then ₦999/month.</p>
          </div>
          <button className="btn btn-primary btn-sm shrink-0 max-[640px]:w-full" onClick={() => go("profile")}>Choose a plan <ArrowRight size={15} /></button>
        </section>
      )}
      {quota && quota.limit !== null && (
        <section className={`notice ${quota.remaining === 0 ? "notice-warning" : "notice-info"} mb-20 items-center`}>
          <Sparkles size={15} className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">
            <strong>{quota.tier.replace("_", " ")} plan:</strong> {quota.remaining} of {quota.limit} AI credits left this month{quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleDateString()}` : ""}.
          </span>
          <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => go(quota.remaining === 0 ? "profile" : "generate")}>{quota.remaining === 0 ? "View plans" : "Practice now"}</button>
        </section>
      )}

      <section className="stat-grid mb-26">
        <Metric icon={<Zap size={19} />} value={String(stats.streak)} label="Day streak" tone="amber" />
        <Metric icon={<BookOpen size={19} />} value={String(stats.attempts)} label="Quizzes taken" tone="brand" />
        <Metric icon={<Trophy size={19} />} value={stats.attempts ? `${stats.average}%` : "—"} label="Avg. quiz score" tone="green" />
      </section>

      <DashboardSection title="Your courses" action="Manage" onAction={() => go("profile")}>
        <div className="grid min-w-0 grid-cols-2 gap-14 max-860:grid-cols-1">
          {courses.length === 0 ? (
            <div className="empty-state min-h-[170px]">
              <BookOpen size={22} />
              <strong>No course added yet</strong>
              <span>Browse course PDFs or add a course on your profile.</span>
            </div>
          ) : (
            courses.slice(0, 4).map((course) => (
              <article className="flex min-h-[160px] min-w-0 flex-col items-stretch rounded-15 border border-line bg-surface p-17 transition-colors hover:border-outline" key={course.id}>
                <div className="grid min-w-0 gap-4">
                  <strong className="font-grotesk text-18 font-bold leading-[1.25] text-ink">{course.code}</strong>
                  <small className="overflow-hidden text-ellipsis whitespace-nowrap text-13 text-muted">{course.title}</small>
                </div>
                <button className="btn btn-secondary btn-sm mt-auto w-full" onClick={() => go(`generate/${encodeURIComponent(course.id)}`)}><Sparkles size={14} /> Practice</button>
              </article>
            ))
          )}
          <button className="flex min-h-[170px] flex-col items-center justify-center gap-9 rounded-16 border-[1.5px] border-dashed border-outline bg-surface p-16 text-12 font-semibold text-brand transition-colors hover:border-brand hover:bg-pale" onClick={() => { setCourseFormOpen((open) => !open); setCourseError(""); }}>
            <span className="grid size-34 place-items-center rounded-10 bg-pale"><Plus size={20} /></span>
            <strong>Add a course</strong>
          </button>
        </div>
        {courseFormOpen && (
          <div className="mt-12 grid grid-cols-[1fr_1.4fr_auto] items-center gap-9 rounded-14 border border-line bg-surface p-14 max-[600px]:grid-cols-1">
            {!school && <small className="col-span-full text-11 text-muted max-[600px]:col-auto">Save your university and faculty on Profile first to organize courses.</small>}
            <input className="field-input" aria-label="Course code" placeholder="Course code e.g. CSC 201" value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} disabled={!school} />
            <input className="field-input" aria-label="Course title" placeholder="Course title e.g. Data Structures" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} disabled={!school} />
            {courseError && <small className="danger text-11">{courseError}</small>}
            <div className="flex justify-end gap-8 max-[600px]:justify-stretch max-[600px]:[&>button]:flex-1">
              <button className="btn btn-secondary btn-sm" onClick={() => setCourseFormOpen(false)}>Cancel</button>
              {school
                ? <button className="btn btn-primary btn-sm" disabled={savingCourse || courses.length >= 10} onClick={() => void saveCourse()}>{savingCourse ? "Saving…" : "Save course"}</button>
                : <button className="btn btn-primary btn-sm" onClick={() => go("profile")}>Go to profile</button>}
            </div>
          </div>
        )}
        {courseMessage && <p className="m-0 mt-9 text-12 font-semibold text-success-deep">{courseMessage}</p>}
        {courseError && !courseFormOpen && <p className="m-0 mt-9 text-12 text-danger">{courseError}</p>}
      </DashboardSection>

      <section className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-10 max-680:grid-cols-1">
        <QuickLink icon={<Sparkles size={19} />} title="Create from my PDF" meta="Private AI practice set" onClick={() => go("generate")} />
        <QuickLink icon={<FileText size={19} />} title="Browse course library" meta="Find PDFs by course" onClick={() => go("hierarchy")} />
        <QuickLink icon={<History size={19} />} title="My quizzes" meta="Saved quizzes and answer keys" onClick={() => go("history")} />
        <QuickLink icon={<Sparkles size={19} />} title="Rewards" meta="XP, invites and promo codes" onClick={() => go("rewards")} />
      </section>
    </main>
  );
}

function isProActive(tier?: "FREE" | "PREMIUM", premiumUntil?: string | null) {
  return tier === "PREMIUM" && (!premiumUntil || new Date(premiumUntil).getTime() > Date.now());
}

function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: string }) {
  const toneClass = tone === "amber" ? "bg-warning-surface text-warning" : tone === "green" ? "bg-success-soft text-success-icon" : "bg-pale text-brand";
  return (
    <div className="metric-card">
      <span className={`metric-icon ${toneClass}`}>{icon}</span>
      <div className="min-w-0">
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function DashboardSection({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return (
    <section className="mb-29">
      <div className="mb-13 flex items-center justify-between gap-12">
        <h2 className="m-0 font-grotesk text-17 tracking-[-.02em]">{title}</h2>
        <button className="btn btn-ghost btn-sm -mx-6" onClick={onAction}>{action}</button>
      </div>
      {children}
    </section>
  );
}

function QuickLink({ icon, title, meta, onClick }: { icon: React.ReactNode; title: string; meta: string; onClick: () => void }) {
  return (
    <button className="group flex w-full items-center gap-12 rounded-14 border border-line bg-surface px-16 py-14 text-left transition-colors hover:border-outline hover:bg-pale" onClick={onClick}>
      <span className="grid size-36 shrink-0 place-items-center rounded-10 bg-pale text-brand transition-colors group-hover:bg-surface">{icon}</span>
      <span className="min-w-0 flex-1">
        <strong className="block text-12 font-semibold text-ink">{title}</strong>
        <small className="mt-2 block text-11 text-muted">{meta}</small>
      </span>
      <ArrowRight size={17} className="shrink-0 text-muted" />
    </button>
  );
}
