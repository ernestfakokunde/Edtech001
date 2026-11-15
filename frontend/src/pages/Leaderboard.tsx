import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Award, CalendarDays, ChevronDown, ChevronUp, CircleAlert, Crown, Globe2,
  GraduationCap, Loader2, Medal, Minus, RefreshCw, Sparkles, Timer, Trophy, Users,
} from "lucide-react";
import { PageFrame, go } from "../components/Layout";
import {
  errorMessage, getLeaderboard,
  type LeaderboardData, type LeaderboardEntry, type LeaderboardRange, type LeaderboardScope,
} from "../lib/api";

const RANGE_LABELS: Record<LeaderboardRange, string> = {
  weekly: "This week",
  monthly: "This month",
  "all-time": "All time",
};

const RANGE_NOTES: Record<LeaderboardRange, string> = {
  weekly: "XP earned since Monday 00:00 UTC.",
  monthly: "XP earned since the first day of this month.",
  "all-time": "Total XP earned across every competition.",
};

function monogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function periodDates(data: LeaderboardData | null) {
  if (!data?.period.startsAt || !data.period.endsAt) return "Every learner, since the beginning";
  const end = new Date(new Date(data.period.endsAt).getTime() - 1);
  return `${formatDate(data.period.startsAt)} – ${formatDate(end.toISOString())}, ${end.getFullYear()}`;
}

function countdownLabel(endsAt: string | undefined, now: number) {
  if (!endsAt) return "—";
  const remaining = new Date(endsAt).getTime() - now;
  if (remaining <= 0) return "Resetting…";
  const seconds = Math.floor(remaining / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function schoolOf(entry: Pick<LeaderboardEntry, "universityName" | "facultyName">) {
  if (entry.universityName && entry.facultyName) return `${entry.universityName} · ${entry.facultyName}`;
  return entry.universityName || entry.facultyName || "RecappEdu learner";
}

function movementCopy(delta: number | null, range: LeaderboardRange) {
  const window = range === "weekly" ? "this week" : range === "monthly" ? "this month" : "since last week";
  if (delta === null) return "new this period";
  if (delta > 0) return `up ${delta} ${window}`;
  if (delta < 0) return `down ${Math.abs(delta)} ${window}`;
  return "holding steady";
}

function MovementBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="lb-move is-new" title="New to this board" aria-label="New to this board"><Sparkles size={11} /><span>New</span></span>;
  }
  if (delta > 0) {
    return <span className="lb-move is-up" title={`Up ${delta} place${delta === 1 ? "" : "s"}`} aria-label={`Up ${delta} place${delta === 1 ? "" : "s"}`}><ChevronUp size={12} /><span>{delta}</span></span>;
  }
  if (delta < 0) {
    const places = Math.abs(delta);
    return <span className="lb-move is-down" title={`Down ${places} place${places === 1 ? "" : "s"}`} aria-label={`Down ${places} place${places === 1 ? "" : "s"}`}><ChevronDown size={12} /><span>{places}</span></span>;
  }
  return <span className="lb-move is-flat" title="No change" aria-label="No change"><Minus size={11} /><span>0</span></span>;
}

function LeaderboardSkeleton() {
  return (
    <div className="lb-page" aria-busy="true">
      <span className="sr-only" role="status">Loading leaderboard…</span>
      <div className="lb-hero lb-skeleton-hero">
        <div className="lb-skeleton-copy">
          <span className="lb-skeleton-block lb-skeleton-icon" />
          <div className="lb-skeleton-lines"><span className="lb-skeleton-block" /><span className="lb-skeleton-block is-short" /></div>
        </div>
        <span className="lb-skeleton-block lb-skeleton-countdown" />
        <div className="lb-skeleton-stats">
          {[0, 1, 2].map((item) => <span className="lb-skeleton-block" key={item} />)}
        </div>
      </div>
      <div className="lb-filters lb-skeleton-filters">
        <span className="lb-skeleton-block" /><span className="lb-skeleton-block" />
      </div>
      <div className="lb-podium lb-skeleton-podium">
        {[0, 1, 2].map((item) => <span className="lb-skeleton-block" key={item} />)}
      </div>
      <div className="lb-board lb-skeleton-board">
        {[0, 1, 2, 3, 4, 5].map((item) => <span className="lb-skeleton-block" key={item} />)}
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [range, setRange] = useState<LeaderboardRange>("weekly");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (loadedRef.current) setRefreshing(true);
    else setLoading(true);
    getLeaderboard({ scope, range })
      .then((result) => {
        if (cancelled) return;
        loadedRef.current = true;
        setData(result);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason, "Could not load the leaderboard."));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => { cancelled = true; };
  }, [scope, range, nonce]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading && !data) {
    return (
      <PageFrame eyebrow="Community" title="Leaderboard" subtitle="Learn more. Earn XP. Climb the rankings.">
        <LeaderboardSkeleton />
      </PageFrame>
    );
  }

  if (!data) {
    return (
      <PageFrame eyebrow="Community" title="Leaderboard" subtitle="Learn more. Earn XP. Climb the rankings.">
        <section className="lb-state" role="alert">
          <span className="lb-state-icon"><CircleAlert size={22} /></span>
          <strong>We couldn't load the leaderboard</strong>
          <p>{error || "The standings are unavailable right now. Please try again."}</p>
          <button className="lb-state-button" onClick={() => setNonce((value) => value + 1)}><RefreshCw size={14} />Try again</button>
        </section>
      </PageFrame>
    );
  }

  const current = data.current;
  const leaders = data.leaders;
  const scopeTitle = scope === "global" ? "Global" : data.universityName ?? "University";
  const periodLabel = RANGE_LABELS[range];
  const weeklyCountdown = countdownLabel(data.weekly.endsAt, now);
  const weeklyEnd = data.weekly.endsAt ? formatDate(data.weekly.endsAt) : "soon";
  const levelProgress = current ? current.totalXp % 200 : 0;
  const nextXp = current?.xpToNext;
  const podium = [
    { place: 2, entry: leaders[1] },
    { place: 1, entry: leaders[0] },
    { place: 3, entry: leaders[2] },
  ];
  const showCurrentDock = current && (current.rank === null || current.rank > leaders.length);
  const hasUniversity = Boolean(data.universityName);

  const rankValue = current?.rank ? `#${current.rank}` : "—";
  const rankNote = current?.rank ? `of ${data.totalParticipants.toLocaleString()} learners` : "Not ranked yet";
  const nextValue = nextXp ? `${nextXp.toLocaleString()} XP` : current?.rank === 1 ? "Top spot" : "—";
  const nextNote = current?.rank === 1 ? "You lead this board" : current?.nextRank ? `to pass #${current.nextRank}` : "Earn XP to rank";
  const motivation = current?.rank
    ? current.rank === 1
      ? "You lead this board — keep earning to stay ahead."
      : nextXp != null && nextXp <= 100
        ? `Just ${nextXp.toLocaleString()} XP from #${current.nextRank} — one more session could close the gap.`
        : `${(nextXp ?? 0).toLocaleString()} XP between you and #${current.nextRank}. Keep stacking XP.`
    : "Earn XP to enter the standings.";

  return (
    <PageFrame eyebrow="Community" title="Leaderboard" subtitle="Learn more. Earn XP. Climb the rankings.">
      <div className={`lb-page ${refreshing ? "is-refreshing" : ""}`}>
        <section className="lb-hero" aria-label="Competition summary">
          <div className="lb-hero-main">
            <span className="lb-hero-icon">{scope === "university" ? <GraduationCap size={22} /> : <Trophy size={22} />}</span>
            <div className="lb-hero-copy">
              <p className="lb-eyebrow">{scope === "university" ? "Campus league" : "Global league"}</p>
              <h2>{periodLabel} standings</h2>
              <p>{periodDates(data)} · {data.totalParticipants.toLocaleString()} learners</p>
            </div>
          </div>

          <div className="lb-countdown" aria-label={`Weekly competition ends in ${weeklyCountdown}`}>
            <span className="lb-countdown-icon"><Timer size={18} /></span>
            <div>
              <small>Weekly competition</small>
              <strong>{weeklyCountdown}</strong>
              <span>Resets {weeklyEnd}</span>
            </div>
            <span className="lb-countdown-xp">{current ? `${current.xp.toLocaleString()} XP` : "—"}<small>{range === "weekly" ? "this week" : range === "monthly" ? "this month" : "all time"}</small></span>
          </div>

          <div className="lb-stat-grid">
            <div className="lb-stat">
              <span>Total XP</span>
              <strong>{current ? current.totalXp.toLocaleString() : "—"}</strong>
              <small>Level {current?.level ?? 1}</small>
            </div>
            <div className="lb-stat is-highlight">
              <span>Your rank</span>
              <strong>{rankValue}</strong>
              <small title={current?.movement ? movementCopy(current.movement, range) : undefined}>
                {rankNote}{current?.movement ? ` · ${current.movement > 0 ? "↑" : "↓"}${Math.abs(current.movement)}` : ""}
              </small>
            </div>
            <div className="lb-stat">
              <span>To next rank</span>
              <strong>{nextValue}</strong>
              <small>{nextNote}</small>
            </div>
          </div>

          <div className="lb-level-line">
            <span className="lb-level-badge"><Award size={13} />Level {current?.level ?? 1}</span>
            <div className="lb-level-track" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={200} aria-valuenow={levelProgress}>
              <span style={{ width: `${Math.min(100, (levelProgress / 200) * 100)}%` }} />
            </div>
            <small>{levelProgress} / 200 XP to Level {(current?.level ?? 1) + 1}</small>
          </div>

          <p className="lb-hero-message"><Sparkles size={12} /><span>{motivation}</span></p>
        </section>

        <section className="lb-filters" aria-label="Leaderboard filters">
          <div className="lb-filter-group" role="group" aria-label="Leaderboard scope">
            <span className="lb-filter-label">Scope</span>
            <div className="lb-segmented">
              <button className={scope === "global" ? "is-active" : ""} aria-pressed={scope === "global"} onClick={() => setScope("global")}><Globe2 size={14} />Global</button>
              <button
                className={scope === "university" ? "is-active" : ""}
                aria-pressed={scope === "university"}
                disabled={!hasUniversity}
                title={hasUniversity ? `Rank within ${data.universityName}` : "Add your university on your profile to join your campus board"}
                onClick={() => setScope("university")}
              ><GraduationCap size={14} />University</button>
            </div>
          </div>
          <div className="lb-filter-group" role="group" aria-label="Leaderboard time range">
            <span className="lb-filter-label">Time range</span>
            <div className="lb-segmented">
              {(["weekly", "monthly", "all-time"] as LeaderboardRange[]).map((option) => (
                <button key={option} className={range === option ? "is-active" : ""} aria-pressed={range === option} onClick={() => setRange(option)}>
                  {option === "all-time" ? <Trophy size={14} /> : <CalendarDays size={14} />}{RANGE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
          {refreshing && <span className="lb-refreshing" role="status"><Loader2 size={13} className="animate-spin" />Updating</span>}
        </section>

        {error && (
          <div className="lb-notice" role="status">
            <CircleAlert size={15} />
            <span>{error}</span>
            <button onClick={() => setNonce((value) => value + 1)}><RefreshCw size={13} />Retry</button>
          </div>
        )}

        {leaders.length === 0 ? (
          <section className="lb-state">
            <span className="lb-state-icon">{scope === "university" && !hasUniversity ? <GraduationCap size={22} /> : <Users size={22} />}</span>
            <strong>{scope === "university" && !hasUniversity ? "Your campus board is waiting" : "No ranked learners yet"}</strong>
            <p>
              {scope === "university" && !hasUniversity
                ? "Add your university on your profile, then come back to see how you compare with coursemates."
                : range === "all-time"
                  ? "The board will fill up as learners start earning XP."
                  : `No one has earned XP ${range === "weekly" ? "this week" : "this month"} yet. Be the first to set the pace.`}
            </p>
            <button className="lb-state-button" onClick={() => go(scope === "university" && !hasUniversity ? "profile" : "rewards")}>
              {scope === "university" && !hasUniversity ? <><GraduationCap size={14} />Add school details</> : <><Sparkles size={14} />Earn XP</>}
              <ArrowRight size={14} />
            </button>
          </section>
        ) : (
          <>
            {showCurrentDock && current && (
              <section className="lb-you-card" aria-label="Your leaderboard position">
                <span className="lb-you-rank">{current.rank ? `#${current.rank}` : "—"}</span>
                <div className="lb-you-copy">
                  <p className="lb-eyebrow">Your position</p>
                  <strong title={movementCopy(current.movement, range)}>
                    <span>{current.rank ? `You are #${current.rank}` : "You are not ranked yet"}</span>
                    {current.rank ? <MovementBadge delta={current.movement} /> : null}
                  </strong>
                  <span>{current.rank ? `${current.xp.toLocaleString()} XP on this board · ${current.totalXp.toLocaleString()} XP all time` : `Earn XP ${range === "weekly" ? "this week" : range === "monthly" ? "this month" : "to join the board"} to appear here.`}</span>
                  <span className="lb-you-note">
                    {current.rank === 1
                      ? "You lead this board — keep earning to defend it."
                      : nextXp
                        ? `You're ${nextXp.toLocaleString()} XP from #${current.nextRank} — keep earning to close the gap.`
                        : "Every sign-in and mission moves you closer to the board."}
                  </span>
                </div>
                <div className="lb-you-next">
                  {current.rank === 1 ? <><strong>Top spot</strong><span>You lead the board</span></> : nextXp ? <><strong>{nextXp.toLocaleString()} XP</strong><span>to pass #{current.nextRank}</span></> : <><strong>—</strong><span>Waiting for your first XP</span></>}
                </div>
                <button className="lb-you-cta" onClick={() => go("rewards")}>Earn XP <ArrowRight size={14} /></button>
              </section>
            )}

            <section className={`lb-podium count-${Math.min(leaders.length, 3)}`} aria-label="Top three learners">
              {podium.map(({ place, entry }) => entry ? (
                <article
                  className={`lb-podium-card place-${place} ${entry.id === current?.id ? "is-you" : ""}`}
                  key={entry.id}
                  style={{ animationDelay: `${place === 1 ? 0 : place === 2 ? 90 : 160}ms` }}
                >
                  <span className="lb-podium-medal">{place === 1 ? <Crown size={18} /> : <Medal size={17} />}</span>
                  <span className="lb-podium-avatar" aria-hidden="true">{monogram(entry.name)}</span>
                  <span className="lb-podium-place">{place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}</span>
                  <strong title={entry.name}>{entry.name}</strong>
                  <small title={schoolOf(entry)}>{schoolOf(entry)}</small>
                  <span className="lb-podium-xp">{entry.xp.toLocaleString()} <small>XP</small></span>
                  <span className="lb-podium-level">Level {entry.level}</span>
                </article>
              ) : null)}
            </section>

            <section className={`lb-board ${refreshing ? "is-updating" : ""}`} aria-label={`${scopeTitle} ${periodLabel} ranking`} aria-busy={refreshing}>
              <header className="lb-board-head">
                <div>
                  <p className="lb-eyebrow">Standings</p>
                  <h2>{scopeTitle} · {periodLabel}</h2>
                  <p>{RANGE_NOTES[range]}</p>
                </div>
                <span className="lb-board-count"><Users size={13} />{data.totalParticipants.toLocaleString()} learners</span>
              </header>

              <div className="lb-row lb-row-head" aria-hidden="true">
                <span>Rank</span><span /><span>Learner</span><span>Move</span><span>XP</span>
              </div>

              <ol className="lb-rows">
                {leaders.map((entry) => {
                  const isTop = entry.rank <= 3;
                  const isYou = entry.id === current?.id;
                  return (
                    <li className={`lb-row ${isTop ? `is-top place-${entry.rank}` : ""} ${isYou ? "is-you" : ""}`} key={entry.id}>
                      <span className="lb-rank" aria-label={`Rank ${entry.rank}`}>{isTop ? <Medal size={14} aria-hidden="true" /> : entry.rank}</span>
                      <span className="lb-avatar" aria-hidden="true">{monogram(entry.name)}</span>
                      <div className="lb-person">
                        <strong title={entry.name}><span>{entry.name}</span>{isYou && <span className="lb-you-chip">You</span>}</strong>
                        <small title={schoolOf(entry)}>{schoolOf(entry)}</small>
                      </div>
                      <MovementBadge delta={entry.movement} />
                      <span className="lb-xp">{entry.xp.toLocaleString()}<small>XP</small></span>
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}
      </div>
    </PageFrame>
  );
}
