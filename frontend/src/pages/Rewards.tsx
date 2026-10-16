import { useEffect, useState } from "react";
import { Award, Check, Copy, PartyPopper, Sparkles, Ticket } from "lucide-react";
import { PageFrame } from "../components/Layout";
import { claimMission, errorMessage, getMyMissions, getReferralInfo, redeemPromoCode, type ProfileMission, type ReferralInfo } from "../lib/api";

export function RewardsPage() {
  const [missions, setMissions] = useState<ProfileMission[]>([]);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [xp, setXp] = useState(0);
  const [dailyLogin, setDailyLogin] = useState<{ xpReward: number; claimedToday: boolean } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyMissions().then((result) => { setMissions(result.missions); setXp(result.xp); setDailyLogin(result.dailyLogin); }).catch(() => setError("Could not load rewards."));
    getReferralInfo().then((result) => setReferral(result.referral)).catch(() => undefined);
  }, []);

  async function claim(id: string) {
    setWorking(id); setError(""); setMessage("");
    try {
      const result = await claimMission(id);
      setMissions((current) => current.map((mission) => mission.id === id ? { ...mission, claimedAt: new Date().toISOString() } : mission));
      setXp(result.xp); setMessage(`${result.xpEarned} XP added to your rewards.`);
    } catch (reason) { setError(errorMessage(reason, "Could not claim this reward.")); }
    finally { setWorking(""); }
  }

  async function redeem() {
    setWorking("promo"); setError(""); setMessage("");
    try {
      const result = await redeemPromoCode(code.trim());
      setXp(result.xp); setCode("");
      const reward = [result.premiumDays ? `${result.premiumDays} Pro days` : "", result.xpBonus ? `${result.xpBonus} bonus XP` : ""].filter(Boolean).join(" and ");
      setMessage(reward ? `Code redeemed — you received ${reward}.` : "Code redeemed.");
    } catch (reason) { setError(errorMessage(reason, "Could not redeem that code.")); }
    finally { setWorking(""); }
  }

  async function copyInvite() {
    if (!referral?.referralCode) return;
    try { await navigator.clipboard.writeText(referral.referralCode); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError("Could not copy the code. Select it and copy manually."); }
  }

  return <PageFrame eyebrow="Your rewards" title="Rewards" subtitle="Earn XP, invite friends, and redeem codes in one place." back="dashboard">
    <div className="rewards-summary"><span><Award size={22} /></span><div><small>Your XP balance</small><strong>{xp} XP</strong></div><span className="rewards-summary-note">Keep studying to unlock more</span></div>
    {message && <p className="profile-feedback success"><Check size={15} /> {message}</p>}
    {error && <p className="profile-feedback error">{error}</p>}
    <div className="rewards-grid">
      <section className="profile-card daily-login-card"><div className="profile-card-heading"><span className="profile-icon green"><Check size={20} /></span><div><p className="eyebrow">Daily reward</p><h2>Sign in and earn XP</h2></div><strong className="daily-login-xp">+{dailyLogin?.xpReward ?? 100} XP</strong></div><p className="profile-help">Your daily reward is added automatically the first time you sign in each day. There’s nothing to claim.</p><div className={`daily-login-status ${dailyLogin?.claimedToday ? "earned" : "waiting"}`}>{dailyLogin?.claimedToday ? <><Check size={14} /> Added to your balance today</> : "Earned automatically at your next sign-in"}</div></section>
      <section className="profile-card"><div className="profile-card-heading"><span className="profile-icon gold"><Sparkles size={20} /></span><div><p className="eyebrow">Challenges</p><h2>Extra ways to earn</h2></div></div><p className="profile-help">These optional challenges are separate from your automatic daily sign-in reward.</p>{missions.length ? <ul className="mission-list">{missions.map((mission) => <li className={`mission-row ${mission.claimedAt ? "claimed" : ""}`} key={mission.id}><div className="mission-icon"><Sparkles size={16} /></div><div className="mission-main"><strong>{mission.title}</strong><span>{mission.description || "Complete this challenge to earn XP."}</span><small>+{mission.xpReward} XP</small></div>{mission.claimedAt ? <span className="mission-claimed"><Check size={13} /> Claimed</span> : <button className="primary-button" disabled={working === mission.id} onClick={() => void claim(mission.id)}>{working === mission.id ? "Claiming…" : "Claim"}</button>}</li>)}</ul> : <div className="rewards-empty">No challenges are available right now. Check back later.</div>}</section>
      <div className="rewards-side">
        <section className="profile-card"><div className="profile-card-heading"><span className="profile-icon green"><PartyPopper size={20} /></span><div><p className="eyebrow">Invite friends</p><h2>Share RecappEdu</h2></div></div><p className="profile-help">Invite a friend. You both earn bonus XP when they join with your code.</p>{referral?.referralCode ? <div className="referral-code-row"><code>{referral.referralCode}</code><button className="secondary-button" onClick={() => void copyInvite()}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button></div> : <small className="profile-saved-note pending">Your invite code will appear here shortly.</small>}<small className="profile-saved-note"><PartyPopper size={13} /> {referral?.invites ?? 0} friends joined</small></section>
        <section className="profile-card"><div className="profile-card-heading"><span className="profile-icon blue"><Ticket size={20} /></span><div><p className="eyebrow">Have a code?</p><h2>Redeem a reward</h2></div></div><p className="profile-help">Enter a promo code for Pro time or bonus XP.</p><div className="redeem-row"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter promo code" maxLength={24} /><button className="primary-button" disabled={!code.trim() || working === "promo"} onClick={() => void redeem()}>{working === "promo" ? "Redeeming…" : "Redeem"}</button></div></section>
      </div>
    </div>
  </PageFrame>;
}
