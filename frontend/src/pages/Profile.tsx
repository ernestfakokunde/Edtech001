import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, ChevronRight, Crown, GraduationCap, Plus, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { PageFrame, displayNameOf, go, initialsOf } from "../components/Layout";
import {
  addMyCourse, deleteAccount, errorMessage, getCurrentProfile, getMyCourses, removeMyCourse, saveMySchool, updateProfile, type AuthProfile, getPaymentStatus, startPlanCheckout,
} from "../lib/api";
import type { MySchool, SavedCourse } from "../lib/api";

const MAX_SAVED_COURSES = 10;
type ProfileTab = "personal" | "school" | "plans" | "account";

const inputClass = "min-h-44 w-full rounded-10 border border-line bg-surface px-12 text-12 text-ink outline-none transition focus:border-outline focus:shadow-focus disabled:bg-pale disabled:text-slate-icon";
const buttonClass = "inline-flex min-h-40 items-center justify-center gap-7 rounded-9 bg-brand px-14 text-12 font-bold text-white transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50";

function SectionCard({ icon, eyebrow, title, description, children, className = "" }: { icon: ReactNode; eyebrow?: string; title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`profile-card ${className}`}>
      <header className="profile-card-heading">
        <span className="profile-card-icon">{icon}</span>
        <div className="min-w-0">
          {eyebrow && <p className="profile-eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function ProfilePage({ profile: initialProfile = null }: { profile?: AuthProfile | null }) {
  const [profile, setProfile] = useState(() => ({
    displayName: initialProfile?.displayName ?? "",
    username: initialProfile?.username ?? "",
    email: initialProfile?.email ?? "",
    tier: (initialProfile?.tier ?? "FREE") as "FREE" | "PREMIUM",
    premiumUntil: initialProfile?.premiumUntil ?? null,
  }));
  const [school, setSchool] = useState<MySchool>(null);
  const [schoolForm, setSchoolForm] = useState({ universityName: "", facultyName: "" });
  const [courses, setCourses] = useState<SavedCourse[]>([]);
  const [courseForm, setCourseForm] = useState({ code: "", title: "" });
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [proBusy, setProBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"BASIC" | "STUDENT_PLUS" | "PREMIUM">("BASIC");
  const [tab, setTab] = useState<ProfileTab>("personal");

  useEffect(() => {
    getCurrentProfile().then((result) => setProfile({
      displayName: result.profile.displayName ?? "",
      username: result.profile.username ?? "",
      email: result.profile.email ?? "",
      tier: result.profile.tier ?? "FREE",
      premiumUntil: result.profile.premiumUntil ?? null,
    })).catch(() => setError("Could not load your profile."));
    getMyCourses().then((result) => {
      setSchool(result.school);
      setSchoolForm(result.school ? { universityName: result.school.universityName, facultyName: result.school.facultyName } : { universityName: "", facultyName: "" });
      setCourses(result.courses);
    }).catch(() => setError("Could not load your school details."));
    const match = `${window.location.search}&${window.location.hash}`.match(/[?&]reference=([^&]+)/);
    if (match) {
      getPaymentStatus(decodeURIComponent(match[1])).then((result) => {
        if (result.status === "SUCCESS") {
          setProfile((current) => ({ ...current, tier: result.tier ?? "FREE", premiumUntil: result.premiumUntil ?? null }));
          setMessage("Your monthly plan is active.");
        } else if (result.status === "PENDING") setMessage("Payment received. Your plan access will appear as soon as confirmation completes.");
        else setError("That payment was not completed. You can try again.");
      }).catch(() => setMessage("We’re checking your payment. Refresh this page shortly."));
    }
  }, []);

  function reportSuccess(text: string) { setError(""); setMessage(text); }

  async function upgradeToPro() {
    setError(""); setProBusy(true);
    try { const result = await startPlanCheckout(selectedPlan); window.location.assign(result.authorizationUrl); }
    catch (reason) { setError(errorMessage(reason, "Could not start checkout. Please try again.")); setProBusy(false); }
  }

  async function saveProfile() {
    try {
      const result = await updateProfile({ displayName: profile.displayName, username: profile.username });
      setProfile((current) => ({ ...current, displayName: result.profile.displayName ?? "", username: result.profile.username ?? "" }));
      reportSuccess("Profile saved.");
    } catch (reason) { setError(errorMessage(reason, "Could not save your profile.")); }
  }

  async function saveSchool() {
    if (!schoolForm.universityName.trim()) { setError("Enter your university name."); return; }
    try {
      const result = await saveMySchool({ universityName: schoolForm.universityName.trim(), facultyName: schoolForm.facultyName.trim() });
      setSchool(result.school);
      setSchoolForm({ universityName: result.school.universityName, facultyName: result.school.facultyName });
      reportSuccess("School details saved.");
    } catch (reason) { setError(errorMessage(reason, "Could not save your school.")); }
  }

  async function addCourse() {
    if (!courseForm.code.trim() || !courseForm.title.trim()) { setError("Enter the course code and title."); return; }
    try {
      const result = await addMyCourse({ code: courseForm.code.trim(), title: courseForm.title.trim() });
      setCourses((current) => current.some((item) => item.id === result.course.id) ? current : [...current, result.course]);
      setCourseForm({ code: "", title: "" });
      reportSuccess(`${result.course.code} added to your courses.`);
    } catch (reason) { setError(errorMessage(reason, "Could not save the course.")); }
  }

  async function removeCourse(courseId: string) {
    try {
      await removeMyCourse(courseId);
      setCourses((current) => current.filter((item) => item.id !== courseId));
      reportSuccess("Course removed from your list.");
    } catch (reason) { setError(errorMessage(reason, "Could not remove the course.")); }
  }

  async function confirmDeletion() {
    if (deleteConfirm.trim().toLowerCase() !== "delete") { setError("Type the word “delete” to confirm."); return; }
    setDeleting(true);
    try { await deleteAccount(deleteConfirm); window.location.hash = "home"; }
    catch (reason) { setError(errorMessage(reason, "Could not delete your account.")); setDeleting(false); }
  }

  const activePlan = isProActive(profile.tier, profile.premiumUntil);
  const name = displayNameOf(profile);

  return (
    <PageFrame eyebrow="Account" title="Your profile" subtitle="Keep your account, study context, and plan in one place." back="dashboard">
      <div className="profile-page w-full max-w-[1020px]">
        <section className="profile-identity">
          <div className="profile-monogram">{initialsOf(profile)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-9">
              <h2 className="truncate">{name}</h2>
              <span className={`profile-tier-chip ${activePlan ? "pro" : ""}`}>{tierLabel(profile.tier, profile.premiumUntil)}</span>
            </div>
            <p>{profile.email}</p>
            <small>{profile.username ? `@${profile.username}` : "Add a username to make your profile easier to find."}</small>
          </div>
          <button className={`${buttonClass} max-560:w-full`} onClick={() => setTab("personal")}><UserRound size={15} /> Edit profile</button>
        </section>

        <nav className="profile-tabs" aria-label="Profile sections">
          {([
            ["personal", "Personal"],
            ["school", "School & courses"],
            ["plans", "Plans"],
            ["account", "Account"],
          ] as [ProfileTab, string][]).map(([key, label]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>

        {(message || error) && <p className={`profile-notice ${error ? "error" : "success"}`}>{error || message}</p>}

        {tab === "personal" && (
          <div className="profile-content-grid">
            <SectionCard icon={<UserRound size={18} />} eyebrow="Personal" title="Personal information" description="The details used across your RecappEdu account.">
              <div className="profile-form-grid">
                <label><span>Display name</span><input className={inputClass} value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="How should we call you?" /></label>
                <label><span>Username</span><input className={inputClass} value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="e.g. ernest_ade" /><small>3–24 lowercase letters, numbers, or underscores.</small></label>
                <label className="wide"><span>Email</span><input className={inputClass} value={profile.email} disabled /></label>
              </div>
              <div className="profile-card-actions"><button className={buttonClass} onClick={() => void saveProfile()}><Save size={15} /> Save changes</button></div>
            </SectionCard>
            <SectionCard icon={<GraduationCap size={18} />} eyebrow="Study context" title="Your learning setup" description={school ? `${school.universityName}${school.facultyName ? ` · ${school.facultyName}` : ""}` : "Add your school and courses to personalise your study space."}>
              <button className="profile-link-row" onClick={() => setTab("school")}><span>{school ? "Manage school and courses" : "Add school details"}</span><ChevronRight size={16} /></button>
              <button className="profile-link-row" onClick={() => setTab("plans")}><span>{activePlan ? "View your active plan" : "See monthly AI credit plans"}</span><ChevronRight size={16} /></button>
            </SectionCard>
          </div>
        )}

        {tab === "school" && (
          <div className="profile-content-grid">
            <SectionCard icon={<GraduationCap size={18} />} eyebrow="Optional" title="School details" description="Used to organise your course repository and study materials.">
              <div className="profile-form-grid">
                <label><span>University</span><input className={inputClass} value={schoolForm.universityName} onChange={(event) => setSchoolForm({ ...schoolForm, universityName: event.target.value })} placeholder="e.g. University of Lagos" /></label>
                <label><span>Faculty</span><input className={inputClass} value={schoolForm.facultyName} onChange={(event) => setSchoolForm({ ...schoolForm, facultyName: event.target.value })} placeholder="e.g. Faculty of Science" /></label>
              </div>
              <div className="profile-card-actions"><button className={buttonClass} onClick={() => void saveSchool()}><Save size={15} /> {school ? "Update details" : "Save details"}</button></div>
            </SectionCard>
            <SectionCard icon={<BookOpen size={18} />} eyebrow={`${courses.length} of ${MAX_SAVED_COURSES}`} title="Saved courses" description="Quick access to the courses you study most.">
              <div className="profile-add-course"><input className={inputClass} value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} placeholder="Course code" /><input className={inputClass} value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Course title" /><button className={buttonClass} onClick={() => void addCourse()} disabled={courses.length >= MAX_SAVED_COURSES}><Plus size={15} /> Add</button></div>
              {courses.length > 0 ? <ul className="profile-course-list">{courses.map((course) => <li key={course.id}><span><strong>{course.code}</strong><small>{course.title}</small></span><button aria-label={`Remove ${course.code}`} onClick={() => void removeCourse(course.id)}><Trash2 size={15} /></button></li>)}</ul> : <p className="profile-empty">No saved courses yet.</p>}
            </SectionCard>
          </div>
        )}

        {tab === "plans" && (
          <SectionCard icon={<Crown size={18} />} eyebrow="Monthly access" title="Plans & AI credits" description="One shared monthly allowance covers Learn with AI, quizzes, and flashcards.">
            <div className="profile-plan-summary"><strong>{activePlan ? tierLabel(profile.tier, profile.premiumUntil) : "Free plan"}</strong><span>{activePlan ? "Your paid access is active." : "You currently have 20 monthly AI credits."}</span></div>
            <div className="profile-plan-list">
              <div><strong>Basic</strong><span>100 credits · ₦499 launch / ₦999 monthly</span></div>
              <div><strong>Student Plus</strong><span>300 credits · ₦999 launch / ₦1,999 monthly</span></div>
              <div><strong>Premium</strong><span>600 credits · ₦1,499 launch / ₦2,999 monthly</span></div>
            </div>
            <div className="profile-plan-controls"><label>Choose a monthly plan<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as typeof selectedPlan)}><option value="BASIC">Basic</option><option value="STUDENT_PLUS">Student Plus</option><option value="PREMIUM">Premium</option></select></label><button className={buttonClass} disabled={proBusy} onClick={() => void upgradeToPro()}><Crown size={15} /> {proBusy ? "Opening checkout…" : "Continue to Paystack"}</button></div>
          </SectionCard>
        )}

        {tab === "account" && (
          <div className="profile-content-grid">
            <SectionCard icon={<ShieldCheck size={18} />} eyebrow="Your information" title="Privacy and terms" description="Read how your account and study materials are handled.">
              <div className="profile-card-actions"><button className="secondary-button" onClick={() => go("privacy")}>Privacy policy</button><button className="secondary-button" onClick={() => go("terms")}>Terms of use</button></div>
            </SectionCard>
            <SectionCard icon={<Trash2 size={18} />} eyebrow="Irreversible" title="Delete account" description="This removes your profile and associated personal data.">
              <div className="profile-delete-row"><input className={inputClass} value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder='Type "delete" to confirm' /><button className="profile-danger-button" disabled={deleting} onClick={() => void confirmDeletion()}>{deleting ? "Deleting…" : "Delete account"}</button></div>
            </SectionCard>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

function tierLabel(tier: "FREE" | "PREMIUM", premiumUntil: string | null) {
  const until = premiumUntil ? new Date(premiumUntil) : null;
  if (until && until > new Date()) return `Pro until ${until.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return tier === "PREMIUM" && !premiumUntil ? "Pro" : "Free";
}

function isProActive(tier: "FREE" | "PREMIUM", premiumUntil: string | null) {
  return tier === "PREMIUM" && (!premiumUntil || new Date(premiumUntil).getTime() > Date.now());
}
