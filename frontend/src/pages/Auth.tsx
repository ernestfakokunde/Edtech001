import { useState } from "react";
import { ArrowRight, Check, LockKeyhole, Mail } from "lucide-react";
import recappLogo from "../assets/recapp-logo.png";
import { go } from "../components/Layout";
import { errorMessage, login, signup, type AuthProfile } from "../lib/api";

/* Community snapshot for the signup panel — same card language as the admin
   directory rows (monogram avatar, name, meta, stat chip). Sample profiles;
   swap for a real members feed when the backend exposes a public endpoint. */
const SIGNUP_STUDENTS = [
  { initials: "NA", name: "Ngozi A.", meta: "300 level · Medicine", stat: "14 papers" },
  { initials: "TO", name: "Tunde O.", meta: "Final year · Law", stat: "520 XP" },
  { initials: "AK", name: "Amara K.", meta: "200 level · Computer science", stat: "92% avg" },
];

export function AuthPage({ mode, onAuthenticated, notice = "" }: { mode: "login" | "signup"; onAuthenticated?: (profile: AuthProfile) => void; notice?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  /* Layout tokens used more than once inside this component.
     `rounded-half` (50%) would be used instead of `rounded-full` on non-square
     boxes — Tailwind's `rounded-full` resolves to calc(infinity * 1px), which
     draws an ellipse where the original CSS drew a circle. */
  const fieldBox = "min-h-46 flex items-center gap-9 px-13 border border-line rounded-10 bg-surface focus-within:border-outline focus-within:shadow-focus";
  const label = "grid gap-7 text-muted text-11 font-bold";
  /* Replaces `.auth-input input`. `font-normal` is load-bearing: the original
     `font: 13px Inter` shorthand reset font-weight to normal, which utility
     classes do not do implicitly (the weight would otherwise be inherited). */
  const fieldInput = "w-full border-0 outline-0 text-ink font-inter font-normal text-13";
  const primaryCta = "primary-button full";

  return (
    <main className="max-w-none min-h-screen grid grid-cols-2 max-1020:grid-cols-1 bg-surface">
      <section className="py-36 px-[clamp(30px,7vw,100px)] max-1020:min-h-0 max-1020:py-30 max-1020:px-26 flex flex-col justify-between bg-pale">
        <button className="wordmark self-start" onClick={() => go("home")}>
          <img className="brand-logo" src={recappLogo} alt="RecappEdu" />
        </button>
        <div>
          <p className="eyebrow">A calmer way to revise</p>
          <h1 className="max-w-480 mb-20 text-[clamp(32px,4vw,48px)] leading-100">Make every paper count.</h1>
          <p className="max-w-430 text-muted text-15 leading-170">
            Keep your own PDFs private, or learn from the papers your course
            community has already shared.
          </p>
          {/* Directory-style student card — the same card language as the admin
              student directory (monogram avatars + name lines), used here as
              social proof so the signup page feels alive, not empty. */}
          <div className="mt-32 flex max-w-430 items-center gap-13 rounded-13 border border-line bg-white p-14 shadow-card">
            <div className="flex shrink-0 -space-x-8">
              {["D", "A", "E", "F"].map((letter) => (
                <span key={letter} className="grid h-32 w-32 place-items-center rounded-half border-2 border-white bg-pale text-11 font-bold text-brand">
                  {letter}
                </span>
              ))}
            </div>
            <p className="m-0 min-w-0 text-12 leading-150 text-muted">
              <strong className="font-semibold text-ink">Students are already on board.</strong>{" "}
              Share papers, earn XP, and keep every revision in one place.
            </p>
          </div>
          <div className="grid gap-14 mt-22 text-brand-deep text-12 font-semibold">
            <span className="flex gap-8 items-center">
              <Check size={15} /> AI-generated flashcards and quizzes
            </span>
            <span className="flex gap-8 items-center">
              <Check size={15} /> Your private study workspace
            </span>
            <span className="flex gap-8 items-center">
              <Check size={15} /> Course repositories that grow with you
            </span>
          </div>
          {isSignup && (
            <div className="mt-20 grid gap-10">
              <p className="eyebrow">Students already revising here</p>
              <div className="grid gap-8">
                {SIGNUP_STUDENTS.map((student) => (
                  <div key={student.name} className="flex items-center gap-12 rounded-13 border border-line bg-surface px-14 py-11 shadow-card">
                    <span className="grid h-35 w-35 shrink-0 place-items-center rounded-half bg-pale text-12 font-bold text-brand">{student.initials}</span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-13 font-semibold text-ink">{student.name}</strong>
                      <small className="block truncate text-11 text-muted">{student.meta}</small>
                    </span>
                    <span className="shrink-0 rounded-99 bg-pale px-10 py-5 text-11 font-bold text-brand">{student.stat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      {/* The form sits in a white card on the pale canvas — same card language
          as the admin panels, so signup reads as part of the same product. */}
      <section className="grid place-items-center bg-pale p-30 max-1020:py-28 max-1020:px-26">
        <div className="w-[min(100%,450px)] rounded-16 border border-line bg-white p-[clamp(24px,3.4vw,38px)] shadow-card">
          <button className="back-link mb-30" onClick={() => go("home")}>
            Back to home
          </button>
          <p className="eyebrow">
            {isSignup ? "Create your workspace" : "Welcome back"}
          </p>
          {notice && (
            <p className="mb-18 flex items-start gap-8 rounded-10 border border-warning-surface bg-warning-surface px-12 py-10 text-11 leading-145 text-warning" role="status">
              {notice}
            </p>
          )}
          <h2 className="mb-10 text-[31px] leading-[1.1]">
            {isSignup
              ? "Start practising with purpose."
              : "Pick up where you left off."}
          </h2>
          <p className="mb-28 text-muted text-13 leading-155">
            {isSignup
              ? "One account for your own papers and every course repository."
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
                setLoading(true);
                const form = new FormData(event.currentTarget);
                try {
                  /* The auth response already carries the full profile, so the app
                     can move on immediately instead of calling /api/auth/me again
                     (which used to be a second round trip before the dashboard). */
                  const result = await (isSignup
                    ? signup({
                        email: String(form.get("email")),
                        password: String(form.get("password")),
                        displayName: String(form.get("displayName")),
                      })
                    : login({
                        email: String(form.get("email")),
                        password: String(form.get("password")),
                      }));
                  setSubmitted(true);
                  onAuthenticated?.(result.profile);
                  go("dashboard");
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
          <p className="mt-27 text-slate-icon text-11 text-center">
            {isSignup ? "Already have an account?" : "New to RecappEdu?"}{" "}
            <button className="text-brand font-bold" onClick={() => go(isSignup ? "login" : "signup")}>
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
