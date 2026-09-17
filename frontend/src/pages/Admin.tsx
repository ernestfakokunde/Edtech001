import { useEffect, useState, type ReactNode } from "react";
import { Activity, Ban, Check, ChevronLeft, ChevronRight, Clock3, Copy, FileText, Flag, Plus, Power, Search, ShieldCheck, Sparkles, Ticket, Trash2, UserRound, Users, X } from "lucide-react";
import { PageFrame } from "../components/Layout";
import { createAdminMission, createAdminPromoCode, deleteAdminMission, deleteAdminPromoCode, getAdminActivity, getAdminMissions, getAdminPromoCodes, getAdminSubmissions, getAdminUsers, getDepartments, getFaculties, getModerationSummary, getUniversities, reviewSubmission, suspendAdminUser, unsuspendAdminUser, updateAdminMission, updateAdminPromoCode } from "../lib/api";
import type { ActivityEntry, AdminMission, AdminPromoCode, AdminUser, Department, Pagination, RepositorySubmission, University } from "../lib/api";

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, pages: 1 });
  const [usersRole, setUsersRole] = useState<"all" | "admin">("all");
  const [usersRecent, setUsersRecent] = useState<"all" | "24h" | "7d" | "30d" | "90d">("all");
  const [submissions, setSubmissions] = useState<RepositorySubmission[]>([]);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsPagination, setSubmissionsPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, pages: 1 });
  const [submissionStatus, setSubmissionStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<{ pending: number; approved: number; rejected: number; generatedSets: number; users: number } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPagination, setActivityPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [missionForm, setMissionForm] = useState({ title: "", description: "", xpReward: 10 });
  const [creatingMission, setCreatingMission] = useState(false);
  const [promoCodes, setPromoCodes] = useState<AdminPromoCode[]>([]);
  const [promoForm, setPromoForm] = useState({ code: "", description: "", premiumDays: 7, xpBonus: 0, maxRedemptions: "", expiresAt: "" });
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  async function loadUsers() {
    try {
      const result = await getAdminUsers({ search, universityId: selectedUniversity, departmentId: selectedDepartment, role: usersRole, recent: usersRecent, page: usersPage, pageSize: 20 });
      setUsers(result.users);
      setUsersPagination(result.pagination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load users."); }
  }
  async function loadSubmissions(overrides: { status?: "PENDING" | "APPROVED" | "REJECTED"; search?: string; page?: number } = {}) {
    const status = overrides.status ?? submissionStatus;
    const search = overrides.search ?? submissionSearch;
    const page = overrides.page ?? submissionsPage;
    try {
      const result = await getAdminSubmissions({ status, search, page, pageSize: 50 });
      setSubmissions(result.submissions);
      setSubmissionsPagination(result.pagination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load submissions."); }
  }
  async function loadActivity() {
    try {
      const result = await getAdminActivity(activityPage, 25);
      setActivity(result.activity);
      setActivityPagination(result.pagination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load activity."); }
  }
  useEffect(() => {
    void loadUsers();
    void loadSubmissions({ page: 1 });
    void loadActivity();
    void loadMissions();
    void loadPromoCodes();
    Promise.all([getUniversities(), getModerationSummary()])
      .then(([hierarchy, moderation]) => { setUniversities(hierarchy.universities); setSummary(moderation.summary); })
      .catch((reason: Error) => setError(reason.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void loadUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedUniversity, selectedDepartment, usersPage, usersRole, usersRecent, search]);
  useEffect(() => { void loadActivity(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activityPage]);

  async function chooseUniversity(value: string) {
    setSelectedUniversity(value);
    setSelectedDepartment("");
    if (!value) { setDepartments([]); return; }
    const facultyResult = await getFaculties(value);
    const results = await Promise.all(facultyResult.faculties.map((faculty) => getDepartments(faculty.id)));
    setDepartments(results.flatMap((result) => result.departments));
  }
  async function toggleSuspension(user: AdminUser) {
    setNotice(""); setError("");
    try {
      if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
        const result = await unsuspendAdminUser(user.id);
        setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, ...result.user } : u)));
        setNotice(`${user.displayName || user.email} has been restored.`);
      } else {
        const until = new Date(Date.now() + 7 * 86400000).toISOString();
        const result = await suspendAdminUser(user.id, { until, reason: "Suspended by administrator" });
        setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, ...result.user } : u)));
        setNotice(`${user.displayName || user.email} has been suspended.`);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update account."); }
  }
  async function confirmSuspension(user: AdminUser, until: string, reason: string) {
    setNotice(""); setError(""); setSuspending(null);
    try {
      const result = await suspendAdminUser(user.id, { until, reason });
      setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, ...result.user } : u)));
      setNotice(`${user.displayName || user.email} has been suspended.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not suspend account."); }
  }
  async function confirmReview(id: string, decision: "APPROVED" | "REJECTED", note?: string) {
    setReviewing(id);
    try {
      await reviewSubmission(id, { decision, note });
      setNotice(`Submission ${decision === "APPROVED" ? "approved" : "rejected"}.`);
      await loadSubmissions();
      getModerationSummary().then((moderation) => setSummary(moderation.summary)).catch(() => { /* summary refresh is best-effort */ });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not review submission."); }
    finally { setReviewing(null); }
  }

  async function loadMissions() {
    try { const result = await getAdminMissions(); setMissions(result.missions); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load missions."); }
  }
  async function loadPromoCodes() {
    try { const result = await getAdminPromoCodes(); setPromoCodes(result.codes); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load promo codes."); }
  }
  async function createMission() {
    setNotice(""); setError(""); setCreatingMission(true);
    try {
      await createAdminMission({ title: missionForm.title.trim(), description: missionForm.description.trim() || undefined, xpReward: Math.max(1, Math.round(Number(missionForm.xpReward)) || 10) });
      setMissionForm({ title: "", description: "", xpReward: 10 });
      setNotice("Mission created — students can claim it from their profile.");
      await loadMissions();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create the mission."); }
    finally { setCreatingMission(false); }
  }
  async function toggleMission(mission: AdminMission) {
    setNotice(""); setError("");
    try { await updateAdminMission(mission.id, { isActive: !mission.isActive }); setMissions((current) => current.map((m) => (m.id === mission.id ? { ...m, isActive: !mission.isActive } : m))); setNotice(`Mission ${mission.isActive ? "paused" : "resumed"}.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the mission."); }
  }
  async function removeMission(mission: AdminMission) {
    if (!window.confirm(`Delete the mission "${mission.title}"?`)) return;
    setNotice(""); setError("");
    try { await deleteAdminMission(mission.id); setMissions((current) => current.filter((m) => m.id !== mission.id)); setNotice("Mission deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete the mission."); }
  }
  async function createPromo() {
    setNotice(""); setError(""); setCreatingPromo(true);
    try {
      const result = await createAdminPromoCode({
        code: promoForm.code.trim(),
        description: promoForm.description.trim() || undefined,
        premiumDays: Math.max(0, Math.round(Number(promoForm.premiumDays)) || 0),
        xpBonus: Math.max(0, Math.round(Number(promoForm.xpBonus)) || 0),
        maxRedemptions: promoForm.maxRedemptions.trim() ? Math.max(1, Math.round(Number(promoForm.maxRedemptions))) : null,
        expiresAt: promoForm.expiresAt ? new Date(`${promoForm.expiresAt}T23:59:59`).toISOString() : null,
      });
      setPromoForm({ code: "", description: "", premiumDays: 7, xpBonus: 0, maxRedemptions: "", expiresAt: "" });
      setNotice(`Code ${result.promo.code} created — copy it and share it with students.`);
      await loadPromoCodes();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create the code."); }
    finally { setCreatingPromo(false); }
  }
  async function togglePromo(promo: AdminPromoCode) {
    setNotice(""); setError("");
    try { await updateAdminPromoCode(promo.id, { isActive: !promo.isActive }); setPromoCodes((current) => current.map((c) => (c.id === promo.id ? { ...c, isActive: !promo.isActive } : c))); setNotice(`Code ${promo.code} ${promo.isActive ? "paused" : "resumed"}.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the code."); }
  }
  async function removePromo(promo: AdminPromoCode) {
    if (!window.confirm(`Delete the code ${promo.code}? Students who already used it keep their reward.`)) return;
    setNotice(""); setError("");
    try { await deleteAdminPromoCode(promo.id); setPromoCodes((current) => current.filter((c) => c.id !== promo.id)); setNotice(`Code ${promo.code} deleted.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete the code."); }
  }
  function copyCode(code: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => { setCopiedCode(code); window.setTimeout(() => setCopiedCode(""), 1500); }).catch(() => { window.prompt("Copy this code:", code); });
    } else { window.prompt("Copy this code:", code); }
  }

  return (
    <PageFrame title="Admin board" subtitle="Moderate the repository and manage users." back="dashboard">
      <div className="admin-shell">
        {notice && <div className="admin-notice"><Check size={14} /> {notice}</div>}
        {error && <div className="admin-feedback-error"><X size={14} /> {error}</div>}
        {summary && (
          <section className="admin-metrics">
            <Metric icon={<Users size={16} />} label="Users" value={String(summary.users)} />
            <Metric icon={<FileText size={16} />} label="Papers" value={String(summary.pending + summary.approved + summary.rejected)} />
            <Metric icon={<Clock3 size={16} />} label="Pending" value={String(summary.pending)} tone="amber" />
            <Metric icon={<Check size={16} />} label="Approved" value={String(summary.approved)} tone="green" />
            <Metric icon={<Ban size={16} />} label="Rejected" value={String(summary.rejected)} tone="red" />
            <Metric icon={<Sparkles size={16} />} label="Study sets" value={String(summary.generatedSets)} tone="blue" />
          </section>
        )}

        {/* ── Users ── */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><p className="eyebrow">People</p><h2>User directory</h2></div>
            <span className="admin-status"><ShieldCheck size={14} /> {usersPagination.total} users</span>
          </div>
          <div className="admin-filters">
            <label className="admin-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setUsersPage(1); void loadUsers(); } }} placeholder="Search name, username, or email" />
            </label>
            <select value={usersRole} onChange={(event) => { setUsersRole(event.target.value as "all" | "admin"); setUsersPage(1); }}>
              <option value="all">All roles</option>
              <option value="admin">Admins only</option>
            </select>
            <select value={usersRecent} onChange={(event) => { setUsersRecent(event.target.value as "all" | "24h" | "7d" | "30d" | "90d"); setUsersPage(1); }}>
              <option value="all">All signups</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <select value={selectedUniversity} onChange={(event) => void chooseUniversity(event.target.value)}>
              <option value="">All universities</option>
              {universities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} disabled={!selectedUniversity}>
              <option value="">All departments</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button className="secondary-button" onClick={() => { setUsersPage(1); void loadUsers(); }}>Search</button>
          </div>
          <div className="admin-user-list">
            {users.length === 0 ? (
              <div className="admin-empty"><UserRound size={20} /><span>No users match these filters.</span></div>
            ) : (
              users.map((user) => {
                const active = Boolean(user.suspendedUntil && new Date(user.suspendedUntil) > new Date());
                return <UserRow key={user.id} user={user} onToggle={() => (active ? void toggleSuspension(user) : setSuspending(user))} />;
              })
            )}
          </div>
          {usersPagination.pages > 1 && (
            <div className="admin-pagination">
              <button className="secondary-button" disabled={usersPage <= 1} onClick={() => setUsersPage(usersPage - 1)}><ChevronLeft size={15} /></button>
              <span className="admin-pagination-label">Page {usersPagination.page} of {usersPagination.pages} <span className="admin-users-total">({usersPagination.total} total)</span></span>
              <button className="secondary-button" disabled={usersPage >= usersPagination.pages} onClick={() => setUsersPage(usersPage + 1)}><ChevronRight size={15} /></button>
            </div>
          )}
        </section>

        {/* ── Missions ── */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><p className="eyebrow">Missions</p><h2>XP challenges</h2></div>
            <span className="admin-status"><Flag size={14} /> {missions.length} missions</span>
          </div>
          <p className="admin-panel-help">Students claim these once from their profile for XP. Pause a mission to stop new claims.</p>
          <div className="admin-mission-create">
            <input value={missionForm.title} onChange={(event) => setMissionForm({ ...missionForm, title: event.target.value })} placeholder="Title e.g. Upload 3 past papers" />
            <input value={missionForm.description} onChange={(event) => setMissionForm({ ...missionForm, description: event.target.value })} placeholder="Short description (optional)" />
            <input type="number" min={1} value={missionForm.xpReward} onChange={(event) => setMissionForm({ ...missionForm, xpReward: Number(event.target.value) })} aria-label="XP reward" />
            <button className="primary-button" disabled={!missionForm.title.trim() || creatingMission} onClick={() => void createMission()}><Plus size={15} /> Add mission</button>
          </div>
          <div className="admin-mission-list">
            {missions.length === 0 ? (
              <div className="admin-empty"><Flag size={20} /><span>No missions yet — create the first one above.</span></div>
            ) : (
              missions.map((mission) => (
                <MissionRow key={mission.id} mission={mission} onToggle={() => void toggleMission(mission)} onDelete={() => void removeMission(mission)} />
              ))
            )}
          </div>
        </section>

        {/* ── Promo codes ── */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><p className="eyebrow">Promo codes</p><h2>Give out free Pro</h2></div>
            <span className="admin-status"><Ticket size={14} /> {promoCodes.length} codes</span>
          </div>
          <p className="admin-panel-help">Share a code and students redeem it on their profile — free Pro days and/or bonus XP, once per student. Leave uses empty for unlimited.</p>
          <div className="admin-promo-create">
            <input className="admin-promo-code-input" value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })} placeholder="CODE e.g. RECAPP-WEEK1" maxLength={24} />
            <input value={promoForm.description} onChange={(event) => setPromoForm({ ...promoForm, description: event.target.value })} placeholder="What it says to students e.g. Welcome week free Pro (optional)" />
            <button className="primary-button" disabled={!promoForm.code.trim() || creatingPromo} onClick={() => void createPromo()}><Plus size={15} /> Create code</button>
            <div className="admin-promo-caps">
              <label>Pro days<input type="number" min={0} value={promoForm.premiumDays} onChange={(event) => setPromoForm({ ...promoForm, premiumDays: Number(event.target.value) })} /></label>
              <label>Bonus XP<input type="number" min={0} value={promoForm.xpBonus} onChange={(event) => setPromoForm({ ...promoForm, xpBonus: Number(event.target.value) })} /></label>
              <label>Max uses<input type="number" min={1} value={promoForm.maxRedemptions} onChange={(event) => setPromoForm({ ...promoForm, maxRedemptions: event.target.value })} placeholder="Unlimited" /></label>
              <label>Expires<input type="date" value={promoForm.expiresAt} onChange={(event) => setPromoForm({ ...promoForm, expiresAt: event.target.value })} /></label>
            </div>
          </div>
          <div className="admin-promo-list">
            {promoCodes.length === 0 ? (
              <div className="admin-empty"><Ticket size={20} /><span>No promo codes yet — create one above and share it.</span></div>
            ) : (
              promoCodes.map((promo) => (
                <PromoRow key={promo.id} promo={promo} copied={copiedCode === promo.code} onCopy={() => copyCode(promo.code)} onToggle={() => void togglePromo(promo)} onDelete={() => void removePromo(promo)} />
              ))
            )}
          </div>
        </section>

        {/* ── Repository submissions ── */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><p className="eyebrow">Submissions</p><h2>Repository review</h2></div>
            <span className="admin-status"><FileText size={14} /> {submissionsPagination.total} submissions</span>
          </div>
          <div className="admin-filters">
            <select value={submissionStatus} onChange={(event) => { setSubmissionStatus(event.target.value as "PENDING" | "APPROVED" | "REJECTED"); setSubmissionsPage(1); }}>
              <option value="PENDING">Pending review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <label className="admin-search">
              <Search size={16} />
              <input value={submissionSearch} onChange={(event) => setSubmissionSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setSubmissionsPage(1); void loadSubmissions({ page: 1 }); } }} placeholder="Search course code or title" />
            </label>
            <button className="secondary-button" onClick={() => { setSubmissionsPage(1); void loadSubmissions({ page: 1 }); }}>Search</button>
          </div>
          <div className="admin-submission-list">
            {submissions.length === 0 ? (
              <div className="admin-empty"><FileText size={20} /><span>No submissions match these filters.</span></div>
            ) : (
              submissions.map((submission) => (
                <SubmissionRow key={submission.id} submission={submission} busy={reviewing === submission.id} onReview={(id, decision, note) => void confirmReview(id, decision, note)} />
              ))
            )}
          </div>
          {submissionsPagination.pages > 1 && (
            <div className="admin-pagination">
              <button className="secondary-button" disabled={submissionsPage <= 1} onClick={() => setSubmissionsPage(submissionsPage - 1)}><ChevronLeft size={15} /></button>
              <span className="admin-pagination-label">Page {submissionsPagination.page} of {submissionsPagination.pages} <span className="admin-submission-total">({submissionsPagination.total} total)</span></span>
              <button className="secondary-button" disabled={submissionsPage >= submissionsPagination.pages} onClick={() => setSubmissionsPage(submissionsPage + 1)}><ChevronRight size={15} /></button>
            </div>
          )}
        </section>

        {/* ── Activity ── */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><p className="eyebrow">Signals</p><h2>Recent activity</h2></div>
            <span className="admin-status"><Activity size={14} /> {activityPagination.total} events</span>
          </div>
          <div className="admin-activity-list">
            {activity.length === 0 ? (
              <div className="admin-empty"><Activity size={20} /><span>No activity recorded yet.</span></div>
            ) : (
              activity.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
            )}
          </div>
          {activityPagination.pages > 1 && (
            <div className="admin-pagination">
              <button className="secondary-button" disabled={activityPage <= 1} onClick={() => setActivityPage(activityPage - 1)}><ChevronLeft size={15} /></button>
              <span className="admin-pagination-label">Page {activityPagination.page} of {activityPagination.pages} <span className="admin-submission-total">({activityPagination.total} total)</span></span>
              <button className="secondary-button" disabled={activityPage >= activityPagination.pages} onClick={() => setActivityPage(activityPage + 1)}><ChevronRight size={15} /></button>
            </div>
          )}
        </section>
      </div>
      {suspending && (
        <SuspendDialog
          user={suspending}
          onClose={() => setSuspending(null)}
          onConfirm={(until, reason) => void confirmSuspension(suspending, until, reason)}
        />
      )}
    </PageFrame>
  );
}

function Metric({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone?: string }) {
  return (
    <div className="admin-metric">
      <span className={tone ? `metric-icon ${tone}` : undefined}>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function UserRow({ user, onToggle }: { user: AdminUser; onToggle: () => void }) {
  const suspended = Boolean(user.suspendedUntil && new Date(user.suspendedUntil) > new Date());
  return (
    <div className="admin-user-row">
      <span className="admin-user-avatar"><UserRound size={16} /></span>
      <div className="admin-user-main">
        <strong>{user.displayName || user.username || user.email}</strong>
        <small>{user.email} · joined {new Date(user.createdAt).toLocaleDateString()}</small>
      </div>
      <div className="admin-user-stats">
        <span>{user._count.generatedSets} sets</span>
        <span>{user._count.papers} papers</span>
        <span>{user.xp} XP</span>
      </div>
      <span className={`admin-role${user.isAdmin ? " admin" : ""}`}>{user.isAdmin ? "Admin" : user.tier === "PREMIUM" ? "Premium" : "Free"}</span>
      <button className={`admin-action${suspended ? " restore" : ""}`} onClick={onToggle}>{suspended ? "Restore" : "Suspend"}</button>
    </div>
  );
}

function SubmissionRow({ submission, busy, onReview }: { submission: RepositorySubmission; busy: boolean; onReview: (id: string, decision: "APPROVED" | "REJECTED", note?: string) => void }) {
  const [note, setNote] = useState("");
  const pending = submission.status === "PENDING";
  return (
    <div className="admin-submission-row">
      <span className="admin-submission-icon"><FileText size={16} /></span>
      <div className="admin-submission-main">
        <strong>{submission.course.code} — {submission.course.title}</strong>
        <p>{submission.description}</p>
        <small>{submission.owner.displayName || submission.owner.email} · Level {submission.level} · {submission.session} {submission.year} · {submission.semester === "FIRST" ? "First" : "Second"} semester</small>
        {pending && <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a review note (optional)" />}
      </div>
      {pending ? (
        <div className="admin-submission-actions">
          <button className="secondary-button" disabled={busy} onClick={() => onReview(submission.id, "APPROVED", note.trim() || undefined)}><Check size={14} /> Approve</button>
          <button className="danger-button" disabled={busy} onClick={() => onReview(submission.id, "REJECTED", note.trim() || undefined)}><Ban size={14} /> Reject</button>
        </div>
      ) : (
        <span className="admin-submission-total">{submission.status.toLowerCase()}</span>
      )}
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const actor = entry.actor ? entry.actor.displayName || entry.actor.username || entry.actor.email : entry.metadata?.deletedEmail || "System";
  const action = entry.action.replace(/_/g, " ").toLowerCase();
  const target = entry.metadata?.title ? ` "${entry.metadata.title}"` : "";
  return (
    <div className="admin-activity-row">
      <span><Activity size={14} /></span>
      <p><strong>{actor}</strong> {action}{target}</p>
      <time>{timeAgo(entry.createdAt)}</time>
    </div>
  );
}

function SuspendDialog({ user, onClose, onConfirm }: { user: AdminUser; onClose: () => void; onConfirm: (until: string, reason: string) => void }) {
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("Suspended by administrator");
  return (
    <div className="admin-dialog-backdrop" onClick={onClose}>
      <div className="admin-dialog" onClick={(event) => event.stopPropagation()}>
        <button className="admin-dialog-close" onClick={onClose}><X size={17} /></button>
        <p className="eyebrow">Suspension</p>
        <h2>Suspend {user.displayName || user.email}</h2>
        <p>They will not be able to sign in until the suspension lifts.</p>
        <label className="field">
          Duration
          <select value={days} onChange={(event) => setDays(event.target.value)}>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
        <label className="field">
          Reason
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this account being suspended?" />
        </label>
        <div className="admin-dialog-actions">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="danger-button" onClick={() => onConfirm(new Date(Date.now() + Number(days) * 86400000).toISOString(), reason.trim() || "Suspended by administrator")}>Suspend account</button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function MissionRow({ mission, onToggle, onDelete }: { mission: AdminMission; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className={`admin-mission-row ${mission.isActive ? "" : "inactive"}`}>
      <div className="mission-icon"><Flag size={15} /></div>
      <div className="mission-main">
        <strong>{mission.title}</strong>
        <span>{mission.description || "No description."}</span>
        <small>+{mission.xpReward} XP · {mission.claimCount} claimed{mission.isActive ? "" : " · paused"}</small>
      </div>
      <div className="admin-row-actions">
        <button className="secondary-button" onClick={onToggle}><Power size={14} /> {mission.isActive ? "Pause" : "Resume"}</button>
        <button className="ghost-button danger" aria-label={`Delete ${mission.title}`} onClick={onDelete}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function PromoRow({ promo, copied, onCopy, onToggle, onDelete }: { promo: AdminPromoCode; copied: boolean; onCopy: () => void; onToggle: () => void; onDelete: () => void }) {
  const usedUp = promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions;
  const expired = Boolean(promo.expiresAt && new Date(promo.expiresAt) <= new Date());
  const grants: string[] = [];
  if (promo.premiumDays > 0) grants.push(`${promo.premiumDays} day${promo.premiumDays === 1 ? "" : "s"} of Pro`);
  if (promo.xpBonus > 0) grants.push(`${promo.xpBonus} bonus XP`);
  return (
    <div className={`admin-promo-row ${!promo.isActive || usedUp || expired ? "inactive" : ""}`}>
      <div className="admin-promo-main">
        <code>{promo.code}</code>
        <span>{grants.join(" + ") || "No reward set"}</span>
        <small>
          {promo.redemptionCount} redeemed{promo.maxRedemptions ? ` of ${promo.maxRedemptions}` : ""}
          {promo.expiresAt ? ` · expires ${new Date(promo.expiresAt).toLocaleDateString()}` : " · no expiry"}
          {!promo.isActive ? " · paused" : ""}{usedUp ? " · used up" : ""}{expired ? " · expired" : ""}
          {promo.description ? ` · ${promo.description}` : ""}
        </small>
      </div>
      <div className="admin-row-actions">
        <button className="secondary-button" onClick={onCopy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
        <button className="secondary-button" onClick={onToggle}><Power size={14} /> {promo.isActive ? "Pause" : "Resume"}</button>
        <button className="ghost-button danger" aria-label={`Delete ${promo.code}`} onClick={onDelete}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}