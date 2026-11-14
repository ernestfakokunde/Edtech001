import { useEffect, useState } from "react";
import { Award, Check, Copy, PartyPopper, Sparkles, Ticket } from "lucide-react";
import { PageFrame } from "../components/Layout";
import { claimMission, errorMessage, getMyMissions, getReferralInfo, redeemPromoCode, type ProfileMission, type ReferralInfo } from "../lib/api";

export function RewardsPage() {
  const [missions, setMissions] = useState<ProfileMission[]>([]);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [dailyLogin, setDailyLogin] = useState<{ xpReward: number; claimedToday: boolean } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyMissions().then((result) => { setMissions(result.missions); setXp(result.xp); setLevel(result.level); setDailyLogin(result.dailyLogin); }).catch(() => setError("Could not load rewards."));
    getReferralInfo().then((result) => setReferral(result.referral)).catch(() => undefined);
  }, []);

  async function claim(id: string) {
    setWorking(id); setError(""); setMessage("");
    try {
      const result = await claimMission(id);
      setMissions((current) => current.map((mission) => mission.id === id ? { ...mission, claimedAt: new Date().toISOString() } : mission));
      setXp(result.xp); setLevel(result.level); setMessage(`${result.xpEarned} XP added to your rewards.`);
    } catch (reason) { setError(errorMessage(reason, "Could not claim this reward.")); }
    finally { setWorking(""); }
  }

  async function redeem() {
    setWorking("promo"); setError(""); setMessage("");
    try {
      const result = await redeemPromoCode(code.trim());
      setXp(result.xp); setLevel(result.level); setCode("");
      const reward = [`Student Plus (${result.credits} AI credits/month)`, result.xpBonus ? `${result.xpBonus} bonus XP` : ""].filter(Boolean).join(" and ");
      setMessage(reward ? `Code redeemed — you received ${reward}.` : "Code redeemed.");
    } catch (reason) { setError(errorMessage(reason, "Could not redeem that code.")); }
    finally { setWorking(""); }
  }

  async function copyInvite() {
    if (!referral?.referralCode) return;
    try { await navigator.clipboard.writeText(referral.referralCode); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError("Could not copy the code. Select it and copy manually."); }
  }

  return (
    <PageFrame eyebrow="Your rewards" title="Rewards" subtitle="Earn XP, invite friends, and redeem codes in one place." back="dashboard">
      <section className="panel-muted mb-18 flex flex-wrap items-center gap-14">
        <span className="grid size-44 shrink-0 place-items-center rounded-13 bg-surface text-brand shadow-card"><Award size={22} /></span>
        <div className="min-w-0">
          <small className="block text-10 font-semibold uppercase tracking-[.08em] text-muted">Level {level}</small>
          <strong className="mt-2 block font-grotesk text-[22px] font-extrabold leading-none text-ink">{xp} XP</strong>
        </div>
        <span className="ml-auto text-11 text-muted max-760:hidden">{200 - (xp % 200)} XP to level {level + 1}</span>
      </section>
      {message && <p className="notice notice-success mb-14" role="status"><Check size={15} /> {message}</p>}
      {error && <p className="notice notice-error mb-14" role="alert">{error}</p>}

      <div className="grid grid-cols-[1.05fr_.95fr] items-start gap-20 max-860:grid-cols-1">
        <div className="grid gap-20">
          <section className="panel">
            <div className="mb-14 flex items-start gap-12">
              <span className="panel-icon bg-success-soft text-success-icon"><Check size={20} /></span>
              <div className="min-w-0">
                <p className="eyebrow mb-4">Daily reward</p>
                <h2 className="m-0 font-grotesk text-19 tracking-[-.02em]">Sign in and earn XP</h2>
              </div>
              <strong className="ml-auto shrink-0 whitespace-nowrap font-grotesk text-17 font-bold text-success-deep">+{dailyLogin?.xpReward ?? 100} XP</strong>
            </div>
            <p className="m-0 mb-14 text-12 leading-155 text-muted">Your daily reward is added automatically the first time you sign in each day. There’s nothing to claim.</p>
            <div className={`flex items-center gap-7 text-12 ${dailyLogin?.claimedToday ? "font-bold text-success-deep" : "text-muted"}`}>
              {dailyLogin?.claimedToday ? <><Check size={14} /> Added to your balance today</> : "Earned automatically at your next sign-in"}
            </div>
          </section>

          <section className="panel">
            <div className="mb-14 flex items-start gap-12">
              <span className="panel-icon"><Sparkles size={20} /></span>
              <div className="min-w-0">
                <p className="eyebrow mb-4">Challenges</p>
                <h2 className="m-0 font-grotesk text-19 tracking-[-.02em]">Extra ways to earn</h2>
              </div>
            </div>
            <p className="m-0 mb-14 text-12 leading-155 text-muted">These optional challenges are separate from your automatic daily sign-in reward.</p>
            {missions.length ? (
              <ul className="m-0 grid list-none gap-10 p-0">
                {missions.map((mission) => (
                  <li className={`flex items-center gap-12 rounded-12 border p-13 ${mission.claimedAt ? "border-success-border bg-success-soft" : "border-line bg-surface"}`} key={mission.id}>
                    <span className="grid size-34 shrink-0 place-items-center rounded-10 bg-pale text-brand"><Sparkles size={16} /></span>
                    <div className="grid min-w-0 flex-1 gap-2">
                      <strong className="text-13 text-ink">{mission.title}</strong>
                      <span className="text-11 leading-145 text-muted">{mission.description || "Complete this challenge to earn XP."}</span>
                      <small className="text-10 font-bold text-brand">+{mission.xpReward} XP</small>
                    </div>
                    {mission.claimedAt
                      ? <span className="inline-flex shrink-0 items-center gap-5 whitespace-nowrap rounded-full bg-success-surface px-10 py-6 text-11 font-bold text-success-text"><Check size={13} /> Claimed</span>
                      : <button className="btn btn-primary btn-sm shrink-0" disabled={working === mission.id} onClick={() => void claim(mission.id)}>{working === mission.id ? "Claiming…" : "Claim"}</button>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-12 border border-dashed border-line px-12 py-18 text-12 text-muted">No challenges are available right now. Check back later.</div>
            )}
          </section>
        </div>

        <div className="grid gap-20">
          <section className="panel">
            <div className="mb-14 flex items-start gap-12">
              <span className="panel-icon bg-success-soft text-success-icon"><PartyPopper size={20} /></span>
              <div className="min-w-0">
                <p className="eyebrow mb-4">Invite friends</p>
                <h2 className="m-0 font-grotesk text-19 tracking-[-.02em]">Share RecappEdu</h2>
              </div>
            </div>
            <p className="m-0 mb-14 text-12 leading-155 text-muted">Invite a friend. You both earn bonus XP when they join with your code.</p>
            {referral?.referralCode ? (
              <div className="flex flex-wrap items-center gap-9">
                <code className="min-w-0 flex-[1_1_180px] rounded-10 border border-dashed border-outline bg-pale px-13 py-11 text-center font-mono text-14 font-bold tracking-[.1em] text-brand">{referral.referralCode}</code>
                <button className="btn btn-secondary btn-sm" onClick={() => void copyInvite()}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
              </div>
            ) : (
              <small className="mt-2 flex items-center gap-6 text-10 font-bold text-warning">Your invite code will appear here shortly.</small>
            )}
            <small className="mt-10 flex items-center gap-6 text-10 font-bold text-success-deep"><PartyPopper size={13} /> {referral?.invites ?? 0} friends joined</small>
          </section>

          <section className="panel">
            <div className="mb-14 flex items-start gap-12">
              <span className="panel-icon"><Ticket size={20} /></span>
              <div className="min-w-0">
                <p className="eyebrow mb-4">Have a code?</p>
                <h2 className="m-0 font-grotesk text-19 tracking-[-.02em]">Redeem a reward</h2>
              </div>
            </div>
            <p className="m-0 mb-14 text-12 leading-155 text-muted">Enter a promo code for Pro time or bonus XP.</p>
            <div className="flex flex-wrap items-center gap-9 max-480:flex-col max-480:items-stretch">
              <input className="field-input min-w-0 flex-[1_1_180px] font-mono font-semibold uppercase tracking-[.08em]" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter promo code" maxLength={24} aria-label="Promo code" />
              <button className="btn btn-primary btn-sm shrink-0 max-480:w-full" disabled={!code.trim() || working === "promo"} onClick={() => void redeem()}>{working === "promo" ? "Redeeming…" : "Redeem"}</button>
            </div>
          </section>
        </div>
      </div>
    </PageFrame>
  );
}
