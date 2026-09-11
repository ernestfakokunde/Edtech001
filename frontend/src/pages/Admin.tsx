import { useEffect, useState } from "react";
import { Ban, Check, Clock3, FileText, Search, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { PageFrame } from "../components/Layout";
import { getAdminActivity, getAdminSubmissions, getAdminUsers, getDepartments, getFaculties, getUniversities, reviewSubmission, suspendAdminUser, unsuspendAdminUser } from "../lib/api";
import type { AdminUser, Department, RepositorySubmission, University } from "../lib/api";

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [submissions, setSubmissions] = useState<RepositorySubmission[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [activityCount, setActivityCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function loadUsers() {
    try { setUsers((await getAdminUsers({ search, universityId: selectedUniversity, departmentId: selectedDepartment })).users); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load users."); }
  }
  async function loadSubmissions() {
    try { setSubmissions((await getAdminSubmissions()).submissions); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load submissions."); }
  }
  useEffect(() => { void loadUsers(); void loadSubmissions(); Promise.all([getUniversities(), getAdminActivity()]).then(([hierarchy, activity]) => { setUniversities(hierarchy.universities); setActivityCount(activity.activity.length); }).catch((reason: Error) => setError(reason.message)); }, []);
  useEffect(() => { void loadUsers(); }, [selectedUniversity, selectedDepartment]);

  async function chooseUniversity(value: string) {
    setSelectedUniversity(value); setSelectedDepartment("");
    if (!value) { setDepartments([]); return; }
    const facultyResult = await getFaculties(value);
    const results = await Promise.all(facultyResult.faculties.map((faculty) => getDepartments(faculty.id)));
    setDepartments(results.flatMap((result) => result.departments));
  }
  async function toggleSuspension(user: AdminUser) {
    setNotice(""); setError("");
    try { if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) { await unsuspendAdminUser(user.id); setNotice("User access restored."); await loadUsers(); } else setSuspending(user); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update user access."); }
  }
  async function confirmSuspension(until: string, reason: string) {
    if (!suspending) return;
    try { await suspendAdminUser(suspending.id, { until, reason }); setSuspending(null); setNotice("User suspended and active sessions revoked."); await loadUsers(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not suspend user."); }
  }
  async function review(paperId: string, decision: "APPROVED" | "REJECTED", note?: string) {
    setReviewing(paperId); setNotice(""); setError("");
    try { await reviewSubmission(paperId, { decision, note }); setNotice(decision === "APPROVED" ? "Paper approved and added to the repository." : "Paper rejected."); await loadSubmissions(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not review paper."); }
    finally { setReviewing(null); }
  }

  const pending = submissions.filter((submission) => submission.status === "PENDING");
  return <PageFrame eyebrow="Operations" title="Admin board" subtitle="Review repository contributions and manage platform access.">
    <div className="admin-board">
      <div className="admin-metrics"><Metric icon={<Users size={17} />} label="Users" value={String(users.length)} /><Metric icon={<Clock3 size={17} />} label="Pending review" value={String(pending.length)} /><Metric icon={<FileText size={17} />} label="Recent events" value={String(activityCount)} /></div>
      {notice && <div className="admin-notice"><Check size={15} /> {notice}</div>}
      {error && <div className="admin-feedback-error">{error}</div>}
      <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">Repository moderation</p><h2>Paper submissions</h2></div><span className="admin-status"><ShieldCheck size={14} /> {pending.length} awaiting review</span></div><div className="admin-submission-list">{pending.length === 0 ? <div className="admin-empty"><FileText size={20} /><span>No pending papers.</span></div> : pending.map((submission) => <SubmissionRow key={submission.id} submission={submission} busy={reviewing === submission.id} onReview={review} />)}</div></section>
      <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">People</p><h2>User directory</h2></div><span className="admin-status"><ShieldCheck size={14} /> Moderation ready</span></div><div className="admin-filters"><label className="admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadUsers(); }} placeholder="Search name, username, or email" /></label><select value={selectedUniversity} onChange={(event) => void chooseUniversity(event.target.value)}><option value="">All universities</option>{universities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} disabled={!selectedUniversity}><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="secondary-button" onClick={() => void loadUsers()}>Search</button></div><div className="admin-user-list">{users.length === 0 ? <div className="admin-empty"><UserRound size={20} /><span>No users match these filters.</span></div> : users.map((user) => <UserRow key={user.id} user={user} onToggle={() => void toggleSuspension(user)} />)}</div></section>
    </div>
    {suspending && <SuspendDialog user={suspending} onCancel={() => setSuspending(null)} onConfirm={confirmSuspension} />}
  </PageFrame>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="admin-metric"><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function UserRow({ user, onToggle }: { user: AdminUser; onToggle: () => void }) { const suspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date(); return <div className="admin-user-row"><span className="admin-user-avatar"><UserRound size={16} /></span><div className="admin-user-main"><strong>{user.displayName || user.username || "Unnamed user"}</strong><small>{user.username ? `@${user.username} · ` : ""}{user.email}</small></div><div className="admin-user-stats"><span>{user._count.papers} papers</span><span>{user._count.generatedSets} sets</span></div><span className={`admin-role ${user.isAdmin ? "admin" : ""}`}>{user.isAdmin ? "Admin" : suspended ? "Suspended" : "Student"}</span>{!user.isAdmin && <button className={`admin-action ${suspended ? "restore" : ""}`} onClick={onToggle}>{suspended ? "Restore" : "Suspend"}</button>}</div>; }
function SubmissionRow({ submission, busy, onReview }: { submission: RepositorySubmission; busy: boolean; onReview: (id: string, decision: "APPROVED" | "REJECTED", note?: string) => void }) { const [note, setNote] = useState(""); return <article className="admin-submission-row"><div className="admin-submission-icon"><FileText size={18} /></div><div className="admin-submission-main"><strong>{submission.course.code} · {submission.course.title}</strong><p>{submission.description}</p><small>{submission.level} · {submission.year}/{submission.session} · {submission.semester === "FIRST" ? "First" : "Second"} semester · uploaded by {submission.owner.displayName || submission.owner.email}</small><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional review note" /></div><div className="admin-submission-actions"><button className="primary-button" disabled={busy} onClick={() => onReview(submission.id, "APPROVED", note)}><Check size={14} /> Approve</button><button className="danger-button" disabled={busy} onClick={() => onReview(submission.id, "REJECTED", note)}><Ban size={14} /> Reject</button></div></article>; }
function SuspendDialog({ user, onCancel, onConfirm }: { user: AdminUser; onCancel: () => void; onConfirm: (until: string, reason: string) => void }) { const [days, setDays] = useState("7"); const [reason, setReason] = useState(""); return <div className="admin-dialog-backdrop"><div className="admin-dialog"><button className="admin-dialog-close" onClick={onCancel} aria-label="Close"><X size={17} /></button><p className="eyebrow">Access control</p><h2>Suspend {user.displayName || user.email}?</h2><p>They will be signed out immediately and unable to access the platform until the suspension ends.</p><label className="field"><span>Duration</span><select value={days} onChange={(event) => setDays(event.target.value)}><option value="1">24 hours</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label><label className="field"><span>Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional moderation note" /></label><div className="admin-dialog-actions"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={() => onConfirm(new Date(Date.now() + Number(days) * 86400000).toISOString(), reason)}>Suspend account</button></div></div></div>; }
