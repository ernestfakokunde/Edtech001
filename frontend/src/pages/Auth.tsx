import { useState } from "react";
import { ArrowRight, Check, LayoutGrid, LockKeyhole, Mail } from "lucide-react";
import { go } from "../components/Layout";
import { login, signup } from "../lib/api";

export function AuthPage({ mode, onAuthenticated }: { mode: "login" | "signup"; onAuthenticated?: () => void }) {
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
          <span>
            <LayoutGrid size={16} />
          </span>{" "}
          RecappEdu
        </button>
        <div>
          <p className="eyebrow">A calmer way to revise</p>
          <h1 className="max-w-480 mb-20 text-[clamp(32px,4vw,48px)] leading-100">Make every paper count.</h1>
          <p className="max-w-430 text-muted text-15 leading-170">
            Keep your own PDFs private, or learn from the papers your course
            community has already shared.
          </p>
          <div className="grid gap-14 mt-34 text-brand-deep text-12 font-semibold">
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
        </div>
      </section>
      <section className="grid place-items-center p-30">
        <div className="w-[min(100%,410px)]">
          <button className="back-link mb-46" onClick={() => go("home")}>
            Back to home
          </button>
          <p className="eyebrow">
            {isSignup ? "Create your workspace" : "Welcome back"}
          </p>
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
                Take a look around and choose how you want to practise.
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
                  await (isSignup
                    ? signup({
                        email: String(form.get("email")),
                        password: String(form.get("password")),
                        displayName: String(form.get("displayName")),
                      })
                    : login({
                        email: String(form.get("email")),
                        password: String(form.get("password")),
                      }));
                      onAuthenticated?.();
                  setSubmitted(true);
                } catch (requestError) {
                  setError(requestError instanceof Error ? requestError.message : "Authentication failed.");
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
