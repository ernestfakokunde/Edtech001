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

  return <PageFrame eyebrow="Your rewards" title="Rewards" subtitle="Earn XP, invite friends, and redeem codes in one place." back="dashboard">
    <div className="mb-17 flex items-center gap-13 rounded-16 border border-[#e4e5f6] bg-[linear-gradient(110deg,#f1f0ff,#fff)] px-20 py-17"><span className="grid size-42 place-items-center rounded-13 bg-white text-brand"><Award size={22} /></span><div><small className="block text-10 text-muted">Level {level}</small><strong className="mt-2 block font-grotesk text-[20px] font-extrabold text-[#312e81]">{xp} XP</strong></div><span className="ml-auto text-11 text-muted max-760:hidden">{200 - (xp % 200)} XP to level {level + 1}</span></div>
    {message && <p className="mt-16 flex items-center gap-7 text-12 font-semibold text-[#047857]"><Check size={15} /> {message}</p>}
    {error && <p className="mt-16 flex items-center gap-7 text-12 font-semibold text-red-700">{error}</p>}
    <div className="grid grid-cols-[1.1fr_.9fr] items-start gap-22 max-760:grid-cols-1">
      <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] m-0 [&_.profile-card-heading_h2]:m-0 [&_.profile-card-heading_h2]:font-grotesk [&_.profile-card-heading_h2]:text-21 [&_.profile-card-heading_h2]:font-bold [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted border border-[#bbf7d0] bg-[linear-gradient(135deg,#f0fdf4,#fff_72%)]"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 bg-[#ecfdf5] text-[#047857]"><Check size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Daily reward</p><h2>Sign in and earn XP</h2></div><strong className="ml-auto shrink-0 whitespace-nowrap font-grotesk text-17 font-bold text-[#15803d]">+{dailyLogin?.xpReward ?? 100} XP</strong></div><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">Your daily reward is added automatically the first time you sign in each day. There’s nothing to claim.</p><div className={`mt-14 flex items-center gap-7 text-12 ${dailyLogin?.claimedToday ? "font-bold text-[#15803d]" : "text-muted"}`}>{dailyLogin?.claimedToday ? <><Check size={14} /> Added to your balance today</> : "Earned automatically at your next sign-in"}</div></section>
      <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] m-0 [&_.profile-card-heading_h2]:m-0 [&_.profile-card-heading_h2]:font-grotesk [&_.profile-card-heading_h2]:text-21 [&_.profile-card-heading_h2]:font-bold [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 bg-[#fef3c7] text-[#b45309]"><Sparkles size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Challenges</p><h2>Extra ways to earn</h2></div></div><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">These optional challenges are separate from your automatic daily sign-in reward.</p>{missions.length ? <ul className="m-0 grid list-none gap-10 p-0">{missions.map((mission) => <li className={`flex items-center gap-12 rounded-12 border p-13 ${mission.claimedAt ? "border-[#bbf7d0] bg-[#f0fdf4]" : "border-line bg-white"}`} key={mission.id}><div className="grid size-34 shrink-0 place-items-center rounded-10 bg-pale text-brand"><Sparkles size={16} /></div><div className="grid min-w-0 flex-1 gap-2"><strong className="text-13 text-ink">{mission.title}</strong><span className="text-11 leading-[1.45] text-muted">{mission.description || "Complete this challenge to earn XP."}</span><small className="text-10 font-bold text-brand">+{mission.xpReward} XP</small></div>{mission.claimedAt ? <span className="inline-flex shrink-0 items-center gap-5 whitespace-nowrap rounded-full bg-[#ecfdf5] px-10 py-6 text-11 font-bold text-[#047857]"><Check size={13} /> Claimed</span> : <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={working === mission.id} onClick={() => void claim(mission.id)}>{working === mission.id ? "Claiming…" : "Claim"}</button>}</li>)}</ul> : <div className="px-12 py-18 text-12 text-muted">No challenges are available right now. Check back later.</div>}</section>
      <div className="grid gap-22">
        <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] m-0 [&_.profile-card-heading_h2]:m-0 [&_.profile-card-heading_h2]:font-grotesk [&_.profile-card-heading_h2]:text-21 [&_.profile-card-heading_h2]:font-bold [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 bg-[#ecfdf5] text-[#047857]"><PartyPopper size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Invite friends</p><h2>Share RecappEdu</h2></div></div><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">Invite a friend. You both earn bonus XP when they join with your code.</p>{referral?.referralCode ? <div className="mt-12 flex flex-wrap items-center gap-9"><code className="min-w-0 flex-[1_1_180px] rounded-10 border border-dashed border-[#93c5fd] bg-[#f8fbff] px-13 py-10 text-center font-mono text-14 font-bold tracking-[.1em] text-brand">{referral.referralCode}</code><button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void copyInvite()}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button></div> : <small className="mt-10 flex items-center gap-6 text-10 font-bold text-[#b45309]">Your invite code will appear here shortly.</small>}<small className="mt-10 flex items-center gap-6 text-10 font-bold text-[#047857]"><PartyPopper size={13} /> {referral?.invites ?? 0} friends joined</small></section>
        <section className="rounded-17 border border-line bg-white p-25 shadow-[0_14px_30px_#1d4ed80b] m-0 [&_.profile-card-heading_h2]:m-0 [&_.profile-card-heading_h2]:font-grotesk [&_.profile-card-heading_h2]:text-21 [&_.profile-card-heading_h2]:font-bold [&_.profile-help]:mb-22 [&_.profile-help]:mt-[-9px] [&_.profile-help]:text-12 [&_.profile-help]:leading-155 [&_.profile-help]:text-muted"><div className="mb-24 flex items-center gap-12 [&_.eyebrow]:mb-0 [&_h2]:m-0 [&_h2]:font-grotesk [&_h2]:text-21 [&_h2]:font-bold"><span className="grid size-42 place-items-center rounded-12 bg-pale text-brand"><Ticket size={20} /></span><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Have a code?</p><h2>Redeem a reward</h2></div></div><p className="mb-22 mt-[-9px] text-12 leading-155 text-muted">Enter a promo code for Pro time or bonus XP.</p><div className="flex flex-wrap items-center gap-10"><input className="min-w-0 flex-[1_1_180px] rounded-10 border border-line px-12 py-10 font-mono font-semibold uppercase tracking-[.08em]" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter promo code" maxLength={24} /><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={!code.trim() || working === "promo"} onClick={() => void redeem()}>{working === "promo" ? "Redeeming…" : "Redeem"}</button></div></section>
      </div>
    </div>
  </PageFrame>;
}
