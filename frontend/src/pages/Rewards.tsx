import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Award, Check, Copy, Gift, PartyPopper, Sparkles, Ticket, Trophy, Zap } from "lucide-react";
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

  async function redeem(event?: FormEvent) {
    event?.preventDefault();
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
    try { await navigator.clipboard.writeText(referral.referralCode); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setError("Could not copy the code. Select it and copy manually."); }
  }

  const progress = xp % 200;
  const remaining = 200 - progress;
  const unclaimed = missions.filter((mission) => !mission.claimedAt).length;

  return (
    <PageFrame eyebrow="Your rewards" title="Rewards" subtitle="Small wins add up. Build a streak, complete challenges, and celebrate your progress." back="dashboard">
      <div className="rewards-page">
        <section className="rewards-hero">
          <div className="rewards-hero-copy">
            <span className="rewards-hero-icon"><Trophy size={22} /></span>
            <div><p className="rewards-eyebrow">Your learning journey</p><h2>Keep your momentum going</h2><p>Every study session brings your next milestone closer.</p></div>
          </div>
          <div className="rewards-level-card">
            <div className="rewards-level-top"><span className="rewards-level-mark"><Award size={17} /></span><span>LEVEL {level}</span><strong>{xp.toLocaleString()} <small>XP</small></strong></div>
            <div className="rewards-progress-track" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={200} aria-valuenow={progress}><span style={{ width: `${(progress / 200) * 100}%` }} /></div>
            <div className="rewards-progress-caption"><span>{progress} / 200 XP</span><strong>{remaining} XP to Level {level + 1}</strong></div>
          </div>
          <span className="rewards-hero-sparkle rewards-hero-sparkle-one"><Sparkles size={18} /></span>
          <span className="rewards-hero-sparkle rewards-hero-sparkle-two"><Zap size={15} /></span>
        </section>

        {(message || error) && <div className={`rewards-notice ${error ? "error" : "success"}`} role="status">{error ? <Ticket size={16} /> : <Check size={16} />}{error || message}</div>}

        <section className="rewards-daily-card">
          <span className="rewards-feature-icon"><Zap size={19} /></span>
          <div className="rewards-feature-copy"><p className="rewards-eyebrow">Your daily boost</p><h2>Show up and earn</h2><p>Your daily XP reward is added automatically the first time you sign in each day.</p><small className={dailyLogin?.claimedToday ? "is-earned" : ""}>{dailyLogin?.claimedToday ? <><Check size={13} /> Added to your balance today</> : "Ready for you at your next sign-in"}</small></div>
          <strong className="rewards-xp-pill">+{dailyLogin?.xpReward ?? 100}<span>XP</span></strong>
        </section>

        <div className="rewards-content-grid">
          <section className="rewards-panel rewards-missions">
            <header className="rewards-panel-heading"><span className="rewards-panel-icon"><Sparkles size={18} /></span><div><p className="rewards-eyebrow">Challenges</p><h2>Extra ways to earn</h2><p>Finish a challenge and claim your XP.</p></div><span className="rewards-count-badge">{unclaimed} left</span></header>
            {missions.length ? <ul className="rewards-mission-list">{missions.map((mission) => <li className={`rewards-mission ${mission.claimedAt ? "claimed" : ""}`} key={mission.id}>
              <span className="rewards-mission-icon">{mission.claimedAt ? <Check size={16} /> : <Gift size={16} />}</span>
              <div className="rewards-mission-copy"><strong>{mission.title}</strong><span>{mission.description || "Complete this challenge to earn XP."}</span><small>+{mission.xpReward} XP</small></div>
              {mission.claimedAt ? <span className="rewards-claimed"><Check size={13} /> Claimed</span> : <button className="rewards-claim-button" disabled={working === mission.id} onClick={() => void claim(mission.id)}>{working === mission.id ? "Claiming…" : "Claim"}<ArrowRight size={14} /></button>}
            </li>)}</ul> : <div className="rewards-empty"><span><PartyPopper size={19} /></span><strong>You’re all caught up</strong><p>New challenges will show up here as they become available.</p></div>}
          </section>

          <div className="rewards-side-stack">
            <section className="rewards-panel">
              <header className="rewards-panel-heading"><span className="rewards-panel-icon invite"><PartyPopper size={18} /></span><div><p className="rewards-eyebrow">Pass it on</p><h2>Invite a study buddy</h2></div></header>
              <p className="rewards-panel-description">Share your code. You both earn bonus XP when they join.</p>
              {referral?.referralCode ? <div className="rewards-invite-row"><code>{referral.referralCode}</code><button className="rewards-copy-button" onClick={() => void copyInvite()} aria-label="Copy invite code">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}</button></div> : <p className="rewards-code-pending">Your invite code will appear here shortly.</p>}
              <div className="rewards-invite-count"><span className="rewards-friend-avatars"><i>✦</i><i>✦</i><i>✦</i></span><strong>{referral?.invites ?? 0} friends joined</strong></div>
            </section>

            <section className="rewards-panel rewards-redeem-panel">
              <header className="rewards-panel-heading"><span className="rewards-panel-icon ticket"><Ticket size={18} /></span><div><p className="rewards-eyebrow">A little extra</p><h2>Redeem a code</h2></div></header>
              <p className="rewards-panel-description">Unlock plan access or bonus XP with a promo code.</p>
              <form className="rewards-redeem-form" onSubmit={(event) => void redeem(event)}><label className="sr-only" htmlFor="rewards-promo-code">Promo code</label><input id="rewards-promo-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ENTER YOUR CODE" maxLength={24} autoComplete="off" /><button className="rewards-claim-button" disabled={!code.trim() || working === "promo"}>{working === "promo" ? "Checking…" : "Redeem"}<ArrowRight size={14} /></button></form>
            </section>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
