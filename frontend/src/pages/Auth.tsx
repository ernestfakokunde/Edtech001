import { useState } from "react";
import { ArrowRight, Check, LockKeyhole, Mail, Quote, UserRound } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { go } from "../components/Layout";
import { errorMessage, login, signup, type AuthProfile } from "../lib/api";
import storyImage from "../assets/brand2.png";

const STORY = {
  eyebrow: "Welcome back to your study space",
  eyebrowSignup: "Your study space starts here",
  title: "Make every study session count.",
  copy: "Bring your course materials together, then turn them into a clear plan for what to learn next.",
  quote: "Bring your notes. Leave with a clearer next step.",
  quoteLabel: "Your study space, ready when you are",
  footnote: "A calmer way to turn study material into progress.",
  chipTitle: "Made for focused learning",
  chipCopy: "Flashcards · Quizzes · Course notes",
};

/** Full-height photographic panel shown beside the form on desktop. */
function StoryPanel({ isSignup }: { isSignup: boolean }) {
  return (
    <aside className="relative hidden overflow-hidden min-[1020px]:block" aria-hidden="true">
      <img src={storyImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,8,26,.66)_0%,rgba(13,8,26,.26)_38%,rgba(8,5,16,.82)_100%)]" />
      <div className="relative flex h-full flex-col justify-between p-[clamp(34px,4.4vw,64px)] text-white">
        <div className="mt-[13%] max-w-[500px]">
          <p className="mb-14 text-[10px] font-bold uppercase tracking-[.18em] text-white/65">
            {isSignup ? STORY.eyebrowSignup : STORY.eyebrow}
          </p>
          <h2 className="m-0 text-[clamp(34px,3.5vw,54px)] font-bold leading-[1.06] tracking-[-.035em] text-white">
            {STORY.title}
          </h2>
          <p className="mt-16 max-w-[430px] text-[13px] leading-[1.7] text-white/70">{STORY.copy}</p>
        </div>

        <div>
          <div className="relative ml-auto w-[min(100%,470px)] rounded-14 border border-white/15 bg-[#120d20]/55 p-22 shadow-[0_18px_50px_rgba(0,0,0,.35)] backdrop-blur-md">
            <Quote size={22} className="absolute right-18 top-16 text-white/25" />
            <p className="m-0 max-w-[340px] text-[18px] font-semibold leading-[1.35] text-white">{STORY.quote}</p>
            <div className="mt-18 flex gap-6">
              <span className="h-2 w-14 rounded-full bg-white/35" />
              <span className="h-2 w-14 rounded-full bg-white/35" />
              <span className="h-2 w-14 rounded-full bg-white/35" />
            </div>
            <p className="mt-12 text-[9px] font-bold uppercase tracking-[.16em] text-white/55">{STORY.quoteLabel}</p>
          </div>

          <div className="relative -mt-5 mr-10 ml-auto flex w-fit max-w-full items-center gap-10 rounded-10 border border-line bg-surface px-12 py-9 shadow-card">
            <span className="grid size-24 shrink-0 place-items-center rounded-half bg-brand text-[var(--theme-on-brand)]">
              <Check size={13} />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-11 font-semibold text-ink">{STORY.chipTitle}</strong>
              <small className="block truncate text-[9px] text-muted">{STORY.chipCopy}</small>
            </span>
          </div>

          <p className="mt-22 text-[10px] text-white/55">{STORY.footnote}</p>
        </div>
      </div>
    </aside>
  );
}

/** Short photographic banner above the form on phones and tablets. */
function StoryBanner({ isSignup }: { isSignup: boolean }) {
  return (
    <div className="relative h-[188px] overflow-hidden min-[1020px]:hidden" aria-hidden="true">
      <img src={storyImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,8,26,.5)_0%,rgba(13,8,26,.32)_45%,rgba(8,5,16,.88)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-20">
        <p className="mb-7 text-[9px] font-bold uppercase tracking-[.18em] text-white/60">
          {isSignup ? STORY.eyebrowSignup : STORY.eyebrow}
        </p>
        <p className="m-0 max-w-[300px] text-[23px] font-bold leading-[1.12] tracking-[-.03em] text-white">{STORY.title}</p>
      </div>
    </div>
  );
}

export function AuthPage({ mode, onAuthenticated, notice = "" }: { mode: "login" | "signup"; onAuthenticated?: (profile: AuthProfile) => void; notice?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  /* Underlined fields keep the form quiet, matching the editorial split
     layout: no boxes, just a label, the value, and a focus line. */
  const fieldBox = "flex min-h-44 items-center gap-9 border-b border-line transition-colors focus-within:border-brand";
  const label = "grid gap-2 text-muted text-11 font-semibold";
  const fieldInput = "w-full min-w-0 border-0 bg-transparent py-10 font-inter text-13 font-normal text-ink outline-0 placeholder:text-slate-icon";
  const primaryCta = "btn btn-primary btn-block min-h-46 rounded-9 text-13";

  return (
    <main className="min-h-screen bg-surface">
      <StoryBanner isSignup={isSignup} />
      <div className="grid min-[1020px]:min-h-screen min-[1020px]:grid-cols-2">
        <section className="flex flex-col bg-surface px-[clamp(20px,5vw,72px)] py-24 max-1020:pt-22 min-[1020px]:justify-center min-[1020px]:py-44">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-38 flex items-center justify-between gap-14">
              <button className="wordmark flex items-center" onClick={() => go("home")} aria-label="RecappEdu home">
                <BrandLogo className="h-32" />
              </button>
              <button className="inline-flex min-h-24 items-center text-11 font-semibold text-muted transition-colors hover:text-brand" onClick={() => go("home")}>
                Back to home
              </button>
            </div>

            <p className="eyebrow mb-15 text-10 font-bold uppercase tracking-[.13em] text-brand">
              {isSignup ? "Create your workspace" : "Welcome back"}
            </p>
            {notice && (
              <p className="mb-18 flex items-start gap-8 rounded-10 border border-warning-surface bg-warning-surface px-12 py-10 text-11 leading-145 text-warning" role="status">
                {notice}
              </p>
            )}
            <h1 className="m-0 text-[clamp(28px,3vw,40px)] leading-[1.08] font-bold tracking-[-.035em] text-ink">
              {isSignup ? "Create your study space." : "Welcome back, learner."}
            </h1>
            <p className="mb-28 mt-12 text-13 leading-155 text-muted">
              {isSignup
                ? "One account for your notes, PDFs, and every course library."
                : "Sign in to continue to your study desk."}
            </p>

            {submitted ? (
              <div className="grid gap-10 rounded-13 border border-success-border bg-success-surface p-22 text-12 text-success-text">
                <Check size={20} />
                <strong>{isSignup ? "Your workspace is ready." : "You are signed in."}</strong>
                <span className="leading-150 text-success-alt">Taking you to your study desk…</span>
                <button className={`${primaryCta} mt-8`} onClick={() => go("dashboard")}>
                  Go to study desk <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <form
                className="grid gap-21"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError("");
                  const form = new FormData(event.currentTarget);
                  const password = String(form.get("password"));
                  const confirmPassword = String(form.get("confirmPassword"));
                  if (isSignup && password !== confirmPassword) {
                    setError("Passwords do not match.");
                    return;
                  }
                  setLoading(true);
                  try {
                    /* The auth response already carries the full profile, so the app
                       can move on immediately instead of calling /api/auth/me again
                       (which used to be a second round trip before the dashboard). */
                    const result = await (isSignup
                      ? signup({
                          email: String(form.get("email")),
                        password,
                          displayName: String(form.get("displayName")),
                        })
                      : login({
                          email: String(form.get("email")),
                        password,
                        }));
                    setSubmitted(true);
                    onAuthenticated?.(result.profile);
                    go(isSignup ? "onboarding" : "dashboard");
                  } catch (requestError) {
                    setError(errorMessage(requestError, "We could not sign you in. Please try again."));
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <label className={label}>
                  Email address
                  <span className={fieldBox}>
                    <Mail size={15} className="shrink-0 text-slate-icon" />
                    <input
                      className={fieldInput}
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@university.edu"
                    />
                  </span>
                </label>
                {isSignup && (
                  <label className={label}>
                    Full name
                    <span className={fieldBox}>
                      <UserRound size={15} className="shrink-0 text-slate-icon" />
                      <input
                        className={fieldInput}
                        name="displayName"
                        autoComplete="name"
                        required
                        placeholder="Your name"
                      />
                    </span>
                  </label>
                )}
                <label className={label}>
                  Password
                  <span className={fieldBox}>
                    <LockKeyhole size={15} className="shrink-0 text-slate-icon" />
                    <input
                      className={fieldInput}
                      name="password"
                      type="password"
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                    />
                  </span>
                </label>
                {!isSignup && (
                  <div className="-mt-6 flex justify-end">
                    <button type="button" className="-mx-5 -my-4 px-5 py-4 text-11 font-semibold text-brand hover:underline" onClick={() => go("forgot")}>
                      Forgot password?
                    </button>
                  </div>
                )}
                {isSignup && (
                  <label className={label}>
                    Confirm password
                    <span className={fieldBox}>
                      <LockKeyhole size={15} className="shrink-0 text-slate-icon" />
                      <input
                        className={fieldInput}
                        name="confirmPassword"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Re-enter your password"
                      />
                    </span>
                  </label>
                )}
                {isSignup && (
                  <label className="flex items-start gap-8 text-11 font-normal leading-140 text-muted">
                    <input className="mt-1 size-16 shrink-0 accent-brand" type="checkbox" required />{" "}
                    <span>I agree to keep shared course material respectful and academic.</span>
                  </label>
                )}
                <button className={`${primaryCta} mt-2`} type="submit">
                  {loading ? "Working..." : isSignup ? "Create account" : "Sign in"} <ArrowRight size={16} />
                </button>
                {error && <p className="m-0 text-11 leading-145 text-danger" role="alert">{error}</p>}
              </form>
            )}

            <p className="mt-27 text-center text-11 text-muted">
              {isSignup ? "Already have an account?" : "New to RecappEdu?"}{" "}
              <button className="inline-flex min-h-24 items-center font-bold text-brand" onClick={() => go(isSignup ? "login" : "signup")}>
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </div>
        </section>

        <StoryPanel isSignup={isSignup} />
      </div>
    </main>
  );
}
