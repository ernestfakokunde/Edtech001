import { useState } from "react";
import { ArrowRight, Check, LayoutGrid, LockKeyhole, Mail } from "lucide-react";
import { go } from "../components/Layout";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const [submitted, setSubmitted] = useState(false);
  const isSignup = mode === "signup";
  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <button className="wordmark auth-wordmark" onClick={() => go("home")}>
          <span>
            <LayoutGrid size={16} />
          </span>{" "}
          RecappEdu
        </button>
        <div>
          <p className="eyebrow">A calmer way to revise</p>
          <h1>Make every paper count.</h1>
          <p>
            Keep your own PDFs private, or learn from the papers your course
            community has already shared.
          </p>
          <div className="auth-points">
            <span>
              <Check size={15} /> AI-generated flashcards and quizzes
            </span>
            <span>
              <Check size={15} /> Your private study workspace
            </span>
            <span>
              <Check size={15} /> Course repositories that grow with you
            </span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <button className="back-link" onClick={() => go("home")}>
            Back to home
          </button>
          <p className="eyebrow">
            {isSignup ? "Create your workspace" : "Welcome back"}
          </p>
          <h2>
            {isSignup
              ? "Start practising with purpose."
              : "Pick up where you left off."}
          </h2>
          <p className="auth-subtitle">
            {isSignup
              ? "One account for your own papers and every course repository."
              : "Sign in to continue to your study desk."}
          </p>
          {submitted ? (
            <div className="auth-success">
              <Check size={20} />
              <strong>
                {isSignup ? "Your workspace is ready." : "You are signed in."}
              </strong>
              <span>
                Take a look around and choose how you want to practise.
              </span>
              <button
                className="primary-button full"
                onClick={() => go("home")}
              >
                Go to study desk <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSubmitted(true);
              }}
            >
              <label>
                Email address
                <div className="auth-input">
                  <Mail size={16} />
                  <input
                    type="email"
                    required
                    placeholder="you@university.edu"
                  />
                </div>
              </label>
              {isSignup && (
                <label>
                  Full name
                  <div className="auth-input">
                    <input required placeholder="Your name" />
                  </div>
                </label>
              )}
              <label>
                Password
                <div className="auth-input">
                  <LockKeyhole size={16} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                </div>
              </label>
              {isSignup && (
                <label className="checkbox-row">
                  <input type="checkbox" required />{" "}
                  <span>
                    I agree to keep shared course material respectful and
                    academic.
                  </span>
                </label>
              )}
              <button className="primary-button full" type="submit">
                {isSignup ? "Create account" : "Sign in"}{" "}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "New to RecappEdu?"}{" "}
            <button onClick={() => go(isSignup ? "login" : "signup")}>
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
