import { useEffect, useState } from "react";
import { BookOpen, Check, Copy, GraduationCap, PartyPopper, Plus, Save, Sparkles, Ticket, Trash2, UserRound } from "lucide-react";
import { PageFrame } from "../components/Layout";
import {
  addMyCourse, claimMission, deleteAccount, getCurrentProfile, getMyCourses, getMyMissions, getReferralInfo, redeemPromoCode, removeMyCourse, saveMySchool, updateProfile,
} from "../lib/api";
import type { MySchool, ProfileMission, ReferralInfo, SavedCourse } from "../lib/api";

// Same per-student cap the backend enforces on POST /api/profile/courses.
const MAX_SAVED_COURSES = 10;

export function ProfilePage() {
  const [profile, setProfile] = useState({ displayName: "", username: "", email: "", tier: "FREE" as "FREE" | "PREMIUM", xp: 0, premiumUntil: null as string | null });
  // The school is entered once here; Generate and the course picker read it
  // from the backend afterwards, so the hierarchy is never walked again.
  const [school, setSchool] = useState<MySchool>(null);
  const [schoolForm, setSchoolForm] = useState({ universityName: "", facultyName: "" });
  const [courses, setCourses] = useState<SavedCourse[]>([]);
  const [courseForm, setCourseForm] = useState({ code: "", title: "" });
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [missions, setMissions] = useState<ProfileMission[]>([]);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  async function redeemPromo() {
    setError(""); setMessage(""); setRedeeming(true);
    try {
      const result = await redeemPromoCode(redeemCode.trim());
      const parts: string[] = [];
      if (result.premiumDays > 0) parts.push(`${result.premiumDays} free Pro day${result.premiumDays === 1 ? "" : "s"}`);
      if (result.xpBonus > 0) parts.push(`${result.xpBonus} bonus XP`);
      setProfile((current) => ({ ...current, xp: result.xp, premiumUntil: result.premiumUntil }));
      setRedeemCode("");
      setMessage(`Code redeemed — enjoy ${parts.join(" and ")}!`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not redeem that code."); }
    finally { setRedeeming(false); }
  }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentProfile().then((result) => setProfile({
      displayName: result.profile.displayName ?? "",
      username: result.profile.username ?? "",
      email: result.profile.email ?? "",
      tier: result.profile.tier ?? "FREE",
      xp: result.profile.xp ?? 0,
      premiumUntil: result.profile.premiumUntil ?? null,
    })).catch(() => setError("Could not load your profile."));
    getMyCourses().then((result) => { setSchool(result.school); setSchoolForm(result.school ? { universityName: result.school.universityName, facultyName: result.school.facultyName } : { universityName: "", facultyName: "" }); setCourses(result.courses); }).catch(() => setError("Could not load your school details."));
    getReferralInfo().then((result) => setReferral(result.referral)).catch(() => { /* invite card silently stays empty */ });
    getMyMissions().then((result) => { setMissions(result.missions); if (result.xp) setProfile((current) => ({ ...current, xp: result.xp, tier: result.tier })); }).catch(() => { /* missions are best-effort */ });
  }, []);

  async function saveProfile() {
    setError(""); setMessage("");
    try { const result = await updateProfile({ displayName: profile.displayName, username: profile.username }); setProfile((current) => ({ ...current, displayName: result.profile.displayName ?? "", username: result.profile.username ?? "" })); setMessage("Profile saved."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile."); }
  }
  // Both names are resolve-or-create on the backend (by slug), so re-entering
  // the same university or faculty never duplicates rows.
  async function saveSchool() {
    setError(""); setMessage("");
    if (!schoolForm.universityName.trim() || !schoolForm.facultyName.trim()) { setError("Enter your university and faculty names."); return; }
    try {
      const result = await saveMySchool({ universityName: schoolForm.universityName.trim(), facultyName: schoolForm.facultyName.trim() });
      setSchool(result.school); setSchoolForm({ universityName: result.school.universityName, facultyName: result.school.facultyName });
      setMessage("School saved. Courses you add are filed under it automatically.");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your school."); }
  }
  // Adding a course is just a code and a title — the backend files it under the
  // saved faculty's General department and links (never duplicates) by code.
  async function addCourse() {
    setError(""); setMessage("");
    if (!courseForm.code.trim() || !courseForm.title.trim()) { setError("Enter the course code and title."); return; }
    try {
      const result = await addMyCourse({ code: courseForm.code.trim(), title: courseForm.title.trim() });
      setCourses((current) => (current.some((item) => item.id === result.course.id) ? current : [...current, result.course]));
      setCourseForm({ code: "", title: "" });
      setMessage(`${result.course.code} added to your courses.`);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the course."); }
  }
  // Removing only unlinks the course from this profile; the shared Course
  // entity (with any papers or generated sets) stays in the repository.
  async function removeCourse(courseId: string) {
    setError(""); setMessage("");
    try { await removeMyCourse(courseId); setCourses((current) => current.filter((item) => item.id !== courseId)); setMessage("Course removed from your list."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove the course."); }
  }
  async function copyReferralCode() {
    if (!referral?.referralCode) return;
    try { await navigator.clipboard.writeText(referral.referralCode); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setError("Could not copy. Select the code manually."); }
  }

  async function claim(missionId: string) {
    setClaimingId(missionId); setError(""); setMessage("");
    try {
      const result = await claimMission(missionId);
      setMissions((current) => current.map((mission) => (mission.id === missionId ? { ...mission, claimedAt: new Date().toISOString() } : mission)));
      setProfile((current) => ({ ...current, xp: result.xp }));
      setMessage(`${result.xpEarned} XP claimed! Your total is now ${result.xp}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not claim this mission."); }
    finally { setClaimingId(null); }
  }

  async function confirmDeletion() {
    setError(""); setMessage("");
    if (deleteConfirm.trim().toLowerCase() !== "delete") { setError("Type the word “delete” to confirm."); return; }
    setDeleting(true);
    try {
      await deleteAccount(deleteConfirm);
      window.location.hash = "home";
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete your account."); setDeleting(false); }
  }

  return <PageFrame eyebrow="Account" title="Your profile" subtitle="Manage your identity, school, courses, invites, missions and account." back="dashboard">
    <div className="profile-layout">
      <section className="profile-card profile-identity"><div className="profile-card-heading"><span className="profile-icon"><UserRound size={20} /></span><div><p className="eyebrow">Account</p><h2>Personal details</h2></div><div className={`profile-tier-chip ${tierLabel(profile.tier, profile.premiumUntil) === "Free" ? "" : "pro"}`}>{tierLabel(profile.tier, profile.premiumUntil)}</div></div><div className="profile-xp-strip"><Sparkles size={15} /><strong>{profile.xp} XP</strong><span>Earned from missions and referrals</span></div><label className="field"><span>Display name</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="How should we call you?" /></label><label className="field"><span>Username</span><input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="e.g. ernest_ade" /><small>3-24 lowercase letters, numbers, or underscores.</small></label><label className="field"><span>Email</span><input value={profile.email} disabled /></label><button className="primary-button" onClick={() => void saveProfile()}><Save size={16} /> Save profile</button></section>
      <section className="profile-card school-card"><div className="profile-card-heading"><span className="profile-icon blue"><GraduationCap size={20} /></span><div><p className="eyebrow">My school</p><h2>University & faculty</h2></div></div><p className="profile-help">Enter these once — every course you add afterwards is filed under them automatically, here and on the Generate screen.</p><label className="field"><span>University</span><input value={schoolForm.universityName} onChange={(event) => setSchoolForm({ ...schoolForm, universityName: event.target.value })} placeholder="e.g. University of Lagos" /></label><label className="field"><span>Faculty</span><input value={schoolForm.facultyName} onChange={(event) => setSchoolForm({ ...schoolForm, facultyName: event.target.value })} placeholder="e.g. Faculty of Science" /></label><button className="primary-button" onClick={() => void saveSchool()}><Save size={16} /> {school ? "Update school" : "Save school"}</button>{school && <small className="profile-saved-note"><Check size={13} /> Saved: {school.universityName} · {school.facultyName}</small>}</section>
      <section className="profile-card courses-card"><div className="profile-card-heading"><span className="profile-icon blue"><BookOpen size={20} /></span><div><p className="eyebrow">My courses</p><h2>Courses you generate against</h2></div></div><p className="profile-help">Up to {MAX_SAVED_COURSES} courses. They appear automatically when you generate quizzes or flashcards — just a code and a title, no hierarchy needed.</p><div className="course-form-grid two"><input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} placeholder="Course code e.g. CSC 201" disabled={!school} /><input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Course title e.g. Data Structures" disabled={!school} /></div><div className="profile-course-actions"><button className="secondary-button" disabled={!school || !courseForm.code.trim() || !courseForm.title.trim() || courses.length >= MAX_SAVED_COURSES} onClick={() => void addCourse()}><Plus size={15} /> Add course</button><span className="course-count">{courses.length} of {MAX_SAVED_COURSES}</span></div>{!school && <small className="profile-saved-note pending">Save your university and faculty above first.</small>}{courses.length > 0 && <ul className="my-course-list">{courses.map((course) => <li className="my-course-row" key={course.id}><div><strong>{course.code}</strong><span>{course.title}</span></div><button className="ghost-button danger" aria-label={`Remove ${course.code}`} onClick={() => void removeCourse(course.id)}><Trash2 size={14} /></button></li>)}</ul>}</section>
    <section className="profile-card referral-card"><div className="profile-card-heading"><span className="profile-icon green"><PartyPopper size={20} /></span><div><p className="eyebrow">Invite friends</p><h2>Your referral code</h2></div></div><p className="profile-help">Share your code — when a friend signs up with it you both earn bonus XP (20 XP for you per friend).</p>{referral?.referralCode ? <div className="referral-code-row"><code>{referral.referralCode}</code><button className="secondary-button" onClick={() => void copyReferralCode()}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button></div> : <small className="profile-saved-note pending">Your invite code will appear here shortly.</small>}<small className="profile-saved-note"><PartyPopper size={13} /> {referral?.invites ?? 0} friend{referral?.invites === 1 ? "" : "s"} joined with your code.</small></section>
    <section className="profile-card missions-card"><div className="profile-card-heading"><span className="profile-icon gold"><Sparkles size={20} /></span><div><p className="eyebrow">Missions</p><h2>Claim XP</h2></div></div><p className="profile-help">Complete a challenge and claim its XP once. Points build up on your profile as you go.</p>{missions.length === 0 ? <small className="profile-saved-note pending">No missions are available right now — check back soon.</small> : <ul className="mission-list">{missions.map((mission) => <li className={`mission-row ${mission.claimedAt ? "claimed" : ""}`} key={mission.id}><div className="mission-icon"><Sparkles size={16} /></div><div className="mission-main"><strong>{mission.title}</strong><span>{mission.description || "Complete this challenge to earn XP."}</span><small>+{mission.xpReward} XP{!mission.isActive && mission.claimedAt ? " · no longer active" : ""}</small></div>{mission.claimedAt ? <span className="mission-claimed"><Check size={13} /> Claimed</span> : <button className="primary-button" disabled={claimingId === mission.id} onClick={() => void claim(mission.id)}>{claimingId === mission.id ? "Claiming…" : "Claim"}</button>}</li>)}</ul>}</section>
    <section className="profile-card redeem-card"><div className="profile-card-heading"><span className="profile-icon blue"><Ticket size={20} /></span><div><p className="eyebrow">Promo codes</p><h2>Redeem a code</h2></div></div><p className="profile-help">Got a code from us — a free Pro week, bonus XP? Redeem it here. Each code works once per student.</p><div className="redeem-row"><input value={redeemCode} onChange={(event) => setRedeemCode(event.target.value.toUpperCase())} placeholder="e.g. RECAPP-WEEK1" maxLength={24} /><button className="primary-button" disabled={!redeemCode.trim() || redeeming} onClick={() => void redeemPromo()}>{redeeming ? "Redeeming…" : "Redeem"}</button></div>{profile.premiumUntil && new Date(profile.premiumUntil) > new Date() && <small className="profile-saved-note"><Check size={13} /> Pro is active until {new Date(profile.premiumUntil).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} — unlimited quizzes while it lasts.</small>}</section>
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


