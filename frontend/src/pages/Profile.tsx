import { useEffect, useState } from "react";
import { BookOpen, Check, GraduationCap, Plus, Save, Trash2, UserRound, Sparkles, Loader2, Crown } from "lucide-react";
import { PageFrame } from "../components/Layout";
import {
  addMyCourse, deleteAccount, errorMessage, getCurrentProfile, getMyCourses, removeMyCourse, saveMySchool, updateProfile, type AuthProfile, getProPricing, startProCheckout, getPaymentStatus,
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
  const [proPrice, setProPrice] = useState<number | null>(null);
  const [proBusy, setProBusy] = useState(false);

  useEffect(() => {
    getCurrentProfile().then((result) => setProfile({
      displayName: result.profile.displayName ?? "",
      username: result.profile.username ?? "",
      email: result.profile.email ?? "",
      tier: result.profile.tier ?? "FREE",
      premiumUntil: result.profile.premiumUntil ?? null,
    })).catch(() => setError("Could not load your profile."));
    getMyCourses().then((result) => { setSchool(result.school); setSchoolForm(result.school ? { universityName: result.school.universityName, facultyName: result.school.facultyName } : { universityName: "", facultyName: "" }); setCourses(result.courses); }).catch(() => setError("Could not load your school details."));
    getProPricing().then((price) => { setProPrice(price.available ? price.amountNaira : null); }).catch(() => undefined);
    const match = `${window.location.search}&${window.location.hash}`.match(/[?&]reference=([^&]+)/);
    if (match) {
      const reference = decodeURIComponent(match[1]);
      getPaymentStatus(reference).then(async (result) => {
        if (result.status === "SUCCESS") {
          setProfile((current) => ({ ...current, tier: result.tier ?? "FREE", premiumUntil: result.premiumUntil ?? null }));
          setMessage("Your Pro plan is active.");
        } else if (result.status === "PENDING") setMessage("Payment received. Your Pro access will appear as soon as confirmation completes.");
        else setError("That payment was not completed. You can try again.");
      }).catch(() => setMessage("We’re checking your payment. Refresh this page shortly."));
    }
  }, []);

  async function upgradeToPro() {
    setError(""); setProBusy(true);
    try { const result = await startProCheckout(); window.location.assign(result.authorizationUrl); }
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
    <div className="profile-layout">
      <section className="profile-card profile-identity"><div className="profile-card-heading"><span className="profile-icon"><UserRound size={20} /></span><div><p className="eyebrow">Account</p><h2>Personal details</h2></div><div className={`profile-tier-chip ${tierLabel(profile.tier, profile.premiumUntil) === "Free" ? "" : "pro"}`}>{tierLabel(profile.tier, profile.premiumUntil)}</div></div><label className="field"><span>Display name</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="How should we call you?" /></label><label className="field"><span>Username</span><input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="e.g. ernest_ade" /><small>3-24 lowercase letters, numbers, or underscores.</small></label><label className="field"><span>Email</span><input value={profile.email} disabled /></label><button className="primary-button" onClick={() => void saveProfile()}><Save size={16} /> Save profile</button>{profile.tier !== "PREMIUM" && <div className="pro-upgrade-box"><div className="pro-upgrade-icon"><Crown size={18} /></div><div className="pro-upgrade-copy"><strong>Go Pro for a semester</strong><p>Unlimited quiz practice for 90 days{proPrice !== null ? ` · ₦${proPrice.toLocaleString()}` : ""}.</p></div><button className="primary-button" disabled={proBusy} onClick={() => void upgradeToPro()}>{proBusy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Go Pro</button></div>}</section>
      <section className="profile-card school-card"><div className="profile-card-heading"><span className="profile-icon blue"><GraduationCap size={20} /></span><div><p className="eyebrow">Optional</p><h2>School details</h2></div></div><p className="profile-help">Add your university and faculty if you want to browse or share papers in the course repository.</p><label className="field"><span>University</span><input value={schoolForm.universityName} onChange={(event) => setSchoolForm({ ...schoolForm, universityName: event.target.value })} placeholder="e.g. University of Lagos" /></label><label className="field"><span>Faculty</span><input value={schoolForm.facultyName} onChange={(event) => setSchoolForm({ ...schoolForm, facultyName: event.target.value })} placeholder="e.g. Faculty of Science" /></label><button className="primary-button" onClick={() => void saveSchool()}><Save size={16} /> {school ? "Update details" : "Save details"}</button>{school && <small className="profile-saved-note"><Check size={13} /> Saved: {school.universityName} · {school.facultyName}</small>}</section>
      <section className="profile-card courses-card"><div className="profile-card-heading"><span className="profile-icon blue"><BookOpen size={20} /></span><div><p className="eyebrow">My courses</p><h2>Saved courses</h2></div></div><p className="profile-help">Up to {MAX_SAVED_COURSES} courses for quick access. Add just a code and a name; you can use these while practising without entering school details.</p><div className="course-form-grid two"><input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} placeholder="Course code e.g. CSC 201" /><input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Course title e.g. Data Structures" /></div><div className="profile-course-actions"><button className="secondary-button" disabled={!courseForm.code.trim() || !courseForm.title.trim() || courses.length >= MAX_SAVED_COURSES} onClick={() => void addCourse()}><Plus size={15} /> Add course</button><span className="course-count">{courses.length} of {MAX_SAVED_COURSES}</span></div>{courses.length > 0 && <ul className="my-course-list">{courses.map((course) => <li className="my-course-row" key={course.id}><div><strong>{course.code}</strong><span>{course.title}</span></div><button className="ghost-button danger" aria-label={`Remove ${course.code}`} onClick={() => void removeCourse(course.id)}><Trash2 size={14} /></button></li>)}</ul>}</section>
    <section className="profile-card danger-card"><div className="profile-card-heading"><span className="profile-icon red"><Trash2 size={20} /></span><div><p className="eyebrow">Danger zone</p><h2>Delete your account</h2></div></div><p className="profile-help">This removes your account, papers, study sets and history permanently. The deletion is recorded in the admin logs. To confirm, type <strong>delete</strong> below.</p><label className="field"><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="Type 'delete' to confirm" /></label><button className="danger-button" disabled={deleting} onClick={() => void confirmDeletion()}>{deleting ? "Deleting…" : "Permanently delete account"}</button></section>
    </div>{message && <p className="profile-feedback success"><Check size={15} /> {message}</p>}{error && <p className="profile-feedback error">{error}</p>}
  </PageFrame>;
}

// Free-Pro promo windows read friendlier as an expiry chip than a raw enum.
function tierLabel(tier: "FREE" | "PREMIUM", premiumUntil: string | null) {
  const until = premiumUntil ? new Date(premiumUntil) : null;
  if (until && until > new Date()) return `Pro until ${until.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return tier === "PREMIUM" ? "Premium" : "Free";
}


