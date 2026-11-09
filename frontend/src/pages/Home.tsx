import { ArrowRight, BookOpen, Brain, Check, Clock3, FileQuestion, Files, Sparkles, Upload, Zap, CircleCheck, Layers3 } from "lucide-react";
import { BrandCarousel } from "../components/BrandCarousel";
import { go } from "../components/Layout";
import recappLogo from "../assets/recapp-logo.png";
import { useEffect, useState } from "react";
import { getProPricing } from "../lib/api";

const HEADLINE_WORDS = ["more manageable", "less overwhelming", "within reach"];

export function Home() {
  const [pricing, setPricing] = useState<{ available: boolean; amountNaira: number | null; durationDays: number } | null>(null);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  useEffect(() => { getProPricing().then(setPricing).catch(() => setPricing(null)); }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setHeadlineIndex((current) => (current + 1) % HEADLINE_WORDS.length), 2600);
    return () => window.clearInterval(timer);
  }, []);
  const proCta = () => go("signup");
  const price = pricing?.amountNaira == null ? null : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(pricing.amountNaira);

  return (
    <main>
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles size={15} /> A better way to prepare
          </p>
          <h1>
            Your next exam can feel <em key={headlineIndex} className="headline-rotate" aria-live="polite">{HEADLINE_WORDS[headlineIndex]}<span aria-hidden="true">*</span></em>
          </h1>
          <p className="lede">
            Turn lecture notes and past papers into focused quizzes, flashcards and clear explanations — all in one study space.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => go("learn")}>
              Build my study desk <ArrowRight size={17} />
            </button>
            <button
              className="secondary-button"
              onClick={() => go("hierarchy")}
            >
              Explore courses
            </button>
          </div>
          <div className="home-auth-links">
            <span>Already have an account?</span>
            <button onClick={() => go("login")}>Sign in</button>
            <button onClick={() => go("signup")}>Create account</button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="study-preview-head"><span className="preview-mark"><BookOpen size={16} /></span><div><b>Your study desk</b><small>One place for your next big goal</small></div><span className="preview-live"><i /> Ready</span></div>
          <div className="preview-course"><div className="preview-course-icon"><Layers3 size={19} /></div><div><small>CONTINUE LEARNING</small><strong>Foundations of Biology</strong><span>Cell structure · Topic 03</span></div><button aria-label="Continue learning" onClick={() => go("learn")}><ArrowRight size={17} /></button></div>
          <div className="preview-progress"><div><span>Topic progress</span><b>3 of 5</b></div><span className="preview-track"><i /></span></div>
          <div className="preview-practice"><div className="preview-practice-top"><span>UP NEXT</span><span className="preview-time"><Clock3 size={12} /> 10 min</span></div><strong>Cell structure &amp; function</strong><p>Quick quiz <span>·</span> 8 questions</p><button onClick={() => go("learn")}>Start a practice round <ArrowRight size={14} /></button></div>
          <div className="preview-note"><span><CircleCheck size={15} /></span> Small sessions add up. Pick up where you left off.</div>
          <div className="preview-spark"><Zap size={17} /></div>
        </div>
      </section>
      {/* Brand showcase — the course-archive / study-desk imagery, right where a
          first-time visitor decides whether the product is for them. */}
      <BrandCarousel />
      <section className="home-benefits" aria-label="Study tools">
        <div><span><Upload size={19} /></span><strong>Bring your own material</strong><p>Use your PDFs and notes to start a personal study session.</p></div>
        <div><span><Brain size={19} /></span><strong>Understand as you revise</strong><p>Get clear explanations and practice questions with AI.</p></div>
        <div><span><Clock3 size={19} /></span><strong>Make progress your way</strong><p>Practise with flashcards or take a focused quiz.</p></div>
      </section>
      <section className="path-section">
        <div className="section-heading">
          <p className="eyebrow">Two ways in</p>
          <h2>Start with what you have.</h2>
        </div>
        <div className="path-grid">
          <button onClick={() => go("learn")}>
            <span className="path-number">01</span>
            <strong>Learn with AI</strong>
            <p>
              Upload your notes and ask an AI tutor to explain concepts, answer
              questions, and help you revise.
            </p>
            <ArrowRight size={17} />
          </button>
          <button onClick={() => go("hierarchy")}>
            <span className="path-number">02</span>
            <strong>My course</strong>
            <p>
              Choose your institution, faculty, department, and course to browse
              or contribute papers.
            </p>
            <ArrowRight size={17} />
          </button>
          <button onClick={() => go("generate")}>
            <span className="path-number">03</span>
            <strong>Create a study set</strong>
            <p>
              Turn your course material into focused flashcards or a quiz you
              can practise at your own pace.
            </p>
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <section className="how-section" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A better revision loop</p>
            <h2>From paper to practice</h2>
          </div>
        </div>
        <div className="steps">
          <div>
            <span>01</span>
            <h3>Bring a paper</h3>
            <p>
              Upload your own archive privately or explore the shared
              repository.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Let AI structure it</h3>
            <p>
              Questions are extracted once, then shaped into the practice set
              you choose.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Practise with purpose</h3>
            <p>Flip through flashcards or test yourself with a timed quiz.</p>
          </div>
        </div>
      </section>
      <footer className="site-footer">
        <div className="site-footer-main">
          <div className="site-footer-brand">
            <img className="brand-logo" src={recappLogo} alt="RecappEdu" />
            <p>Study smarter, one paper at a time.</p>
          </div>
          <nav className="site-footer-links" aria-label="Footer navigation">
            <button type="button" onClick={() => go("login")}>Sign in</button>
            <button type="button" onClick={() => go("signup")}>Create account</button>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} RecappEdu. All rights reserved.</span>
          <div className="site-footer-legal">
            <button type="button" onClick={() => go("privacy")}>Privacy policy</button>
            <button type="button" onClick={() => go("terms")}>Terms of use</button>
          </div>
        </div>
      </footer>
      <section className="pricing-section" id="pricing">
        <div className="section-heading"><p className="eyebrow">Simple plans</p><h2>Start free. Go further with Pro.</h2><p>Choose what fits your study routine. Your plan is always clear before checkout.</p></div>
        <div className="pricing-grid">
          <article className="pricing-card"><p className="pricing-kicker">For getting started</p><h3>Free</h3><p className="pricing-price">₦0 <span>forever</span></p><p className="pricing-summary">Build your study routine at no cost.</p><ul><li><Check size={16} /> Explore your course repository</li><li><Check size={16} /> Learn with AI and your materials</li><li><Check size={16} /> Daily quiz generations</li><li><Check size={16} /> Save and review your practice</li></ul><button className="secondary-button" onClick={() => go("signup")}>Create free account <ArrowRight size={15} /></button></article>
          <article className="pricing-card pricing-card-pro"><span className="pricing-badge">More practice</span><p className="pricing-kicker">For exam season</p><h3>Pro</h3><p className="pricing-price">{price ?? "90 days"} <span>{price ? `for ${pricing?.durationDays ?? 90} days` : "of unlimited practice"}</span></p><p className="pricing-summary">Keep practising without the daily quiz limit.</p><ul><li><Check size={16} /> Everything in Free</li><li><Check size={16} /> Unlimited quiz generations</li><li><Check size={16} /> One simple, fixed term</li><li><Check size={16} /> No recurring subscription</li></ul><button className="primary-button" disabled={pricing?.available === false} onClick={proCta}>{pricing?.available === false ? "Pro is unavailable right now" : "Get started with Pro"} {pricing?.available !== false && <ArrowRight size={15} />}</button><small>{price ? "Price shown in Nigerian naira. Sign in to continue to checkout." : "Sign in to see current price and checkout availability."}</small></article>
        </div>
      </section>
      <section className="home-final-cta"><div><p className="eyebrow">Your next study session starts here</p><h2>Make every paper count.</h2><p>Create your free account and build a revision routine that works for you.</p></div><button className="primary-button" onClick={() => go("signup")}>Create your free account <ArrowRight size={16} /></button></section>
    </main>
  );
}
