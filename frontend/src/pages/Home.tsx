import { ArrowRight, Brain, Sparkles } from "lucide-react";
import { go } from "../components/Layout";

export function Home() {
  return (
    <main>
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles size={15} /> Built for the way you study
          </p>
          <h1>
            Turn past papers into your <em>next advantage.</em>
          </h1>
          <p className="lede">
            Bring your own PDF for instant practice, or find your course and
            learn from a shared archive.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => go("personal")}>
              Use my own PDF <ArrowRight size={17} />
            </button>
            <button
              className="secondary-button"
              onClick={() => go("hierarchy")}
            >
              Find my course
            </button>
          </div>
          <div className="home-auth-links">
            <span>Already have an account?</span>
            <button onClick={() => go("login")}>Sign in</button>
            <button onClick={() => go("signup")}>Create account</button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-top">
            <span className="mini-label">Your study desk</span>
            <span className="status-dot">Ready to practise</span>
          </div>
          <div className="progress-ring">
            <strong>68%</strong>
            <span>exam ready</span>
          </div>
          <div className="panel-stat">
            <span>Questions answered</span>
            <strong>
              124 <small>/ 180</small>
            </strong>
          </div>
          <div className="panel-stat">
            <span>Current focus</span>
            <strong>CPT 412</strong>
          </div>
          <div className="panel-footer">
            <Brain size={17} /> <span>Your next set is waiting</span>
            <ArrowRight size={16} />
          </div>
        </div>
      </section>
      <section className="path-section">
        <div className="section-heading">
          <p className="eyebrow">Two ways in</p>
          <h2>Start with what you have.</h2>
        </div>
        <div className="path-grid">
          <button onClick={() => go("personal")}>
            <span className="path-number">01</span>
            <strong>My own PDF</strong>
            <p>
              Upload a paper privately and let AI turn it into flashcards or a
              quiz immediately.
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
    </main>
  );
}
