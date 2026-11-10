import { useEffect, useState } from "react";
import { BookOpen, Check, GraduationCap, Plus, Save, Trash2, UserRound, Sparkles, Loader2, Crown } from "lucide-react";
import { PageFrame, go } from "../components/Layout";
import {
  addMyCourse, deleteAccount, errorMessage, getCurrentProfile, getMyCourses, removeMyCourse, saveMySchool, updateProfile, type AuthProfile, getPaymentStatus, startPlanCheckout,
} from "../lib/api";
import type { MySchool, SavedCourse } from "../lib/api";

// Same per-student cap the backend enforces on POST /api/profile/courses.
const MAX_SAVED_COURSES = 10;

export function ProfilePage({ profile: initialProfile = null }: { profile?: AuthProfile | null }) {
  const [profile, setProfile] = useState(() => ({
    displayName: initialProfile?.displayName ?? "",
    username: initialProfile?.username ?? "",
    email: initialProfile?.email ?? "",
    tier: (initialProfile?.tier ?? "FREE") as "FREE" | "PREMIUM",
    premiumUntil: initialProfile?.premiumUntil ?? null,
  }));
  // The school is entered once here; Generate and the course picker read it
  // from the backend afterwards, so the hierarchy is never walked again.
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

  useEffect(() => {
    getCurrentProfile().then((result) => setProfile({
      displayName: result.profile.displayName ?? "",
      username: result.profile.username ?? "",
      email: result.profile.email ?? "",
      tier: result.profile.tier ?? "FREE",
      premiumUntil: result.profile.premiumUntil ?? null,
    })).catch(() => setError("Could not load your profile."));
    getMyCourses().then((result) => { setSchool(result.school); setSchoolForm(result.school ? { universityName: result.school.universityName, facultyName: result.school.facultyName } : { universityName: "", facultyName: "" }); setCourses(result.courses); }).catch(() => setError("Could not load your school details."));
    const match = `${window.location.search}&${window.location.hash}`.match(/[?&]reference=([^&]+)/);
    if (match) {
      const reference = decodeURIComponent(match[1]);
      getPaymentStatus(reference).then(async (result) => {
        if (result.status === "SUCCESS") {
          setProfile((current) => ({ ...current, tier: result.tier ?? "FREE", premiumUntil: result.premiumUntil ?? null }));
          setMessage("Your monthly plan is active.");
        } else if (result.status === "PENDING") setMessage("Payment received. Your plan access will appear as soon as confirmation completes.");
        else setError("That payment was not completed. You can try again.");
      }).catch(() => setMessage("We’re checking your payment. Refresh this page shortly."));
    }
  }, []);

  async function upgradeToPro() {
    setError(""); setProBusy(true);
    try { const result = await startPlanCheckout(selectedPlan); window.location.assign(result.authorizationUrl); }
    catch (reason) { setError(errorMessage(reason, "Could not start checkout. Please try again.")); setProBusy(false); }
  }

  async function saveProfile() {
    setError(""); setMessage("");
    try { const result = await updateProfile({ displayName: profile.displayName, username: profile.username }); setProfile((current) => ({ ...current, displayName: result.profile.displayName ?? "", username: result.profile.username ?? "" })); setMessage("Profile saved."); }
    catch (reason) { setError(errorMessage(reason, "Could not save your profile.")); }
  }
  // Both names are resolve-or-create on the backend (by slug), so re-entering
  // the same university or faculty never duplicates rows.
  async function saveSchool() {
    setError(""); setMessage("");
    if (!schoolForm.universityName.trim()) { setError("Enter your university name."); return; }
    try {
      const result = await saveMySchool({ universityName: schoolForm.universityName.trim(), facultyName: schoolForm.facultyName.trim() });
      setSchool(result.school); setSchoolForm({ universityName: result.school.universityName, facultyName: result.school.facultyName });
      setMessage("School details saved.");
    }
    catch (reason) { setError(errorMessage(reason, "Could not save your school.")); }
  }
  // Add a course by code and title; school details are optional.
  async function addCourse() {
    setError(""); setMessage("");
    if (!courseForm.code.trim() || !courseForm.title.trim()) { setError("Enter the course code and title."); return; }
    try {
      const result = await addMyCourse({ code: courseForm.code.trim(), title: courseForm.title.trim() });
      setCourses((current) => (current.some((item) => item.id === result.course.id) ? current : [...current, result.course]));
      setCourseForm({ code: "", title: "" });
      setMessage(`${result.course.code} added to your courses.`);
    }
    catch (reason) { setError(errorMessage(reason, "Could not save the course.")); }
  }
  // Removing only unlinks the course from this profile; the shared Course
  // entity (with any papers or generated sets) stays in the repository.
  async function removeCourse(courseId: string) {
    setError(""); setMessage("");
    try { await removeMyCourse(courseId); setCourses((current) => current.filter((item) => item.id !== courseId)); setMessage("Course removed from your list."); }
    catch (reason) { setError(errorMessage(reason, "Could not remove the course.")); }
  }

  async function confirmDeletion() {
    setError(""); setMessage("");
    if (deleteConfirm.trim().toLowerCase() !== "delete") { setError("Type the word “delete” to confirm."); return; }
    setDeleting(true);
    try {
      await deleteAccount(deleteConfirm);
      window.location.hash = "home";
    } catch (reason) { setError(errorMessage(reason, "Could not delete your account.")); setDeleting(false); }
  }

  return <PageFrame eyebrow="Account" title="Your profile" subtitle="Manage your personal details, school, courses, and account." back="dashboard">
    <div className="profile-page grid w-full max-w-[1020px] grid-cols-[minmax(280px,.78fr)_minmax(0,1.22fr)] items-start gap-22 max-760:grid-cols-1">
      <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] [&_.field]:mb-16 [&_.field>span]:mb-7 [&_.field>span]:block [&_.field>span]:text-11 [&_.field>span]:font-bold [&_.field>span]:text-muted [&_input]:min-h-44 [&_input]:w-full [&_input]:rounded-10 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-12 [&_input]:text-12 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_input:disabled]:bg-pale [&_input:disabled]:text-slate-icon [&_.field_small]:mt-6 [&_.field_small]:block [&_.field_small]:text-10 [&_.field_small]:text-slate-icon [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted [&_.primary-button]:mt-5 [&>.primary-button]:w-fit [&>.primary-button]:min-w-120"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 profile-avatar-success"><UserRound size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Account</p><h2>Personal details</h2></div><div className={`profile-tier-chip ${tierLabel(profile.tier, profile.premiumUntil) === "Free" ? "" : "pro"}`}>{tierLabel(profile.tier, profile.premiumUntil)}</div></div><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Display name</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="How should we call you?" /></label><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Username</span><input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="e.g. ernest_ade" /><small>3-24 lowercase letters, numbers, or underscores.</small></label><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Email</span><input value={profile.email} disabled /></label><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-brand px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-brand hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => void saveProfile()}><Save size={16} /> Save profile</button>{!isProActive(profile.tier, profile.premiumUntil) && <div className="mt-22 flex items-center justify-between gap-18 rounded-13 border border-line profile-promo-surface p-17 max-[580px]:flex-col max-[580px]:items-stretch [&_strong]:text-13 [&_strong]:text-ink [&_p]:mb-0 [&_p]:mt-5 [&_p]:text-11 [&_p]:text-muted [&_.primary-button]:!mt-0 [&_.primary-button]:shrink-0"><div className="grid size-34 shrink-0 place-items-center rounded-10 profile-promo-icon"><Crown size={18} /></div><div className="min-w-0 flex-1"><strong>Choose a monthly plan</strong><p>Choose Basic, Student Plus, or Premium with monthly AI credits.</p></div><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-brand px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-brand hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={proBusy} onClick={() => void upgradeToPro()}>{proBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Go Pro</button></div>}</section>
      <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] [&_.field]:mb-16 [&_.field>span]:mb-7 [&_.field>span]:block [&_.field>span]:text-11 [&_.field>span]:font-bold [&_.field>span]:text-muted [&_input]:min-h-44 [&_input]:w-full [&_input]:rounded-10 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-12 [&_input]:text-12 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_input:disabled]:bg-pale [&_input:disabled]:text-slate-icon [&_.field_small]:mt-6 [&_.field_small]:block [&_.field_small]:text-10 [&_.field_small]:text-slate-icon [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted [&_.primary-button]:mt-5 [&>.primary-button]:w-fit [&>.primary-button]:min-w-120"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 bg-pale text-brand"><GraduationCap size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Optional</p><h2>School details</h2></div></div><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">Add your university and faculty if you want to browse or share PDFs in the course library.</p><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>University</span><input value={schoolForm.universityName} onChange={(event) => setSchoolForm({ ...schoolForm, universityName: event.target.value })} placeholder="e.g. University of Lagos" /></label><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Faculty</span><input value={schoolForm.facultyName} onChange={(event) => setSchoolForm({ ...schoolForm, facultyName: event.target.value })} placeholder="e.g. Faculty of Science" /></label><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-brand px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-brand hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => void saveSchool()}><Save size={16} /> {school ? "Update details" : "Save details"}</button>{school && <small className="mt-10 flex items-center gap-6 text-10 font-bold profile-status-success"><Check size={13} /> Saved: {school.universityName} · {school.facultyName}</small>}</section>
      <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] [&_.field]:mb-16 [&_.field>span]:mb-7 [&_.field>span]:block [&_.field>span]:text-11 [&_.field>span]:font-bold [&_.field>span]:text-muted [&_input]:min-h-44 [&_input]:w-full [&_input]:rounded-10 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-12 [&_input]:text-12 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_input:disabled]:bg-pale [&_input:disabled]:text-slate-icon [&_.field_small]:mt-6 [&_.field_small]:block [&_.field_small]:text-10 [&_.field_small]:text-slate-icon [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted [&_.primary-button]:mt-5 [&_input]:min-h-42 [&_input]:rounded-9 [&_input]:px-11 [&_input]:text-11"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 bg-pale text-brand"><BookOpen size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">My courses</p><h2>Saved courses</h2></div></div><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">Up to {MAX_SAVED_COURSES} courses for quick access. Add just a code and a name; you can use these while practising without entering school details.</p><div className="mb-0 grid grid-cols-[.9fr_1.6fr] gap-8 max-760:grid-cols-1"><input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} placeholder="Course code e.g. CSC 201" /><input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Course title e.g. Data Structures" /></div><div className="mt-12 flex flex-wrap items-center justify-between gap-10"><button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-line bg-white px-14 text-12 font-bold leading-[1.25] text-brand transition-colors duration-200 hover:border-outline hover:bg-pale disabled:cursor-not-allowed disabled:opacity-50" disabled={!courseForm.code.trim() || !courseForm.title.trim() || courses.length >= MAX_SAVED_COURSES} onClick={() => void addCourse()}><Plus size={15} /> Add course</button><span className="text-10 font-bold text-muted">{courses.length} of {MAX_SAVED_COURSES}</span></div>{courses.length > 0 && <ul className="mt-14 grid list-none gap-8 p-0">{courses.map((course) => <li className="flex items-center justify-between gap-10 rounded-10 border border-line bg-white px-13 py-11 [&_strong]:text-12 [&_strong]:text-ink [&_span]:mt-2 [&_span]:block [&_span]:text-10 [&_span]:text-muted" key={course.id}><div><strong>{course.code}</strong><span>{course.title}</span></div><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50 danger" aria-label={`Remove ${course.code}`} onClick={() => void removeCourse(course.id)}><Trash2 size={14} /></button></li>)}</ul>}</section>
    <section className="rounded-17 border profile-danger-border profile-danger-surface p-25 shadow-[0_14px_30px_#1d4ed80b] [&_.field]:mb-16 [&_.field>span]:mb-7 [&_.field>span]:block [&_.field>span]:text-11 [&_.field>span]:font-bold [&_.field>span]:text-muted [&_input]:min-h-44 [&_input]:w-full [&_input]:rounded-10 [&_input]:border-danger-border [&_input]:bg-white [&_input]:px-12 [&_input]:text-12 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted [&_.danger-heading]:text-red-800 [&_.danger-button]:mt-8 [&_.danger-heading]:text-red-800 [&_input]:border-danger-border [&_.danger-button]:mt-8"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 profile-danger-icon"><Trash2 size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Danger zone</p><h2 className="danger-heading">Delete your account</h2></div></div><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">Deleting your account removes your profile, uploaded PDFs, study sets and account history. Some deletion records may be retained for up to 6 months under our data retention policy. To confirm, type <strong>delete</strong> below.</p><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="Type 'delete' to confirm" /></label><button className="danger-button" disabled={deleting} onClick={() => void confirmDeletion()}>{deleting ? "Deleting…" : "Permanently delete account"}</button></section>
    </div>{message && <p className="mt-16 flex items-center gap-7 text-12 font-semibold profile-status-success"><Check size={15} /> {message}</p>}{error && <p className="mt-16 flex items-center gap-7 text-12 font-semibold profile-status-error">{error}</p>}
    <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] [&_.field]:mb-16 [&_.field>span]:mb-7 [&_.field>span]:block [&_.field>span]:text-11 [&_.field>span]:font-bold [&_.field>span]:text-muted [&_input]:min-h-44 [&_input]:w-full [&_input]:rounded-10 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-12 [&_input]:text-12 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_input:disabled]:bg-pale [&_input:disabled]:text-slate-icon [&_.field_small]:mt-6 [&_.field_small]:block [&_.field_small]:text-10 [&_.field_small]:text-slate-icon [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted [&_.primary-button]:mt-5 col-span-full mt-22">
      <div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 profile-warning-icon"><Crown size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Plans</p><h2>Free vs Pro</h2></div><span className="ml-auto rounded-full profile-plan-badge px-10 py-6 text-10 font-extrabold text-brand max-[640px]:ml-0 max-[640px]:self-start">{isProActive(profile.tier, profile.premiumUntil) ? "Your plan: Pro" : "Your plan: Free"}</span></div>
      <p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">Compare what is included before you decide whether Pro is right for your study routine.</p>
      <div className="grid grid-cols-2 gap-14 max-[640px]:grid-cols-1">
        <div className={`rounded-13 border p-17 ${!isProActive(profile.tier, profile.premiumUntil) ? "border-outline shadow-[0_0_0_2px_#dbeafe]" : "border-line"} profile-plan-card [&_.plan-option-heading]:flex [&_.plan-option-heading]:items-baseline [&_.plan-option-heading]:justify-between [&_.plan-option-heading]:gap-12 [&_.plan-option-heading_strong]:font-grotesk [&_.plan-option-heading_strong]:text-16 [&_.plan-option-heading_strong]:font-bold [&_.plan-option-heading_strong]:text-ink [&_.plan-option-heading_span]:text-10 [&_.plan-option-heading_span]:font-bold [&_.plan-option-heading_span]:text-muted [&_ul]:mt-15 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-9 [&_ul]:p-0 [&_ul]:text-11 [&_ul]:text-muted [&_li]:flex [&_li]:items-center [&_li]:gap-7 [&_li_svg]:shrink-0 [&_li_svg]:text-success-icon`}>
          <div className="plan-option-heading"><strong>Free</strong><span>Get started</span></div>
          <ul><li><Check size={14} /> Daily quiz generations</li><li><Check size={14} /> Flashcard practice</li><li><Check size={14} /> Course repository access</li><li><Check size={14} /> Upload and save study materials</li></ul>
        </div>
        <div className={`rounded-13 border p-17 ${isProActive(profile.tier, profile.premiumUntil) ? "border-outline shadow-[0_0_0_2px_#dbeafe]" : "border-line"} profile-plan-card-pro [&_.plan-option-heading]:flex [&_.plan-option-heading]:items-baseline [&_.plan-option-heading]:justify-between [&_.plan-option-heading]:gap-12 [&_.plan-option-heading_strong]:font-grotesk [&_.plan-option-heading_strong]:text-16 [&_.plan-option-heading_strong]:font-bold [&_.plan-option-heading_strong]:text-ink [&_.plan-option-heading_span]:text-10 [&_.plan-option-heading_span]:font-bold [&_.plan-option-heading_span]:text-muted [&_ul]:mt-15 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-9 [&_ul]:p-0 [&_ul]:text-11 [&_ul]:text-muted [&_li]:flex [&_li]:items-center [&_li]:gap-7 [&_li_svg]:shrink-0 [&_li_svg]:text-success-icon`}>
          <div className="plan-option-heading"><strong>Monthly plans</strong><span>AI credits included</span></div>
          <ul><li><Check size={14} /> Basic: 50 AI credits · ₦499 launch / ₦999 monthly</li><li><Check size={14} /> Student Plus: 150 credits · ₦999 launch / ₦1,999 monthly</li><li><Check size={14} /> Premium: 300 credits · ₦1,499 launch / ₦2,999 monthly</li><li><Check size={14} /> Launch price for first 500 students, first month only</li></ul>
        </div>
      </div>
      {!isProActive(profile.tier, profile.premiumUntil) && <><label className="mt-16 block text-11 font-semibold text-muted">Choose a monthly plan<select className="ml-10 rounded-8 border border-line bg-white p-8 text-12 text-ink" value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as typeof selectedPlan)}><option value="BASIC">Basic</option><option value="STUDENT_PLUS">Student Plus</option><option value="PREMIUM">Premium</option></select></label><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-brand px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-brand hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none plan-details-action" disabled={proBusy} onClick={() => void upgradeToPro()}>{proBusy ? "Opening checkout…" : <><Crown size={16} /> Continue to Paystack</>}</button></>}
    </section>
    <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] [&_.field]:mb-16 [&_.field>span]:mb-7 [&_.field>span]:block [&_.field>span]:text-11 [&_.field>span]:font-bold [&_.field>span]:text-muted [&_input]:min-h-44 [&_input]:w-full [&_input]:rounded-10 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-12 [&_input]:text-12 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_input:disabled]:bg-pale [&_input:disabled]:text-slate-icon [&_.field_small]:mt-6 [&_.field_small]:block [&_.field_small]:text-10 [&_.field_small]:text-slate-icon [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted [&_.primary-button]:mt-5 col-span-full mt-22 flex justify-between gap-18 max-760:flex-col [&_h2]:m-0 [&_h2]:text-18 [&_.profile-help]:mb-0 [&_.profile-help]:max-w-[570px] [&>div:last-child]:flex [&>div:last-child]:flex-wrap [&>div:last-child]:gap-8"><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Your information</p><h2>Privacy and terms</h2><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">See how your information and study materials are handled, and the rules for sharing study PDFs with the community.</p></div><div><button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-line bg-white px-14 text-12 font-bold leading-[1.25] text-brand transition-colors duration-200 hover:border-outline hover:bg-pale disabled:cursor-not-allowed disabled:opacity-50" onClick={() => go("privacy")}>Read privacy policy</button><button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-line bg-white px-14 text-12 font-bold leading-[1.25] text-brand transition-colors duration-200 hover:border-outline hover:bg-pale disabled:cursor-not-allowed disabled:opacity-50" onClick={() => go("terms")}>Read terms of use</button></div></section>
  </PageFrame>;
}

// Free-Pro promo windows read friendlier as an expiry chip than a raw enum.
function tierLabel(tier: "FREE" | "PREMIUM", premiumUntil: string | null) {
  const until = premiumUntil ? new Date(premiumUntil) : null;
  if (until && until > new Date()) return `Pro until ${until.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return tier === "PREMIUM" && !premiumUntil ? "Pro" : "Free";
}

function isProActive(tier: "FREE" | "PREMIUM", premiumUntil: string | null) {
  return tier === "PREMIUM" && (!premiumUntil || new Date(premiumUntil).getTime() > Date.now());
}
