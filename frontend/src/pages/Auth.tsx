import { useState } from "react";
import { ArrowRight, Check, LockKeyhole, Mail } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import authStudyImage from "../assets/brand2.png";
import { go } from "../components/Layout";
import { errorMessage, login, signup, type AuthProfile } from "../lib/api";

/* Community snapshot for the signup panel — same card language as the admin
   directory rows (monogram avatar, name, meta, stat chip). Sample profiles;
   swap for a real members feed when the backend exposes a public endpoint. */
export function AuthPage({ mode, onAuthenticated, notice = "" }: { mode: "login" | "signup"; onAuthenticated?: (profile: AuthProfile) => void; notice?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  /* Layout tokens used more than once inside this component.
     `rounded-half` (50%) would be used instead of `rounded-full` on non-square
     boxes — Tailwind's `rounded-full` resolves to calc(infinity * 1px), which
     draws an ellipse where the original CSS drew a circle. */
  const fieldBox = "auth-field min-h-46 flex items-center gap-9 px-13 border border-line rounded-10 bg-surface focus-within:border-outline focus-within:shadow-focus";
  const label = "grid gap-7 text-muted text-11 font-bold";
  /* Replaces `.auth-input input`. `font-normal` is load-bearing: the original
     `font: 13px Inter` shorthand reset font-weight to normal, which utility
     classes do not do implicitly (the weight would otherwise be inherited). */
  const fieldInput = "w-full border-0 outline-0 text-ink font-inter font-normal text-13";
  const primaryCta = "auth-submit primary-button inline-flex min-h-46 max-w-full items-center justify-center gap-8 whitespace-normal rounded-10 bg-brand px-16 text-12 font-bold leading-[1.25] text-white shadow-card transition-[transform,background,box-shadow] duration-200 hover:-translate-y-1 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 w-full";

  return (
    <main className="auth-page max-w-none min-h-screen grid grid-cols-2 max-1020:grid-cols-1 bg-surface">
      <section className="auth-form-panel grid place-items-center p-[clamp(24px,5vw,72px)] max-1020:py-28 max-1020:px-22">
        <div className="auth-form-content">
          <div className="auth-brand-row">
            <div className="auth-mobile-brand"><BrandLogo className="h-32" /></div>
            <button className="auth-back-link" onClick={() => go("home")}>Back to home</button>
          </div>
          <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">
            {isSignup ? "Create your workspace" : "Welcome back"}
          </p>
          {notice && (
            <p className="mb-18 flex items-start gap-8 rounded-10 border border-warning-surface bg-warning-surface px-12 py-10 text-11 leading-145 text-warning" role="status">
              {notice}
            </p>
          )}
          <h2 className="mb-10 text-[31px] leading-[1.1]">
            {isSignup
              ? "Make space for better study."
              : "Welcome back, learner."}
          </h2>
          <p className="mb-28 text-muted text-13 leading-155">
            {isSignup
              ? "One account for your notes, PDFs, and every course library."
              : "Sign in to continue to your study desk."}
          </p>
          {submitted ? (
            <div className="grid gap-10 p-22 border border-success-border rounded-13 text-success-text bg-success-surface text-12">
              <Check size={20} />
              <strong>
                {isSignup ? "Your workspace is ready." : "You are signed in."}
              </strong>
              <span className="text-success-alt leading-150">
                Taking you to your study desk…
              </span>
              <button
                className={`${primaryCta} mt-8`}
                onClick={() => go("dashboard")}
              >
                Go to study desk <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form
              className="grid gap-17"
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
                <div className={fieldBox}>
                  <Mail size={16} className="text-slate-icon" />
                  <input
                    className={fieldInput}
                    name="email"
                    type="email"
                    required
                    placeholder="you@university.edu"
                  />
                </div>
              </label>
              {isSignup && (
                <label className={label}>
                  Full name
                  <div className={fieldBox}>
                    <input
                      className={fieldInput}
                      name="displayName"
                      required
                      placeholder="Your name"
                    />
                  </div>
                </label>
              )}
              <label className={label}>
                Password
                <div className={fieldBox}>
                  <LockKeyhole size={16} className="text-slate-icon" />
                  <input
                    className={fieldInput}
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                </div>
              </label>
              {!isSignup && (
                <div className="-mt-5 flex justify-end">
                  <button type="button" className="text-11 font-semibold text-brand hover:underline" onClick={() => go("forgot")}>
                    Forgot password?
                  </button>
                </div>
              )}
              {isSignup && (
                <label className={label}>
                  Confirm password
                  <div className={fieldBox}>
                    <LockKeyhole size={16} className="text-slate-icon" />
                    <input
                      className={fieldInput}
                      name="confirmPassword"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                    />
                  </div>
                </label>
              )}
              {isSignup && (
                <label className="flex items-start gap-8 text-muted text-11 font-normal leading-140">
                  <input className="mt-2 accent-brand" type="checkbox" required />{" "}
                  <span>
                    I agree to keep shared course material respectful and
                    academic.
                  </span>
                </label>
              )}
              <button className={primaryCta} type="submit">
                {loading ? "Working..." : isSignup ? "Create account" : "Sign in"}{" "}
                <ArrowRight size={16} />
              </button>
              {error && <p className="m-0 text-danger text-11 leading-145" role="alert">{error}</p>}
            </form>
          )}
          <p className="mt-27 text-muted text-11 text-center">
            {isSignup ? "Already have an account?" : "New to RecappEdu?"}{" "}
            <button className="text-brand font-bold" onClick={() => go(isSignup ? "login" : "signup")}>
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
      <aside className="auth-visual-panel relative flex min-h-screen flex-col justify-between overflow-hidden p-[clamp(28px,5vw,72px)] max-1020:min-h-0 max-1020:gap-42 max-1020:p-26" style={{ backgroundImage: `linear-gradient(180deg, rgba(23,16,37,.12) 0%, rgba(23,16,37,.12) 35%, rgba(23,16,37,.86) 100%), linear-gradient(135deg, rgba(79,45,119,.18), rgba(32,24,50,.22)), url(${authStudyImage})` }}>
        <button className="wordmark flex items-center gap-10 self-start font-grotesk text-18 font-bold" onClick={() => go("home")}>
          <BrandLogo />
        </button>
        <div className="auth-visual-copy relative z-1 max-w-520">
          <p className="mb-14 flex items-center gap-8 text-10 font-bold uppercase tracking-[.16em]">{isSignup ? "Your study space, ready when you are" : "Welcome back to your study space"}</p>
          <h1 className="mb-18 font-grotesk text-[clamp(34px,4.6vw,58px)] font-semibold leading-[1.02] tracking-[-.055em]">Make every study session count.</h1>
          <p className="max-w-430 text-14 leading-160">Bring your course materials together, then turn them into a clear plan for what to learn next.</p>
        </div>
        <div className="auth-visual-showcase relative z-1 ml-auto w-full max-w-460">
          <div className="auth-quote-card">
            <span className="auth-quote-mark">“</span>
            <p>Bring your notes. Leave with a clearer next step.</p>
            <div className="auth-quote-rule"><span /><span /><span /></div>
            <small>YOUR STUDY SPACE, READY WHEN YOU ARE</small>
          </div>
          <div className="auth-feature-float"><span><Check size={14} /></span><strong>Made for focused learning</strong><small>Flashcards · Quizzes · Course notes</small></div>
        </div>
        <p className="auth-visual-footer relative z-1 m-0 text-10">A calmer way to turn study material into progress.</p>
      </aside>
    </main>
  );
}
