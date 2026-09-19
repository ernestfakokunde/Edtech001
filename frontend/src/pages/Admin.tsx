import { useEffect, useState, type ReactNode } from "react";
import { Activity, ArrowLeft, Ban, Check, ChevronLeft, ChevronRight, Clock3, Copy, FileText, Flag, LayoutDashboard, Menu, Plus, Power, Search, ShieldCheck, Sparkles, Ticket, Trash2, UserRound, Users, X } from "lucide-react";
import { go } from "../components/Layout";
import type { Route } from "../types";
import { createAdminMission, createAdminPromoCode, deleteAdminMission, deleteAdminPromoCode, getAdminActivity, getAdminMissions, getAdminPromoCodes, getAdminSubmissions, getAdminUsers, getDepartments, getFaculties, getModerationSummary, getUniversities, promoteAdminUser, reviewSubmission, suspendAdminUser, unsuspendAdminUser, updateAdminMission, updateAdminPromoCode } from "../lib/api";
import type { ActivityEntry, AdminMission, AdminPromoCode, AdminUser, Department, Faculty, Pagination, RepositorySubmission, University } from "../lib/api";

/* Phase 5 — standalone admin board: a Tailwind sidebar shell (drawer below
   1020px) with one sub-page per concern. App.tsx maps each `admin-*` hash
   route to a `section` prop and hides the main header; "Back to main app"
   returns to the dashboard. Data loads per section, the activity feed is
   capped at 15 rows/page with type filter + actor search. Shell, overview
   and make-admin are Tailwind; inner panels reuse App.css .admin-* classes. */

const ADMIN_TITLES: Record<string, string> = {
  overview: "Overview",
  users: "People",
  admins: "Make an admin",
  missions: "Missions",
  promo: "Promo codes",
  submissions: "Submissions",
  activity: "Signals",
};

const ADMIN_NAV: { key: string; route: Route; label: string; icon: ReactNode }[] = [
  { key: "overview", route: "admin", label: "Overview", icon: <LayoutDashboard size={16} /> },
  { key: "users", route: "admin-users", label: "People", icon: <Users size={16} /> },
  { key: "admins", route: "admin-admins", label: "Make an admin", icon: <ShieldCheck size={16} /> },
  { key: "missions", route: "admin-missions", label: "Missions", icon: <Flag size={16} /> },
  { key: "promo", route: "admin-promo", label: "Promo codes", icon: <Ticket size={16} /> },
  { key: "submissions", route: "admin-submissions", label: "Submissions", icon: <FileText size={16} /> },
  { key: "activity", route: "admin-activity", label: "Signals", icon: <Activity size={16} /> },
];

const QUICK_LINKS: { route: Route; icon: ReactNode; title: string; text: string }[] = [
  { route: "admin-users", icon: <Users size={17} />, title: "People", text: "Search the directory and suspend or restore accounts." },
  { route: "admin-admins", icon: <ShieldCheck size={17} />, title: "Make an admin", text: "Promote a registered email to full board access." },
  { route: "admin-missions", icon: <Flag size={17} />, title: "Missions", text: "Create XP challenges students can claim once." },
  { route: "admin-promo", icon: <Ticket size={17} />, title: "Promo codes", text: "Hand out free Pro days and bonus XP." },
  { route: "admin-submissions", icon: <FileText size={17} />, title: "Submissions", text: "Review the repository upload queue." },
  { route: "admin-activity", icon: <Activity size={17} />, title: "Signals", text: "Signups, referrals and moderation events." },
];

export function AdminPage({ section }: { section: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, pages: 1 });
  const [usersRole, setUsersRole] = useState<"all" | "admin">("all");
  const [usersRecent, setUsersRecent] = useState<"all" | "24h" | "7d" | "30d" | "90d">("all");
  const [usersSearchInput, setUsersSearchInput] = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [submissions, setSubmissions] = useState<RepositorySubmission[]>([]);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsPagination, setSubmissionsPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, pages: 1 });
  const [submissionStatus, setSubmissionStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [submissionSearchInput, setSubmissionSearchInput] = useState("");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [summary, setSummary] = useState<{ pending: number; approved: number; rejected: number; generatedSets: number; users: number } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPagination, setActivityPagination] = useState<Pagination>({ page: 1, pageSize: 15, total: 0, pages: 1 });
  const [activityType, setActivityType] = useState("all");
  const [activitySearchInput, setActivitySearchInput] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
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
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // ── Loaders — one per section so the board only asks for what is on screen
  async function loadUsers() {
    try {
      const result = await getAdminUsers({ search: usersSearch || undefined, universityId: selectedUniversity, departmentId: selectedDepartment, role: usersRole, recent: usersRecent, page: usersPage, pageSize: 20 });
      setUsers(result.users);
      setUsersPagination(result.pagination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load users."); }
  }
  async function loadAdmins() {
    try {
      const result = await getAdminUsers({ role: "admin", pageSize: 8 });
      setAdmins(result.users);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load the admin list."); }
  }
  async function loadSubmissions() {
    try {
      const result = await getAdminSubmissions({ status: submissionStatus, search: submissionSearch || undefined, page: submissionsPage, pageSize: 50 });
      setSubmissions(result.submissions);
      setSubmissionsPagination(result.pagination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load submissions."); }
  }
  async function loadActivity() {
    try {
      const result = await getAdminActivity({ page: activityPage, type: activityType === "all" ? undefined : activityType, search: activitySearch || undefined });
      setActivity(result.activity);
      setActivityPagination(result.pagination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load activity."); }
  }
  async function loadSummary() {
    try { const result = await getModerationSummary(); setSummary(result.summary); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load the summary."); }
  }
  async function loadUniversities() {
    if (universities.length > 0) return;
    try { const result = await getUniversities(); setUniversities(result.universities); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load universities."); }
  }
  async function loadMissions() {
    try { const result = await getAdminMissions(); setMissions(result.missions); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load missions."); }
  }
  async function loadPromoCodes() {
    try { const result = await getAdminPromoCodes(); setPromoCodes(result.codes); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load promo codes."); }
  }

  // ── Handlers
  async function promote() {
    setNotice(""); setError(""); setPromoting(true);
    try {
      const result = await promoteAdminUser(promoteEmail.trim());
      setNotice(result.message || `${result.user.displayName || result.user.email} now has admin access.`);
      setPromoteEmail("");
      await loadAdmins();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not promote that account."); }
    finally { setPromoting(false); }
  }
  async function chooseUniversity(universityId: string) {
    setSelectedUniversity(universityId);
    setSelectedDepartment("");
    setDepartments([]);
    if (!universityId) return;
    try {
      const { faculties } = await getFaculties(universityId);
      const lists = await Promise.all(faculties.map((faculty: Faculty) => getDepartments(faculty.id)));
      setDepartments(lists.flatMap((list) => list.departments));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load departments."); }
  }
  async function restoreSuspension(user: AdminUser) {
    setNotice(""); setError("");
    try {
      const result = await unsuspendAdminUser(user.id);
      setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, ...result.user } : u)));
      setNotice(`${user.displayName || user.email} can sign in again.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not restore the account."); }
  }
  async function confirmSuspension(user: AdminUser, until: string, reasonText: string) {
    setNotice(""); setError(""); setSuspending(null);
    try {
      const result = await suspendAdminUser(user.id, { until, reason: reasonText });
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
    try { await deleteAdminMission(mission.id); setMissions((current) => current.filter((m) => (m.id !== mission.id))); setNotice("Mission deleted."); }
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
  function copyCode(code: string) {
    navigator.clipboard?.writeText(code)
      .then(() => { setCopiedCode(code); window.setTimeout(() => setCopiedCode(""), 2000); })
      .catch(() => setError("Could not copy the code — select it and copy manually."));
  }
  async function togglePromo(promo: AdminPromoCode) {
    setNotice(""); setError("");
    try { await updateAdminPromoCode(promo.id, { isActive: !promo.isActive }); setPromoCodes((current) => current.map((c) => (c.id === promo.id ? { ...c, isActive: !promo.isActive } : c))); setNotice(`Code ${promo.code} ${promo.isActive ? "paused" : "resumed"}.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the code."); }
  }
  async function removePromo(promo: AdminPromoCode) {
    if (!window.confirm(`Delete the promo code "${promo.code}"?`)) return;
    setNotice(""); setError("");
    try { await deleteAdminPromoCode(promo.id); setPromoCodes((current) => current.filter((c) => (c.id !== promo.id))); setNotice("Promo code deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete the code."); }
  }

  // ── Section-scoped data loading: entering a section pulls its data once,
  // then only filter/pagination changes trigger further fetches.
  useEffect(() => {
    setNotice(""); setError(""); setNavOpen(false);
    if (section === "users") void loadUniversities();
    if (section === "overview" || section === "submissions") void loadSummary();
    if (section === "admins") void loadAdmins();
    if (section === "missions") void loadMissions();
    if (section === "promo") void loadPromoCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);
  useEffect(() => {
    if (section === "users") void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, usersPage, usersRole, usersRecent, usersSearch, selectedUniversity, selectedDepartment]);
  useEffect(() => {
    if (section === "overview" || section === "activity") void loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, activityPage, activityType, activitySearch]);
  useEffect(() => {
    if (section === "submissions") void loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, submissionsPage, submissionStatus, submissionSearch]);

  return (
    <div className="min-h-screen bg-wash">
      <AdminSidebar section={section} open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className="fixed inset-0 z-30 bg-backdrop max-1020:block hidden" onClick={() => setNavOpen(false)} />}
      <div className="pl-240 max-1020:pl-0">
        <header className="sticky top-0 z-20 flex h-64 items-center gap-12 border-b border-line bg-wash px-20 max-680:px-14">
          <button className="hidden max-1020:grid h-36 w-36 shrink-0 place-items-center rounded-10 border border-line bg-white text-ink" aria-label="Open admin menu" onClick={() => setNavOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <p className="eyebrow">Admin board</p>
            <h1 className="m-0 truncate text-15 font-bold text-ink">{ADMIN_TITLES[section] ?? "Admin"}</h1>
          </div>
          <button className="ml-auto inline-flex shrink-0 items-center gap-6 rounded-999 border border-line bg-white px-14 py-8 text-12 font-semibold text-brand transition-colors hover:bg-pale" onClick={() => go("dashboard")}>
            <ArrowLeft size={14} /> Back to main app
          </button>
        </header>
        <main className="mx-auto w-full max-w-860 px-16 py-24 max-680:px-12">
          {notice && <div className="admin-notice mb-16"><Check size={14} /> {notice}</div>}
          {error && <div className="admin-feedback-error mb-16"><Ban size={14} /> {error}</div>}

          {section === "overview" && (
            <div className="flex flex-col gap-18">
              <div className="grid grid-cols-2 gap-12 max-680:grid-cols-1">
                <Metric icon={<Users size={16} />} value={summary ? String(summary.users) : "—"} label="People on the platform" tone="blue" />
                <Metric icon={<Clock3 size={16} />} value={summary ? String(summary.pending) : "—"} label="Submissions awaiting review" tone="amber" />
                <Metric icon={<Check size={16} />} value={summary ? String(summary.approved) : "—"} label="Approved papers" tone="green" />
                <Metric icon={<Ban size={16} />} value={summary ? String(summary.rejected) : "—"} label="Rejected papers" tone="red" />
                <Metric icon={<Sparkles size={16} />} value={summary ? String(summary.generatedSets) : "—"} label="Study sets generated" tone="blue" />
              </div>
              <div>
                <p className="eyebrow">Jump to</p>
                <div className="mt-8 grid grid-cols-2 gap-12 max-680:grid-cols-1">
                  {QUICK_LINKS.map((item) => (
                    <button key={item.route} className="flex items-start gap-12 rounded-13 border border-line bg-white p-16 text-left shadow-card transition-shadow hover:shadow-brand-xl" onClick={() => go(item.route)}>
                      <span className="grid h-38 w-38 shrink-0 place-items-center rounded-10 bg-pale text-brand">{item.icon}</span>
                      <span className="min-w-0">
                        <strong className="block text-13 font-bold text-ink">{item.title}</strong>
                        <small className="mt-3 block text-12 text-muted">{item.text}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div><p className="eyebrow">Signals</p><h2>Latest activity</h2></div>
                  <button className="ghost-button" onClick={() => go("admin-activity")}>View all</button>
                </div>
                <div className="admin-activity-list">
                  {activity.length === 0 ? (
                    <div className="admin-empty"><Activity size={20} /><span>No activity recorded yet.</span></div>
                  ) : (
                    activity.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
                  )}
                </div>
              </section>
            </div>
          )}

          {section === "admins" && (
            <div className="rounded-13 border border-line bg-white p-20 shadow-card max-680:p-16">
              <p className="eyebrow">Grant access</p>
              <h2 className="mb-0 mt-4 text-[17px] font-bold text-ink">Make another person an admin</h2>
              <p className="mb-0 mt-6 text-13 leading-160 text-muted">They must have signed up already — all you need is the email they registered with. Their account gets full board access immediately.</p>
              <div className="mt-14 flex gap-10 max-680:flex-col">
                <input
                  value={promoteEmail}
                  onChange={(event) => setPromoteEmail(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && promoteEmail.includes("@") && !promoting) void promote(); }}
                  placeholder="Email they registered with e.g. ada@unilag.edu.ng"
                  className="min-w-0 flex-1 rounded-10 border border-line bg-white px-14 py-10 text-13 text-ink outline-none placeholder:text-slate-icon focus:border-outline focus:shadow-focus"
                />
                <button className="inline-flex shrink-0 items-center justify-center gap-8 rounded-10 bg-brand px-18 py-10 text-13 font-semibold text-white shadow-brand-md transition-shadow hover:shadow-brand-lg disabled:opacity-50" disabled={!promoteEmail.includes("@") || promoting} onClick={() => void promote()}>
                  <ShieldCheck size={15} /> Grant admin
                </button>
              </div>
              <p className="mb-6 mt-18 text-11 font-bold uppercase tracking-wide text-muted">Current admins ({admins.length})</p>
              <div className="flex flex-col divide-y divide-line">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center gap-10 py-10">
                    <span className="grid h-32 w-32 shrink-0 place-items-center rounded-half bg-pale text-brand"><UserRound size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-13 font-semibold text-ink">{admin.displayName || admin.username || admin.email}</p>
                      <p className="m-0 truncate text-11 text-muted">{admin.email}</p>
                    </div>
                    <span className="shrink-0 text-11 text-muted">joined {new Date(admin.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
                {admins.length === 0 && <p className="m-0 py-10 text-13 text-muted">No admins listed yet.</p>}
              </div>
            </div>
          )}

          {section === "users" && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div><p className="eyebrow">People</p><h2>Student directory</h2></div>
                <span className="admin-status"><Users size={14} /> {usersPagination.total} users</span>
              </div>
              <p className="admin-panel-help">Search by name, username or email, then suspend or restore an account. Suspended students cannot sign in until it lifts.</p>
              <div className="admin-filters">
                <label className="admin-search">
                  <Search size={16} />
                  <input
                    value={usersSearchInput}
                    onChange={(event) => setUsersSearchInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") setUsersSearch(usersSearchInput.trim()); }}
                    placeholder="Search name, username, or email"
                  />
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
                <button className="secondary-button" onClick={() => setUsersSearch(usersSearchInput.trim())}>Search</button>
              </div>
              <div className="admin-user-list">
                {users.length === 0 ? (
                  <div className="admin-empty"><UserRound size={20} /><span>No users match these filters.</span></div>
                ) : (
                  users.map((user) => {
                    const suspended = Boolean(user.suspendedUntil && new Date(user.suspendedUntil) > new Date());
                    return <UserRow key={user.id} user={user} onToggle={() => (suspended ? void restoreSuspension(user) : setSuspending(user))} />;
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
          )}

          {section === "activity" && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div><p className="eyebrow">Signals</p><h2>Recent activity</h2></div>
                <span className="admin-status"><Activity size={14} /> {activityPagination.total} events</span>
              </div>
              <p className="admin-panel-help">The newest 15 events per page — filter by kind or search for the person behind the event.</p>
              <div className="admin-filters">
                <select value={activityType} onChange={(event) => { setActivityType(event.target.value); setActivityPage(1); }}>
                  <option value="all">Everything</option>
                  <option value="SIGNUP">Signups</option>
                  <option value="REFERRAL">Referrals</option>
                  <option value="USER">Suspensions</option>
                  <option value="MISSION">Missions</option>
                  <option value="PROMO">Promo codes</option>
                  <option value="ADMIN">Admin changes</option>
                </select>
                <label className="admin-search">
                  <Search size={16} />
                  <input
                    value={activitySearchInput}
                    onChange={(event) => setActivitySearchInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { setActivitySearch(activitySearchInput.trim()); setActivityPage(1); } }}
                    placeholder="Search who did it — name or email"
                  />
                </label>
                <button className="secondary-button" onClick={() => { setActivitySearch(activitySearchInput.trim()); setActivityPage(1); }}>Search</button>
              </div>
              <div className="admin-activity-list">
                {activity.length === 0 ? (
                  <div className="admin-empty"><Activity size={20} /><span>No activity matches these filters.</span></div>
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
          )}

          {section === "missions" && (
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
          )}

          {section === "promo" && (
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
          )}

          {section === "submissions" && (
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
                  <input
                    value={submissionSearchInput}
                    onChange={(event) => setSubmissionSearchInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { setSubmissionSearch(submissionSearchInput.trim()); setSubmissionsPage(1); } }}
                    placeholder="Search course or owner"
                  />
                </label>
                <button className="secondary-button" onClick={() => { setSubmissionSearch(submissionSearchInput.trim()); setSubmissionsPage(1); }}>Search</button>
              </div>
              <div className="admin-submission-list">
                {submissions.length === 0 ? (
                  <div className="admin-empty"><FileText size={20} /><span>Nothing here — try another status or search.</span></div>
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
          )}
        </main>
      </div>
      {suspending && (
        <SuspendDialog
          user={suspending}
          onClose={() => setSuspending(null)}
          onConfirm={(until, reason) => void confirmSuspension(suspending, until, reason)}
        />
      )}
    </div>
  );
}
function Metric({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone: "blue" | "amber" | "green" | "red" }) {
  const tones: Record<string, string> = {
    blue: "bg-pale text-brand",
    amber: "bg-warning-surface text-warning-icon",
    green: "bg-success-soft text-success-icon",
    red: "bg-[#fee2e2] text-[#dc2626]",
  };
  return (
    <div className="flex items-center gap-12 rounded-13 border border-line bg-white p-16 shadow-card">
      <span className={`grid h-36 w-36 shrink-0 place-items-center rounded-10 ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <strong className="block text-[20px] font-bold leading-none text-ink">{value}</strong>
        <small className="mt-4 block text-11 text-muted">{label}</small>
      </div>
    </div>
  );
}

function AdminSidebar({ section, open, onClose }: { section: string; open: boolean; onClose: () => void }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-240 flex-col border-r border-line bg-white transition-transform duration-200 ${open ? "translate-x-0" : "max-1020:-translate-x-full"}`}>
      <div className="flex items-center gap-10 border-b border-line px-18 py-16">
        <span className="grid h-34 w-34 shrink-0 place-items-center rounded-10 bg-brand text-white shadow-brand-sm"><ShieldCheck size={17} /></span>
        <div className="min-w-0">
          <p className="m-0 text-13 font-bold text-ink">Admin board</p>
          <p className="m-0 text-11 text-muted">RecappEdu control</p>
        </div>
      </div>
      <button className="flex items-center gap-8 border-b border-line px-18 py-12 text-12 font-semibold text-brand transition-colors hover:bg-pale" onClick={() => { go("dashboard"); onClose(); }}>
        <ArrowLeft size={14} /> Back to main app
      </button>
      <nav className="flex-1 overflow-y-auto p-10">
        {ADMIN_NAV.map((item) => (
          <button
            key={item.key}
            className={`mb-2 flex w-full items-center gap-10 rounded-10 px-12 py-10 text-13 font-semibold transition-colors ${section === item.key ? "bg-brand text-white shadow-brand-sm" : "text-muted hover:bg-pale hover:text-brand"}`}
            onClick={() => { go(item.route); onClose(); }}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      <p className="m-0 border-t border-line px-18 py-12 text-11 text-muted">Signed in with super access</p>
    </aside>
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
