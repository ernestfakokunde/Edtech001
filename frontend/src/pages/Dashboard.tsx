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
import { addMyCourse, errorMessage, getGenerationQuota, getMyCourses, getMyXp, getProPricing, startProCheckout, type AuthProfile, type GenerationQuota, type MySchool } from "../lib/api";
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
  const [proPrice, setProPrice] = useState<number | null>(null);
  const [proBusy, setProBusy] = useState(false);
  const [proError, setProError] = useState("");
  const [activePro, setActivePro] = useState(() => isProActive(profile?.tier, profile?.premiumUntil));
  const [quota, setQuota] = useState<GenerationQuota | null>(null);
  useEffect(() => {
    setStats(getQuizStats());
    // Each block is independent and best-effort: a failing call leaves its card
    // in the empty state instead of blanking the whole dashboard.
    getMyCourses()
      .then((result) => { setSchool(result.school); setCourses(result.courses); })
      .catch(() => { /* the courses card falls back to its empty state */ });
    getProPricing().then((price) => setProPrice(price.available ? price.amountNaira : null)).catch(() => undefined);
    getMyXp().then((account) => setActivePro(isProActive(account.tier, account.premiumUntil))).catch(() => undefined);
    getGenerationQuota().then(setQuota).catch(() => undefined);
  }, []);

  async function upgrade() {
    setProError(""); setProBusy(true);
    try { const checkout = await startProCheckout(); window.location.assign(checkout.authorizationUrl); }
    catch (reason) { setProError(errorMessage(reason, "Pro checkout is not available yet.")); setProBusy(false); }
  }

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
    <main className="screen-wrap">
      {firstPractice && (
        <section className="first-practice">
          <div className="first-practice-copy">
            <p className="eyebrow"><Sparkles size={14} /> Start here</p>
            <h2>Create your first practice</h2>
            <p>
              This is what RecappEdu is for: a paper you already have becomes
              practice you can mark yourself — flashcards to flip, or a timed
              quiz that scores you.
            </p>
            <ol className="first-practice-steps">
              <li><span>1</span> Bring a PDF — yours, or one from your course archive</li>
              <li><span>2</span> Choose flashcards or a timed quiz</li>
              <li><span>3</span> Answer, get scored, and watch your streak build</li>
            </ol>
            <div className="first-practice-actions">
              <button className="primary-button" onClick={() => go("generate")}>
                Use my own PDF <ArrowRight size={16} />
              </button>
              <button className="secondary-button" onClick={() => go("hierarchy")}>Find my course</button>
            </div>
          </div>
          <img className="first-practice-art" src={practiceArt} alt="" />
        </section>
      )}

      <section className="dashboard-greeting">
        <p className="eyebrow">Your study desk</p>
        <h1>Welcome back, {displayNameOf(profile)}</h1>
        <p>{school ? `${school.facultyName} · ${school.universityName}` : "Add your school on your profile to file papers by course."}</p>
      </section>

      {!activePro && <section className="dashboard-pro-card">
        <div className="dashboard-pro-icon"><Crown size={20} /></div>
        <div className="dashboard-pro-copy"><span className="eyebrow">RecappEdu Pro</span><h2>Practice without limits</h2><p>Get unlimited quiz generations for 90 days{proPrice !== null ? ` for ${formatProPrice(proPrice)}` : ""}.</p></div>
        <button className="primary-button" disabled={proBusy} onClick={() => void upgrade()}>{proBusy ? "Opening checkout…" : <>Go Pro <ArrowRight size={16} /></>}</button>
        {proError && <small className="dashboard-pro-error">{proError}</small>}
      </section>}
      {quota && quota.limit !== null && <section className={`quota-banner dashboard-quota-banner ${quota.remaining === 0 ? "exhausted" : ""}`}>
        <Sparkles size={14} />
        <span><strong>Free plan:</strong> {quota.remaining} of {quota.limit} quiz generations left today{quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}.</span>
        <button type="button" onClick={() => go(quota.remaining === 0 ? "profile" : "generate")}>{quota.remaining === 0 ? "Upgrade to Pro" : "Practice now"}</button>
      </section>}

      <section className="metric-grid">
        <Metric icon={<Flame size={15} />} value={String(stats.streak)} label="Day streak" tone="amber" />
        <Metric icon={<Layers3 size={15} />} value={String(stats.attempts)} label="Quizzes taken" tone="blue" />
        <Metric icon={<Check size={15} />} value={stats.attempts ? `${stats.average}%` : "—"} label="Avg. quiz score" tone="green" />
      </section>

      <DashboardSection title="Your courses" action="Manage" onAction={() => go("profile")}>
        <div className="dashboard-course-grid">
          {courses.length === 0 ? (
            <div className="dashboard-empty"><BookOpen size={20} /><strong>No course added yet</strong><span>Open the repository to find a paper or add a course on your profile.</span></div>
          ) : (
            courses.slice(0, 4).map((course) => (
              <article className="dashboard-course" key={course.id}>
                <div className="dashboard-course-copy">
                  <strong>{course.code}</strong>
                  <small>{course.title}</small>
                </div>
                <button className="ghost-button dashboard-course-practice" onClick={() => go(`generate/${encodeURIComponent(course.id)}`)}><Sparkles size={14} /> Practice</button>
              </article>
            ))
          )}
          <button className="dashboard-add-course" onClick={() => { setCourseFormOpen((open) => !open); setCourseError(""); }}><span><Plus size={15} /></span><strong>Add a course</strong></button>
        </div>
        {courseFormOpen && <div className="dashboard-inline-course-form">
          {!school && <small>Save your university and faculty on Profile first to organize courses.</small>}
          <input aria-label="Course code" placeholder="Course code e.g. CSC 201" value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} disabled={!school} />
          <input aria-label="Course title" placeholder="Course title e.g. Data Structures" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} disabled={!school} />
          {courseError && <small className="upload-form-error">{courseError}</small>}
          <div><button className="secondary-button" onClick={() => setCourseFormOpen(false)}>Cancel</button>{school ? <button className="primary-button" disabled={savingCourse || courses.length >= 10} onClick={() => void saveCourse()}>{savingCourse ? "Saving…" : "Save course"}</button> : <button className="primary-button" onClick={() => go("profile")}>Go to profile</button>}</div>
        </div>}
        {courseMessage && <p className="dashboard-course-message">{courseMessage}</p>}
        {courseError && !courseFormOpen && <p className="upload-form-error">{courseError}</p>}
      </DashboardSection>

      <section className="dashboard-quick-actions">
        <button onClick={() => go("generate")}><Sparkles size={16} /><span><strong>Create from my PDF</strong><small>Private AI practice set</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("hierarchy")}><FileText size={16} /><span><strong>Browse course repository</strong><small>Find papers by course</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("history")}><History size={16} /><span><strong>My quizzes</strong><small>Saved quizzes and answer keys</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("rewards")}><Sparkles size={16} /><span><strong>Rewards</strong><small>XP, invites and promo codes</small></span><ArrowRight size={16} /></button>
      </section>
    </main>
  );
}

function isProActive(tier?: "FREE" | "PREMIUM", premiumUntil?: string | null) {
  return tier === "PREMIUM" && (!premiumUntil || new Date(premiumUntil).getTime() > Date.now());
}

function formatProPrice(naira: number) {
  const nairaLabel = `₦${naira.toLocaleString()}`;
  const usdLabel = `$${((naira / 1000) * 0.7).toFixed(2)}`;
  return `${nairaLabel} (about ${usdLabel})`;
}

function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: string }) { return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function DashboardSection({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) { return <section className="dashboard-section"><div className="dashboard-section-head"><h2>{title}</h2><button onClick={onAction}>{action}</button></div>{children}</section>; }
