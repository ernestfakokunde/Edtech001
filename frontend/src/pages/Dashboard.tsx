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
  Ticket,
} from "lucide-react";
import { useEffect, useState } from "react";
import { displayNameOf, go, type ProfileIdentity } from "../components/Layout";
import { claimMission, errorMessage, getMyCourses, getMyMissions, redeemPromoCode, type MySchool, type ProfileMission } from "../lib/api";
import { getQuizStats } from "../lib/results";
import practiceArt from "../assets/brand1.png";

/* Student study desk. Everything shown here comes from the signed-in profile —
   the greeting, the school line and the action row all read real data (the page
   previously hard-coded a name, "EF" initials and a school). Missions and promo
   codes live here too, so the sidebar shortcuts have a real destination. */
export function Dashboard({ profile }: { profile: ProfileIdentity }) {
  const [stats, setStats] = useState({ attempts: 0, average: 0, best: 0, streak: 0 });
  const [school, setSchool] = useState<MySchool>(null);
  const [courses, setCourses] = useState<{ id: string; code: string; title: string }[]>([]);
  const [missions, setMissions] = useState<ProfileMission[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [xp, setXp] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setStats(getQuizStats());
    // Each block is independent and best-effort: a failing call leaves its card
    // in the empty state instead of blanking the whole dashboard.
    getMyCourses()
      .then((result) => { setSchool(result.school); setCourses(result.courses); })
      .catch(() => { /* the courses card falls back to its empty state */ });
    getMyMissions()
      .then((result) => { setMissions(result.missions); setXp(result.xp); })
      .catch(() => { /* missions stay hidden until the next visit */ });
  }, []);

  async function claim(missionId: string) {
    setClaimingId(missionId); setError(""); setMessage("");
    try {
      const result = await claimMission(missionId);
      setMissions((current) => current.map((mission) => (mission.id === missionId ? { ...mission, claimedAt: new Date().toISOString() } : mission)));
      setXp(result.xp);
      setMessage(`${result.xpEarned} XP claimed — you now have ${result.xp} XP.`);
    } catch (reason) { setError(errorMessage(reason, "Could not claim this mission.")); }
    finally { setClaimingId(null); }
  }

  async function redeem() {
    setError(""); setMessage(""); setRedeeming(true);
    try {
      const result = await redeemPromoCode(redeemCode.trim());
      const parts: string[] = [];
      if (result.premiumDays > 0) parts.push(`${result.premiumDays} free Pro day${result.premiumDays === 1 ? "" : "s"}`);
      if (result.xpBonus > 0) parts.push(`${result.xpBonus} bonus XP`);
      setXp(result.xp);
      setRedeemCode("");
      setMessage(parts.length ? `Code redeemed — enjoy ${parts.join(" and ")}!` : "Code redeemed.");
    } catch (reason) { setError(errorMessage(reason, "Could not redeem that code.")); }
    finally { setRedeeming(false); }
  }

  const openMissions = missions.filter((mission) => !mission.claimedAt).slice(0, 3);
  /* Nothing has been practised on this device yet, so the desk opens with the
     one thing the product is for. It retires itself after the first saved quiz
     (`stats.attempts` comes from lib/results). */
  const firstPractice = stats.attempts === 0;

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

      <section className="metric-grid">
        <Metric icon={<Flame size={15} />} value={String(stats.streak)} label="Day streak" tone="amber" />
        <Metric icon={<Layers3 size={15} />} value={String(stats.attempts)} label="Quizzes taken" tone="blue" />
        <Metric icon={<Check size={15} />} value={stats.attempts ? `${stats.average}%` : "—"} label="Avg. quiz score" tone="green" />
        <Metric icon={<Sparkles size={15} />} value={String(xp)} label="XP earned" tone="amber" />
      </section>

      <DashboardSection title="Your courses" action="Manage" onAction={() => go("profile")}>
        <div className="dashboard-course-grid">
          {courses.length === 0 ? (
            <div className="dashboard-empty"><BookOpen size={20} /><strong>No course added yet</strong><span>Open the repository to find a paper or add a course on your profile.</span></div>
          ) : (
            courses.slice(0, 4).map((course) => (
              <article className="dashboard-course" key={course.id}>
                <div>
                  <strong>{course.code}</strong>
                  <small>{course.title}</small>
                </div>
                <button className="ghost-button" onClick={() => go(`generate/${encodeURIComponent(course.id)}`)}><Sparkles size={14} /> Practice</button>
              </article>
            ))
          )}
          <button className="dashboard-add-course" onClick={() => go("hierarchy")}><span><Plus size={15} /></span><strong>Browse or upload a material</strong></button>
        </div>
      </DashboardSection>

      <section className="dashboard-quick-actions">
        <button onClick={() => go("generate")}><Sparkles size={16} /><span><strong>Create from my PDF</strong><small>Private AI practice set</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("hierarchy")}><FileText size={16} /><span><strong>Browse course repository</strong><small>Find papers by course</small></span><ArrowRight size={16} /></button>
        <button onClick={() => go("history")}><History size={16} /><span><strong>Past quiz results</strong><small>{stats.attempts ? `${stats.attempts} saved · best ${stats.best}%` : "Scores appear here"}</small></span><ArrowRight size={16} /></button>
      </section>

      <div className="mt-31 grid grid-cols-2 gap-16 max-760:grid-cols-1">
        <section className="profile-card missions-card">
          <div className="profile-card-heading">
            <span className="profile-icon gold"><Sparkles size={20} /></span>
            <div><p className="eyebrow">Missions</p><h2>Claim XP</h2></div>
          </div>
          <p className="profile-help">Complete a challenge and claim its XP once. Points build up on your profile as you go.</p>
          {openMissions.length === 0 ? (
            <small className="profile-saved-note pending">No missions to claim right now — check back soon.</small>
          ) : (
            <ul className="mission-list">
              {openMissions.map((mission) => (
                <li className="mission-row" key={mission.id}>
                  <div className="mission-icon"><Sparkles size={16} /></div>
                  <div className="mission-main">
                    <strong>{mission.title}</strong>
                    <span>{mission.description || "Complete this challenge to earn XP."}</span>
                    <small>+{mission.xpReward} XP</small>
                  </div>
                  <button className="primary-button" disabled={claimingId === mission.id} onClick={() => void claim(mission.id)}>
                    {claimingId === mission.id ? "Claiming…" : "Claim"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="secondary-button mt-10" onClick={() => go("profile/missions")}>See all missions</button>
        </section>

        <section className="profile-card redeem-card">
          <div className="profile-card-heading">
            <span className="profile-icon blue"><Ticket size={20} /></span>
            <div><p className="eyebrow">Promo codes</p><h2>Redeem a code</h2></div>
          </div>
          <p className="profile-help">Got a code from us — a free Pro week, bonus XP? Redeem it here. Each code works once per student.</p>
          <div className="redeem-row">
            <input value={redeemCode} onChange={(event) => setRedeemCode(event.target.value.toUpperCase())} placeholder="e.g. RECAPP-WEEK1" maxLength={24} />
            <button className="primary-button" disabled={!redeemCode.trim() || redeeming} onClick={() => void redeem()}>
              {redeeming ? "Redeeming…" : "Redeem"}
            </button>
          </div>
        </section>
      </div>

      {message && <p className="profile-feedback success"><Check size={15} /> {message}</p>}
      {error && <p className="profile-feedback error" role="alert">{error}</p>}
    </main>
  );
}

function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: string }) { return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function DashboardSection({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) { return <section className="dashboard-section"><div className="dashboard-section-head"><h2>{title}</h2><button onClick={onAction}>{action}</button></div>{children}</section>; }
