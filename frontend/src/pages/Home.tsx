import { ArrowRight, Brain, CircleCheck, Clock3, Sparkles, Upload, Zap, ChevronRight, Menu } from "lucide-react";
import { BrandCarousel } from "../components/BrandCarousel";
import { go } from "../components/Layout";
import { BrandLogo } from "../components/BrandLogo";
import { useState } from "react";

export function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollToPricing = () => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToFeatures = () => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="landing-page landing-refresh min-h-screen overflow-x-clip text-[#15131d]">
      <section className="landing-hero landing-scene">
        <div className="landing-browser-window">
          <div className="landing-browser-chrome" aria-hidden="true">
            <span className="landing-browser-dots"><i /><i /><i /></span>
            <span>|||</span><span>&lt;</span><span>&gt;</span><span>o</span>
            <span className="landing-browser-address"><i /> recapp-edu.pro</span>
            <span className="landing-browser-avatar">R</span><span>⋮</span>
          </div>
          <header className="landing-site-nav">
            <button className="landing-wordmark" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="RecappEdu home"><BrandLogo className="h-34" /></button>
            <nav aria-label="Landing page navigation">
              <button onClick={scrollToFeatures}>Features</button>
              <button onClick={() => go("hierarchy")}>Courses</button>
              <button onClick={scrollToPricing}>Pricing</button>
              <button onClick={scrollToFeatures}>How it works</button>
            </nav>
            <div className="landing-nav-actions"><button className="landing-contact" onClick={() => go("login")}>Sign in</button><button className="landing-download" onClick={() => go("signup")}>Get started <ArrowRight size={14} /></button></div>
            <button className="landing-mobile-menu" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? "\u00d7" : <Menu size={20} />}</button>
          </header>
          {menuOpen && <nav className="landing-mobile-nav" aria-label="Mobile navigation"><button onClick={() => { setMenuOpen(false); scrollToFeatures(); }}>Features</button><button onClick={() => { setMenuOpen(false); go("hierarchy"); }}>Courses</button><button onClick={() => { setMenuOpen(false); scrollToPricing(); }}>Pricing</button><button onClick={() => { setMenuOpen(false); go("login"); }}>Sign in</button></nav>}
          <div className="landing-browser-content">
            <div className="landing-hero-badge"><Sparkles size={13} /> Study smarter with RecappEdu <button onClick={scrollToFeatures}>See how <ArrowRight size={12} /></button></div>
            <h1>Turn your notes and past papers<br /><span>into exam-ready practice</span></h1>
            <p>Create AI flashcards, practice quizzes, and theory questions from your course material.</p>
            <div className="landing-hero-actions"><button className="landing-download" onClick={() => go("learn")}>Build my study desk <ChevronRight size={16} /></button><button className="landing-contact" onClick={() => go("hierarchy")}>Explore courses</button></div>
            <div className="landing-product-stage" aria-label="Preview of the RecappEdu study experience">
              <div className="landing-float-card landing-float-left">
                <span className="landing-card-kicker">QUICK PRACTICE</span><strong>What is the role of mitochondria?</strong>
                <div className="landing-mini-options"><i /><i /><i /><i /></div><span className="landing-card-caption"><CircleCheck size={13} /> Multiple choice quiz</span>
              </div>
              <div className="landing-float-card landing-float-right">
                <span className="landing-card-kicker">YOUR PROGRESS <ArrowRight size={13} /></span><strong>Small steps add up.</strong><span className="landing-progress-number">+21%</span><div className="landing-progress-bars"><i /><i /><i /><i /><i /><i /><i /></div><span className="landing-card-caption">This week</span>
              </div>
              <div className="landing-phone">
                <div className="landing-phone-island" />
                <div className="landing-phone-top"><span>9:41</span><span>Wi-Fi&nbsp;100%</span></div>
                <div className="landing-phone-greeting"><span className="landing-student-avatar">S</span><span><small>Welcome back,</small><strong>Your study desk</strong></span><span className="landing-xp"><Zap size={12} /> 245</span></div>
                <div className="landing-phone-month"><button>&lt;</button><strong>Keep your streak going</strong><button>&gt;</button></div>
                <div className="landing-week-days"><span>M<small>12</small></span><span>T<small>13</small></span><span>W<small>14</small></span><span className="is-today">T<small>15</small></span><span>F<small>16</small></span><span>S<small>17</small></span><span>S<small>18</small></span></div>
                <button className="landing-daily-card" onClick={() => go("generate")}><span><small>DAILY STUDY SESSION</small><strong>Cell biology basics</strong><em>5 questions &middot; 8 min</em></span><span className="landing-daily-icon"><Brain size={24} /></span><b>Continue <ArrowRight size={12} /></b></button>
                <div className="landing-phone-stats"><span>Weekly progress</span><strong>4 of 5 days</strong><i><b /></i></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <BrandCarousel />
      <section className="mx-auto grid max-w-[1170px] grid-cols-3 gap-32 border-t border-[#dbeafe] px-24 pb-70 pt-12 max-760:grid-cols-1 max-760:gap-18 max-760:px-22 max-760:pb-48" aria-label="Study tools">
        <div className="grid grid-cols-[40px_1fr] content-start gap-x-12 [&>span]:row-span-2 [&>span]:grid [&>span]:size-40 [&>span]:place-items-center [&>span]:rounded-12 [&>span]:bg-pale [&>span]:text-brand [&>strong]:self-end [&>strong]:font-grotesk [&>strong]:text-14 [&>strong]:text-ink [&>p]:mt-5 [&>p]:text-12 [&>p]:leading-155 [&>p]:text-muted"><span><Upload size={19} /></span><strong>Bring your own material</strong><p>Use your PDFs and notes to start a personal study session.</p></div>
        <div className="grid grid-cols-[40px_1fr] content-start gap-x-12 [&>span]:row-span-2 [&>span]:grid [&>span]:size-40 [&>span]:place-items-center [&>span]:rounded-12 [&>span]:bg-pale [&>span]:text-brand [&>strong]:self-end [&>strong]:font-grotesk [&>strong]:text-14 [&>strong]:text-ink [&>p]:mt-5 [&>p]:text-12 [&>p]:leading-155 [&>p]:text-muted"><span><Brain size={19} /></span><strong>Understand as you revise</strong><p>Get clear explanations and practice questions with AI.</p></div>
        <div className="grid grid-cols-[40px_1fr] content-start gap-x-12 [&>span]:row-span-2 [&>span]:grid [&>span]:size-40 [&>span]:place-items-center [&>span]:rounded-12 [&>span]:bg-pale [&>span]:text-brand [&>strong]:self-end [&>strong]:font-grotesk [&>strong]:text-14 [&>strong]:text-ink [&>p]:mt-5 [&>p]:text-12 [&>p]:leading-155 [&>p]:text-muted"><span><Clock3 size={19} /></span><strong>Make progress your way</strong><p>Practise with flashcards or take a focused quiz.</p></div>
      </section>
      <section className="mx-auto max-w-[1180px] rounded-[22px] bg-[#edf5ff] px-[clamp(24px,5vw,58px)] py-62">
        <div className="mb-34 text-center [&_h2]:mb-10 [&_h2]:font-grotesk [&_h2]:text-[clamp(30px,4vw,42px)] [&_h2]:font-bold [&_h2]:tracking-[-.055em] [&_p:last-child]:text-13 [&_p:last-child]:leading-160 [&_p:last-child]:text-muted">
          <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand mb-8 justify-center text-[#2563eb]">Two ways in</p>
          <h2 className="mb-24 text-[clamp(30px,4vw,42px)] font-grotesk font-bold tracking-[-.055em] text-ink">Start with what you have.</h2>
        </div>
        <div className="grid grid-cols-2 gap-14 max-760:grid-cols-1">
          <button className="relative grid min-h-205 content-start gap-12 rounded-16 border border-[#dbe7f8] bg-white p-24 text-left shadow-[0_10px_24px_#2563eb08] transition hover:border-[#93c5fd] hover:shadow-[0_14px_28px_#2563eb12] [&>strong]:font-grotesk [&>strong]:text-16 [&>strong]:font-bold [&>strong]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted [&>svg]:text-brand">
            <span className="text-12 font-extrabold text-[#2563eb]">01</span>
            <strong>Learn with AI</strong>
            <p>
              Upload your notes and ask an AI tutor to explain concepts, answer
              questions, and help you revise.
            </p>
            <ArrowRight size={17} />
          </button>
          <button className="relative grid min-h-205 content-start gap-12 rounded-16 border border-[#dbe7f8] bg-white p-24 text-left shadow-[0_10px_24px_#2563eb08] transition hover:border-[#93c5fd] hover:shadow-[0_14px_28px_#2563eb12] [&>strong]:font-grotesk [&>strong]:text-16 [&>strong]:font-bold [&>strong]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted [&>svg]:text-brand">
            <span className="text-12 font-extrabold text-[#2563eb]">02</span>
            <strong>My course</strong>
            <p>
              Choose your institution, faculty, department, and course to browse
              or share a PDF with your course.
            </p>
            <ArrowRight size={17} />
          </button>
          <button className="relative grid min-h-205 content-start gap-12 rounded-16 border border-[#dbe7f8] bg-white p-24 text-left shadow-[0_10px_24px_#2563eb08] transition hover:border-[#93c5fd] hover:shadow-[0_14px_28px_#2563eb12] [&>strong]:font-grotesk [&>strong]:text-16 [&>strong]:font-bold [&>strong]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted [&>svg]:text-brand">
            <span className="text-12 font-extrabold text-[#2563eb]">03</span>
            <strong>Create a study set</strong>
            <p>
              Turn your course material into focused flashcards or a quiz you
              can practise at your own pace.
            </p>
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <section className="mx-auto max-w-[1180px] border-t border-transparent px-24 py-[84px] max-680:px-20 max-680:py-44" id="how-it-works">
        <div className="mb-34 text-center [&_h2]:mb-10 [&_h2]:font-grotesk [&_h2]:text-[clamp(30px,4vw,42px)] [&_h2]:font-bold [&_h2]:tracking-[-.055em] [&_p:last-child]:text-13 [&_p:last-child]:leading-160 [&_p:last-child]:text-muted">
          <div>
            <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand mb-8 justify-center text-[#2563eb]">A better revision loop</p>
            <h2 className="mb-38 text-[clamp(30px,4vw,42px)] font-grotesk font-bold tracking-[-.055em] text-ink">From PDF to practice</h2>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-18 max-1020:grid-cols-1 max-1020:gap-22 max-760:grid-cols-1">
          <div className="grid content-start gap-10 rounded-16 border border-[#dbe7f8] bg-white p-20 [&>span]:font-grotesk [&>span]:text-14 [&>span]:font-bold [&>span]:text-brand [&>h3]:m-0 [&>h3]:font-grotesk [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted">
            <span>01</span>
            <h3 className="m-0 font-grotesk text-17 font-bold text-ink">Bring notes or a PDF</h3>
            <p>
              Upload your own archive privately or explore the shared
              repository.
            </p>
          </div>
          <div className="grid content-start gap-10 rounded-16 border border-[#dbe7f8] bg-white p-20 [&>span]:font-grotesk [&>span]:text-14 [&>span]:font-bold [&>span]:text-brand [&>h3]:m-0 [&>h3]:font-grotesk [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted">
            <span>02</span>
            <h3 className="m-0 font-grotesk text-17 font-bold text-ink">Let AI structure it</h3>
            <p>
              Questions are extracted once, then shaped into the practice set
              you choose.
            </p>
          </div>
          <div className="grid content-start gap-10 rounded-16 border border-[#dbe7f8] bg-white p-20 [&>span]:font-grotesk [&>span]:text-14 [&>span]:font-bold [&>span]:text-brand [&>h3]:m-0 [&>h3]:font-grotesk [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted">
            <span>03</span>
            <h3 className="m-0 font-grotesk text-17 font-bold text-ink">Practise with purpose</h3>
            <p>Flip through flashcards or test yourself with a timed quiz.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1180px] scroll-mt-85 border-t border-[#dbe7f8] px-28 py-[80px] max-760:px-18 max-760:py-58" id="pricing">
        <div className="mb-34 text-center"><p className="eyebrow mb-8 text-10 font-bold uppercase tracking-[.13em] text-[#2563eb]">Monthly plans</p><h2 className="pricing-headline mb-10 text-[clamp(34px,5.2vw,58px)] font-grotesk font-medium leading-[1.15] tracking-[-.055em]">Study more. <span className="pricing-highlight rounded-[10px] px-3 py-1">Spend less.</span></h2><p className="text-13 text-muted">Affordable plans for Nigerian students. No advertisements.</p><p className="mt-8 text-12 font-semibold text-[#2563eb]">First 500 students · Launch discount applies to the first month only</p></div>
        <div className="grid grid-cols-4 items-stretch gap-14 max-900:grid-cols-2 max-760:grid-cols-1">
          {[{name:"Free",regular:0,launch:0,credits:20,desc:"Build your study routine at no cost."},{name:"Basic",regular:999,launch:499,credits:100,desc:"More room to practise every day."},{name:"Student Plus",regular:1999,launch:999,credits:300,desc:"Deeper revision for serious learners."},{name:"Premium",regular:2999,launch:1499,credits:600,desc:"The complete study toolkit."}].map(plan => <article key={plan.name} className={`rounded-16 border bg-white p-20 shadow-[0_10px_28px_#1725540a] ${plan.name === "Student Plus" ? "border-[#93c5fd] ring-2 ring-[#dbeafe]" : "border-[#dbe7f8]"}`}><p className="mb-8 text-11 font-bold uppercase text-muted">{plan.name === "Free" ? "Start here" : "First month launch price"}</p><h3 className="m-0 text-[21px] font-bold text-ink">{plan.name}</h3><p className="my-10 font-grotesk text-[27px] font-bold text-ink">{String.fromCharCode(8358)}{plan.launch.toLocaleString("en-NG")}<span className="font-inter text-11 font-medium text-muted"> / first month</span></p><p className="m-0 text-12 text-muted">{plan.name === "Free" ? `${String.fromCharCode(8358)}0 always` : <>Then {String.fromCharCode(8358)}{plan.regular.toLocaleString("en-NG")} / month</>}</p><p className="mb-4 mt-12 text-12 font-semibold text-brand">{plan.credits} monthly AI credits</p><p className="mb-16 mt-4 min-h-36 text-12 text-muted">{plan.desc}</p><button className="w-full rounded-9 bg-[#2563eb] px-12 py-11 text-12 font-bold text-white hover:bg-[#1d4ed8]" onClick={() => go(plan.name === "Free" ? "signup" : "profile")}>{plan.name === "Free" ? "Create free account" : "Choose plan"}</button></article>)}
        </div>
        <div className="mt-24 overflow-x-auto rounded-16 border border-[#dbe7f8] bg-white"><table className="w-full min-w-[720px] border-collapse text-left text-12"><caption className="px-16 py-14 text-left font-grotesk text-16 font-bold text-ink">What each plan includes</caption><thead><tr className="border-y border-line text-muted">{["Feature","Free","Basic","Student Plus","Premium"].map(x=><th key={x} className="px-12 py-10">{x}</th>)}</tr></thead><tbody className="text-ink">{[["Study materials","✓","✓","✓","✓"],["Monthly AI credits","20","100","300","600"],["AI quizzes","Limited","More","More","Highest"],["AI flashcards","Limited","✓","✓","✓"],["AI explanations","Limited","✓","✓","✓"],["AI revision notes","—","—","✓","✓"],["PDF uploads","Limited","More","More","Highest"],["Learning analytics","Basic","Basic","Advanced","Advanced"],["Exam preparation","—","Basic","Advanced","Full"]].map(row=><tr key={row[0]} className="border-b border-line last:border-0">{row.map((value,i)=>i===0?<th key={i} className="px-12 py-11 text-left font-semibold">{value}</th>:<td key={i} className="px-12 py-11 text-muted">{value}</td>)}</tr>)}</tbody></table></div>
        <p className="mt-16 text-center text-11 text-muted">Launch pricing is charged for month one only. AI usage is subject to monthly plan credits.</p>
      </section>
      <section className="home-cta mx-auto mb-70 flex max-w-[1120px] items-center justify-between gap-24 rounded-18 bg-[#342252] px-38 py-34 text-white max-760:mx-18 max-760:mb-44 max-760:flex-col max-760:items-stretch max-760:px-22 max-760:py-26">
        <div>
          <p className="cta-eyebrow eyebrow mb-9 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em]">Your next study session starts here</p>
          <h2 className="mb-7 text-[27px] text-white max-760:text-[24px]">Make every PDF count.</h2>
          <p className="cta-copy m-0 text-12">Create your free account and build a revision routine that works for you.</p>
        </div>
        <button className="landing-cta-button cta-button inline-flex min-h-45 shrink-0 items-center justify-center gap-7 rounded-999 bg-white px-18 text-12 font-bold text-[#342252] shadow-none transition-colors hover:bg-[#f3efff]" onClick={() => go("signup")}>
          Create your free account <ArrowRight size={16} />
        </button>
      </section>
      <footer className="landing-footer home-footer relative mt-28 border-t border-white/10 bg-[linear-gradient(180deg,#12111b,#08090f)] px-[clamp(20px,5vw,64px)] pb-22 pt-42 text-[#f2efff]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-[1.5fr_1fr_1fr] gap-40 pb-34 max-680:grid-cols-1 max-680:gap-26">
          <div className="grid content-start justify-items-start gap-12">
            <BrandLogo className="h-32" />
            <p className="landing-footer-muted m-0 max-w-290 text-12 leading-160">A calmer way to turn your course materials into focused, useful practice.</p>
            <button className="landing-footer-action mt-3 inline-flex items-center gap-7 rounded-8 border px-12 py-8 text-11 font-semibold transition" onClick={() => go("signup")}>Build your study desk <ArrowRight size={13} /></button>
          </div>
          <nav className="grid content-start justify-items-start gap-11" aria-label="Explore RecappEdu">
            <strong className="landing-footer-heading mb-2 text-11 font-bold uppercase tracking-[.12em]">Explore</strong>
            <button className="landing-footer-link text-12 transition" onClick={() => go("learn")}>Learn with AI</button>
            <button className="landing-footer-link text-12 transition" onClick={() => go("hierarchy")}>Course repository</button>
            <button className="landing-footer-link text-12 transition" onClick={() => go("generate")}>Create a study set</button>
            <button className="landing-footer-link text-12 transition" onClick={scrollToPricing}>Plans &amp; pricing</button>
          </nav>
          <nav className="grid content-start justify-items-start gap-11" aria-label="Account and information">
            <strong className="landing-footer-heading mb-2 text-11 font-bold uppercase tracking-[.12em]">Account &amp; info</strong>
            <button className="landing-footer-link text-12 transition" onClick={() => go("login")}>Sign in</button>
            <button className="landing-footer-link text-12 transition" onClick={() => go("signup")}>Create an account</button>
            <button className="landing-footer-link text-12 transition" onClick={() => go("privacy")}>Privacy policy</button>
            <button className="landing-footer-link text-12 transition" onClick={() => go("terms")}>Terms of use</button>
          </nav>
        </div>
        <div className="landing-footer-bottom mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-12 border-t border-white/10 pt-17 text-10 max-680:flex-col max-680:items-start">
          <span>&copy; {new Date().getFullYear()} RecappEdu. All rights reserved.</span>
          <button className="landing-footer-link inline-flex items-center gap-6 transition" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top <ArrowRight size={12} className="-rotate-90" /></button>
        </div>
      </footer>
    </main>
  );
}
