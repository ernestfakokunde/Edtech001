import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { go } from "../components/Layout";
import { errorMessage, requestPasswordReset, resetPassword, verifyEmailAddress } from "../lib/api";

const fieldBox = "min-h-46 flex items-center gap-9 px-13 border border-line rounded-10 bg-surface focus-within:border-outline focus-within:shadow-focus";
const fieldInput = "w-full border-0 outline-0 text-ink font-inter font-normal text-13";
const label = "grid gap-7 text-muted text-11 font-bold";
const primaryCta = "primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none w-full";
const secondaryLink = "text-11 font-semibold text-brand hover:underline";

function AccessShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-pale px-20 py-40">
      <div className="w-[min(100%,440px)]">
        <button className="wordmark mb-24 flex items-center gap-10 font-grotesk text-18 font-bold" onClick={() => go("home")} aria-label="RecappEdu home">
          <BrandLogo />
        </button>
        <div className="rounded-16 border border-line bg-white p-[clamp(24px,3.4vw,38px)] shadow-card">
          <p className="eyebrow mb-12 text-10 font-bold uppercase tracking-[.13em] text-brand">{eyebrow}</p>
          <h1 className="mb-10 text-[28px] leading-[1.15] text-ink">{title}</h1>
          <p className="mb-24 text-muted text-13 leading-155">{subtitle}</p>
          {children}
        </div>
        <p className="mt-20 text-center text-11 text-muted">
          Your study desk stays private. <button className={secondaryLink} onClick={() => go("login")}>Back to sign in</button>
        </p>
      </div>
    </main>
  );
}

function SuccessPanel({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="grid gap-10 rounded-13 border border-success-border bg-success-surface p-22 text-success-text text-12" role="status">
      <Check size={22} />
      <strong className="text-14">{title}</strong>
      <span className="leading-150 text-success-alt">{body}</span>
      {action}
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (reason) {
      setError(errorMessage(reason, "We could not send that reset link. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessShell
      eyebrow="Account recovery"
      title="Forgot your password?"
      subtitle="Enter the email on your account and we will send a one-time reset link. It expires in 30 minutes."
    >
      {sent ? (
        <SuccessPanel
          title="Check your inbox"
          body="If that email has an account, a reset link is on its way. Remember to check spam."
          action={<button className={`${primaryCta} mt-8`} onClick={() => go("login")}>Back to sign in <ArrowRight size={16} /></button>}
        />
      ) : (
        <form className="grid gap-17" onSubmit={submit}>
          <label className={label}>
            Email address
            <div className={fieldBox}>
              <Mail size={16} className="text-slate-icon" />
              <input className={fieldInput} name="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" />
            </div>
          </label>
          <button className={primaryCta} type="submit" disabled={busy || email.trim().length === 0}>
            {busy ? "Sending link…" : "Send reset link"} <ArrowRight size={16} />
          </button>
          {error && <p className="m-0 text-danger text-11 leading-145" role="alert">{error}</p>}
        </form>
      )}
    </AccessShell>
  );
}

export function ResetPasswordPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Choose a password of at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (reason) {
      setError(errorMessage(reason, "We could not update your password. Request a new link and try again."));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AccessShell eyebrow="Account recovery" title="This link is incomplete" subtitle="Open the link from your reset email again, or request a fresh one.">
        <button className={primaryCta} onClick={() => go("forgot")}>Request a new link <ArrowRight size={16} /></button>
      </AccessShell>
    );
  }

  return (
    <AccessShell
      eyebrow="Account recovery"
      title="Choose a new password"
      subtitle="This link can be used once and expires 30 minutes after it was sent. Signing in on other devices will require the new password."
    >
      {done ? (
        <SuccessPanel
          title="Password updated"
          body="Every other session has been signed out. Use your new password to continue."
          action={<button className={`${primaryCta} mt-8`} onClick={() => go("login")}>Sign in <ArrowRight size={16} /></button>}
        />
      ) : (
        <form className="grid gap-17" onSubmit={submit}>
          <label className={label}>
            New password
            <div className={fieldBox}>
              <KeyRound size={16} className="text-slate-icon" />
              <input className={fieldInput} type="password" required minLength={8} maxLength={200} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </div>
          </label>
          <label className={label}>
            Confirm new password
            <div className={fieldBox}>
              <KeyRound size={16} className="text-slate-icon" />
              <input className={fieldInput} type="password" required minLength={8} maxLength={200} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Re-enter your password" />
            </div>
          </label>
          <button className={primaryCta} type="submit" disabled={busy || !password || !confirm}>
            {busy ? "Updating…" : "Update password"} <ArrowRight size={16} />
          </button>
          {error && <p className="m-0 text-danger text-11 leading-145" role="alert">{error}</p>}
        </form>
      )}
    </AccessShell>
  );
}

export function VerifyEmailPage({ token, onVerified }: { token: string; onVerified?: () => void }) {
  const [state, setState] = useState<"checking" | "verified" | "error">(token ? "checking" : "error");
  const [message, setMessage] = useState(token ? "" : "This verification link is incomplete. Open the link from your email again.");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmailAddress(token)
      .then(() => {
        setState("verified");
        onVerified?.();
      })
      .catch((reason: unknown) => {
        setState("error");
        setMessage(errorMessage(reason, "This verification link is invalid or has expired."));
      });
  }, [token, onVerified]);

  return (
    <AccessShell
      eyebrow="Email verification"
      title={state === "verified" ? "Email confirmed" : state === "error" ? "We could not verify that link" : "Confirming your email"}
      subtitle={state === "verified" ? "AI practice sets, uploads and your tutor are now unlocked." : state === "error" ? "Request a fresh verification email from your study desk and try again." : "This only takes a moment."}
    >
      {state === "checking" && (
        <div className="grid min-h-120 place-items-center gap-8 rounded-13 border border-dashed border-ghost-border bg-ghost-surface p-18 text-center text-12 text-muted" role="status">
          <strong className="text-14 text-ink">Checking your link…</strong>
          <span>Hold on while we confirm this address.</span>
        </div>
      )}
      {state === "verified" && (
        <SuccessPanel
          title="You are verified"
          body="Your account can now use AI practice, Learn with AI and document uploads."
          action={<button className={`${primaryCta} mt-8`} onClick={() => go("dashboard")}>Go to my study desk <ArrowRight size={16} /></button>}
        />
      )}
      {state === "error" && (
        <div className="grid gap-12">
          <div className="flex items-start gap-9 rounded-10 border border-warning-surface bg-warning-surface px-12 py-10 text-11 leading-145 text-warning" role="alert">
            <ShieldCheck size={16} className="mt-1 shrink-0" />
            <span>{message}</span>
          </div>
          <button className={primaryCta} onClick={() => go("login")}>Back to sign in <ArrowRight size={16} /></button>
        </div>
      )}
    </AccessShell>
  );
}
