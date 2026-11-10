import { ArrowRight, BookOpen, Brain, CircleCheck, Clock3, Layers3, Sparkles, Upload, Zap } from "lucide-react";
import { BrandCarousel } from "../components/BrandCarousel";
import { go } from "../components/Layout";
import { BrandLogo } from "../components/BrandLogo";
import { useEffect, useState } from "react";

const HEADLINES = [
  { lead: "Learn smarter with ", highlight: "the worldâ€™s most advanced AI." },
  { lead: "Pass your exams with ", highlight: "AI that actually understands your course." },
];

export function Home() {
  const [headlineIndex, setHeadlineIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setHeadlineIndex((current) => (current + 1) % HEADLINES.length), 4200);
    return () => window.clearInterval(timer);
  }, []);
  const scrollToPricing = () => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="dark-home min-h-screen bg-[#08090f] text-[#f2efff] [background-image:radial-gradient(ellipse_at_76%_50%,#542b7540,transparent_38%),linear-gradient(120deg,#090a11,#08090f_58%)] [background-size:auto,auto] [background-position:center,center]">
      <section className="mx-auto grid w-full max-w-[1260px] grid-cols-[1.04fr_.96fr] items-center gap-[clamp(36px,7vw,94px)] px-[clamp(26px,6vw,80px)] py-[95px] max-1020:grid-cols-1 max-1020:gap-38 max-1020:px-22 max-1020:py-60 max-1020:text-left max-680:px-19 max-680:py-47">
        <div className="max-w-[600px]">
          <p className="hero-eyebrow eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand mb-22 justify-start text-[#b4a6ff]">
            <Sparkles size={15} /> A better way to prepare
          </p>
          <h1 className="hero-headline mb-8 h-[3.35em] max-w-[660px] text-[clamp(34px,3.5vw,44px)] font-medium leading-[1.05] tracking-[-.035em] text-white max-1020:max-w-[600px] max-1020:text-[clamp(34px,4.3vw,42px)] max-680:h-[4.3em] max-680:text-[clamp(30px,7.5vw,34px)]">
            {HEADLINES[headlineIndex].lead}<em key={headlineIndex} className="hero-headline-highlight box-decoration-clone rounded-[.18em] bg-[#211d3a] px-[.12em] py-[.015em] not-italic text-[#b9a8ff]" aria-live="polite">{HEADLINES[headlineIndex].highlight}</em>
          </h1>
          <p className="hero-description m-0 max-w-[500px] text-16 leading-[1.75] text-[#aaa5b7] max-1020:text-15">
            Turn lecture notes and exam PDFs into focused quizzes, flashcards and clear explanations â€” all in one study space.
          </p>
          <div className="mt-27 flex flex-wrap justify-start gap-12 [&_.primary-button]:min-h-50 [&_.primary-button]:px-19 [&_.secondary-button]:min-h-50 [&_.secondary-button]:px-19">
            <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go("learn")}>
              Build my study desk <ArrowRight size={17} />
            </button>
            <button
              className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => go("hierarchy")}
            >
              Explore courses
            </button>
          </div>
          <div className="mt-23 flex flex-wrap items-center gap-10 text-12 text-[#64748b] [&_button]:font-semibold [&_button]:text-[#2563eb]">
            <span>Already have an account?</span>
            <button onClick={() => go("login")}>Sign in</button>
            <button onClick={() => go("signup")}>Create account</button>
          </div>
        </div>
        <div className="relative w-full max-w-[500px] justify-self-end max-1020:justify-self-center">
          <div className="absolute -inset-28 -z-10 rounded-full bg-[radial-gradient(ellipse,#863da833,transparent_68%)] blur-2xl" />
          <div className="study-preview-card relative rounded-20 border border-[#45415d] bg-[#171621] p-22 text-[#f3f0ff] shadow-[0_30px_90px_#0009,0_0_45px_#7545aa20] max-680:p-16">
            <div className="flex items-center gap-11 border-b border-white/10 pb-17">
              <span className="grid size-36 place-items-center rounded-10 bg-[#342a4c] text-[#c8afff]"><BookOpen size={17} /></span>
              <div className="grid gap-3"><strong className="text-12">Your study desk</strong><span className="text-10 text-[#aaa6bd]">A clear place to pick up where you left off</span></div>
              <span className="ml-auto inline-flex items-center gap-6 rounded-full border border-[#544773] bg-[#29233a] px-10 py-6 text-10 font-semibold text-[#d5c4ff]"><i className="size-6 rounded-full bg-[#a78bfa]" /> Ready</span>
            </div>
            <button className="mt-16 flex w-full items-center gap-12 rounded-13 border border-white/10 bg-[#201f2c] p-13 text-left transition hover:border-[#7656a8]" onClick={() => go("learn")}>
              <span className="grid size-39 shrink-0 place-items-center rounded-11 bg-[#352a4e] text-[#c5a7ff]"><Layers3 size={18} /></span>
              <span className="grid min-w-0 gap-4"><small className="text-[8px] font-bold tracking-[.1em] text-[#aaa3bd]">CONTINUE LEARNING</small><strong className="truncate text-12">Foundations of Biology</strong><span className="text-10 text-[#aaa6bd]">Cell structure Â· Topic 03</span></span>
              <span className="ml-auto grid size-30 shrink-0 place-items-center rounded-8 bg-[#38304d] text-[#d6c6ff]"><ArrowRight size={15} /></span>
            </button>
            <div className="mx-2 my-16 grid gap-8 text-10 text-[#b1adc2]"><div className="flex justify-between"><span>Topic progress</span><strong className="text-[#d2b8ff]">3 of 5</strong></div><span className="block h-5 overflow-hidden rounded-full bg-[#373348]"><i className="block h-full w-3/5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-300" /></span></div>
            <div className="rounded-13 border border-white/5 bg-[#242230] p-15">
              <div className="flex items-center justify-between text-[9px] font-semibold tracking-[.08em] text-[#aaa6bd]"><span>UP NEXT</span><span className="inline-flex items-center gap-5 font-normal tracking-normal"><Clock3 size={12} /> 10 min</span></div>
              <strong className="mt-10 block font-grotesk text-15">Cell structure &amp; function</strong>
              <p className="mb-12 mt-5 text-10 text-[#aaa6bd]">Quick quiz <span className="px-4 text-[#c7a2ff]">Â·</span> 8 questions</p>
              <button className="inline-flex items-center gap-7 text-10 font-bold text-[#c6a6ff]" onClick={() => go("generate")}>Start a practice round <ArrowRight size={13} /></button>
            </div>
            <div className="flex items-center gap-8 px-2 pt-14 text-[9px] text-[#b8b2c9]"><CircleCheck size={14} className="text-[#b391ff]" /> Small sessions add up. Pick up where you left off.</div>
            <div className="absolute -top-15 right-25 grid size-36 place-items-center rounded-12 border-4 border-[#171621] bg-gradient-to-br from-fuchsia-400 to-violet-600 text-white shadow-[0_8px_28px_#8b45d866] rotate-[7deg]"><Zap size={17} /></div>
          </div>
        </div>
      </section>
      {/* Brand showcase â€” the course-archive / study-desk imagery, right where a
          first-time visitor decides whether the product is for them. */}
      <BrandCarousel />
      <section className="mx-auto grid max-w-[1170px] grid-cols-3 gap-32 border-t border-[#dbeafe] px-24 pb-70 pt-12 max-760:grid-cols-1 max-760:gap-18 max-760:px-22 max-760:pb-48" aria-label="Study tools">
        <div className="grid grid-cols-[40px_1fr] content-start gap-x-12 [&>span]:row-span-2 [&>span]:grid [&>span]:size-40 [&>span]:place-items-center [&>span]:rounded-12 [&>span]:bg-[#eff6ff] [&>span]:text-[#2563eb] [&>strong]:self-end [&>strong]:font-grotesk [&>strong]:text-14 [&>strong]:text-ink [&>p]:mt-5 [&>p]:text-12 [&>p]:leading-155 [&>p]:text-muted"><span><Upload size={19} /></span><strong>Bring your own material</strong><p>Use your PDFs and notes to start a personal study session.</p></div>
        <div className="grid grid-cols-[40px_1fr] content-start gap-x-12 [&>span]:row-span-2 [&>span]:grid [&>span]:size-40 [&>span]:place-items-center [&>span]:rounded-12 [&>span]:bg-[#eff6ff] [&>span]:text-[#2563eb] [&>strong]:self-end [&>strong]:font-grotesk [&>strong]:text-14 [&>strong]:text-ink [&>p]:mt-5 [&>p]:text-12 [&>p]:leading-155 [&>p]:text-muted"><span><Brain size={19} /></span><strong>Understand as you revise</strong><p>Get clear explanations and practice questions with AI.</p></div>
        <div className="grid grid-cols-[40px_1fr] content-start gap-x-12 [&>span]:row-span-2 [&>span]:grid [&>span]:size-40 [&>span]:place-items-center [&>span]:rounded-12 [&>span]:bg-[#eff6ff] [&>span]:text-[#2563eb] [&>strong]:self-end [&>strong]:font-grotesk [&>strong]:text-14 [&>strong]:text-ink [&>p]:mt-5 [&>p]:text-12 [&>p]:leading-155 [&>p]:text-muted"><span><Clock3 size={19} /></span><strong>Make progress your way</strong><p>Practise with flashcards or take a focused quiz.</p></div>
      </section>
      <section className="mx-auto max-w-[1180px] rounded-[22px] bg-[#edf5ff] px-[clamp(24px,5vw,58px)] py-62">
        <div className="mb-34 text-center [&_h2]:mb-10 [&_h2]:font-grotesk [&_h2]:text-[clamp(30px,4vw,42px)] [&_h2]:font-bold [&_h2]:tracking-[-.055em] [&_p:last-child]:text-13 [&_p:last-child]:leading-160 [&_p:last-child]:text-muted">
          <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand mb-8 justify-center text-[#2563eb]">Two ways in</p>
          <h2 className="mb-24 text-[clamp(30px,4vw,42px)] font-grotesk font-bold tracking-[-.055em] text-ink">Start with what you have.</h2>
        </div>
        <div className="grid grid-cols-2 gap-14 max-760:grid-cols-1">
          <button className="relative grid min-h-205 content-start gap-12 rounded-16 border border-[#dbe7f8] bg-white p-24 text-left shadow-[0_10px_24px_#2563eb08] transition hover:border-[#93c5fd] hover:shadow-[0_14px_28px_#2563eb12] [&>strong]:font-grotesk [&>strong]:text-16 [&>strong]:font-bold [&>strong]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted [&>svg]:text-[#2563eb]">
            <span className="text-12 font-extrabold text-[#2563eb]">01</span>
            <strong>Learn with AI</strong>
            <p>
              Upload your notes and ask an AI tutor to explain concepts, answer
              questions, and help you revise.
            </p>
            <ArrowRight size={17} />
          </button>
          <button className="relative grid min-h-205 content-start gap-12 rounded-16 border border-[#dbe7f8] bg-white p-24 text-left shadow-[0_10px_24px_#2563eb08] transition hover:border-[#93c5fd] hover:shadow-[0_14px_28px_#2563eb12] [&>strong]:font-grotesk [&>strong]:text-16 [&>strong]:font-bold [&>strong]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted [&>svg]:text-[#2563eb]">
            <span className="text-12 font-extrabold text-[#2563eb]">02</span>
            <strong>My course</strong>
            <p>
              Choose your institution, faculty, department, and course to browse
              or share a PDF with your course.
            </p>
            <ArrowRight size={17} />
          </button>
          <button className="relative grid min-h-205 content-start gap-12 rounded-16 border border-[#dbe7f8] bg-white p-24 text-left shadow-[0_10px_24px_#2563eb08] transition hover:border-[#93c5fd] hover:shadow-[0_14px_28px_#2563eb12] [&>strong]:font-grotesk [&>strong]:text-16 [&>strong]:font-bold [&>strong]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted [&>svg]:text-[#2563eb]">
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
          <div className="grid content-start gap-10 rounded-16 border border-[#dbe7f8] bg-white p-20 [&>span]:font-grotesk [&>span]:text-14 [&>span]:font-bold [&>span]:text-[#2563eb] [&>h3]:m-0 [&>h3]:font-grotesk [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted">
            <span>01</span>
            <h3 className="m-0 font-grotesk text-17 font-bold text-ink">Bring notes or a PDF</h3>
            <p>
              Upload your own archive privately or explore the shared
              repository.
            </p>
          </div>
          <div className="grid content-start gap-10 rounded-16 border border-[#dbe7f8] bg-white p-20 [&>span]:font-grotesk [&>span]:text-14 [&>span]:font-bold [&>span]:text-[#2563eb] [&>h3]:m-0 [&>h3]:font-grotesk [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted">
            <span>02</span>
            <h3 className="m-0 font-grotesk text-17 font-bold text-ink">Let AI structure it</h3>
            <p>
              Questions are extracted once, then shaped into the practice set
              you choose.
            </p>
          </div>
          <div className="grid content-start gap-10 rounded-16 border border-[#dbe7f8] bg-white p-20 [&>span]:font-grotesk [&>span]:text-14 [&>span]:font-bold [&>span]:text-[#2563eb] [&>h3]:m-0 [&>h3]:font-grotesk [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:m-0 [&>p]:text-12 [&>p]:leading-160 [&>p]:text-muted">
            <span>03</span>
            <h3 className="m-0 font-grotesk text-17 font-bold text-ink">Practise with purpose</h3>
            <p>Flip through flashcards or test yourself with a timed quiz.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1180px] scroll-mt-85 border-t border-[#dbe7f8] px-28 py-[80px] max-760:px-18 max-760:py-58" id="pricing">
        <div className="mb-34 text-center"><p className="eyebrow mb-8 text-10 font-bold uppercase tracking-[.13em] text-[#2563eb]">Monthly plans</p><h2 className="pricing-headline mb-10 text-[clamp(34px,5.2vw,58px)] font-grotesk font-medium leading-[1.15] tracking-[-.055em] text-white">Study more. <span className="pricing-highlight rounded-[10px] bg-[#211d3a] px-3 py-1 text-[#b9a8ff]">Spend less.</span></h2><p className="text-13 text-muted">Affordable plans for Nigerian students. No advertisements.</p><p className="mt-8 text-12 font-semibold text-[#2563eb]">First 500 students · Launch discount applies to the first month only</p></div>
        <div className="grid grid-cols-4 items-stretch gap-14 max-900:grid-cols-2 max-520:grid-cols-1">
          {[{name:"Free",regular:0,launch:0,desc:"Build your study routine at no cost."},{name:"Basic",regular:999,launch:499,desc:"More room to practise every day."},{name:"Student Plus",regular:1999,launch:999,desc:"Deeper revision for serious learners."},{name:"Premium",regular:2999,launch:1499,desc:"The complete study toolkit."}].map(plan => <article key={plan.name} className={`rounded-16 border bg-white p-20 shadow-[0_10px_28px_#1725540a] ${plan.name === "Student Plus" ? "border-[#93c5fd] ring-2 ring-[#dbeafe]" : "border-[#dbe7f8]"}`}><p className="mb-8 text-11 font-bold uppercase text-muted">{plan.name === "Free" ? "Start here" : "First month launch price"}</p><h3 className="m-0 text-[21px] font-bold text-ink">{plan.name}</h3><p className="my-10 font-grotesk text-[27px] font-bold text-ink">{String.fromCharCode(8358)}{plan.launch.toLocaleString("en-NG")}<span className="font-inter text-11 font-medium text-muted"> / first month</span></p><p className="m-0 text-12 text-muted">{plan.name === "Free" ? `${String.fromCharCode(8358)}0 always` : <>Then {String.fromCharCode(8358)}{plan.regular.toLocaleString("en-NG")} / month</>}</p><p className="mb-16 mt-12 min-h-36 text-12 text-muted">{plan.desc}</p><button className="w-full rounded-9 bg-[#2563eb] px-12 py-11 text-12 font-bold text-white hover:bg-[#1d4ed8]" onClick={() => go(plan.name === "Free" ? "signup" : "profile")}>{plan.name === "Free" ? "Create free account" : "Choose plan"}</button></article>)}
        </div>
        <div className="mt-24 overflow-x-auto rounded-16 border border-[#dbe7f8] bg-white"><table className="w-full min-w-[720px] border-collapse text-left text-12"><caption className="px-16 py-14 text-left font-grotesk text-16 font-bold text-ink">What each plan includes</caption><thead><tr className="border-y border-line text-muted">{["Feature","Free","Basic","Student Plus","Premium"].map(x=><th key={x} className="px-12 py-10">{x}</th>)}</tr></thead><tbody className="text-ink">{[["Study materials","✓","✓","✓","✓"],["Monthly AI credits","10","50","150","300"],["AI quizzes","Limited","More","More","Highest"],["AI flashcards","Limited","✓","✓","✓"],["AI explanations","Limited","✓","✓","✓"],["AI revision notes","—","—","✓","✓"],["PDF uploads","Limited","More","More","Highest"],["Learning analytics","Basic","Basic","Advanced","Advanced"],["Exam preparation","—","Basic","Advanced","Full"]].map(row=><tr key={row[0]} className="border-b border-line last:border-0">{row.map((value,i)=>i===0?<th key={i} className="px-12 py-11 text-left font-semibold">{value}</th>:<td key={i} className="px-12 py-11 text-muted">{value}</td>)}</tr>)}</tbody></table></div>
        <p className="mt-16 text-center text-11 text-muted">Launch pricing is charged for month one only. AI usage is subject to monthly plan credits.</p>
      </section>
      <section className="home-cta mx-auto mb-70 flex max-w-[1120px] items-center justify-between gap-24 rounded-18 bg-[#1e3a8a] px-38 py-34 text-white max-760:mx-18 max-760:mb-44 max-760:flex-col max-760:items-stretch max-760:px-22 max-760:py-26 [&_.eyebrow]:mb-9 [&_.eyebrow]:text-blue-200 [&_h2]:mb-7 [&_h2]:text-[27px] [&_p:last-child]:m-0 [&_p:last-child]:text-12 [&_p:last-child]:text-blue-100 [&_.primary-button]:min-h-45 [&_.primary-button]:shrink-0 [&_.primary-button]:px-16 [&_.primary-button]:bg-white [&_.primary-button]:text-[#1e3a8a] [&_.primary-button]:shadow-none [&_h2]:text-white max-760:[&_h2]:text-[24px]"><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Your next study session starts here</p><h2>Make every PDF count.</h2><p>Create your free account and build a revision routine that works for you.</p></div><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go("signup")}>Create your free account <ArrowRight size={16} /></button></section>
      <footer className="home-footer relative mt-28 border-t border-white/10 bg-[linear-gradient(180deg,#12111b,#08090f)] px-[clamp(20px,5vw,64px)] pb-22 pt-42 text-[#f2efff]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-[1.5fr_1fr_1fr] gap-40 pb-34 max-680:grid-cols-1 max-680:gap-26">
          <div className="grid content-start justify-items-start gap-12">
            <BrandLogo className="h-32" />
            <p className="m-0 max-w-290 text-12 leading-160 text-[#aaa5b7]">A calmer way to turn your course materials into focused, useful practice.</p>
            <button className="mt-3 inline-flex items-center gap-7 rounded-8 border border-[#49415e] px-12 py-8 text-11 font-semibold text-[#d1c2f5] transition hover:border-[#8770b5] hover:bg-white/5" onClick={() => go("signup")}>Build your study desk <ArrowRight size={13} /></button>
          </div>
          <nav className="grid content-start justify-items-start gap-11" aria-label="Explore RecappEdu">
            <strong className="mb-2 text-11 font-bold uppercase tracking-[.12em] text-white">Explore</strong>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={() => go("learn")}>Learn with AI</button>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={() => go("hierarchy")}>Course repository</button>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={() => go("generate")}>Create a study set</button>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={scrollToPricing}>Plans &amp; pricing</button>
          </nav>
          <nav className="grid content-start justify-items-start gap-11" aria-label="Account and information">
            <strong className="mb-2 text-11 font-bold uppercase tracking-[.12em] text-white">Account &amp; info</strong>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={() => go("login")}>Sign in</button>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={() => go("signup")}>Create an account</button>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={() => go("privacy")}>Privacy policy</button>
            <button className="text-12 text-[#aaa5b7] transition hover:text-white" onClick={() => go("terms")}>Terms of use</button>
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-12 border-t border-white/10 pt-17 text-10 text-[#858096] max-680:flex-col max-680:items-start">
          <span>&copy; {new Date().getFullYear()} RecappEdu. All rights reserved.</span>
          <button className="inline-flex items-center gap-6 transition hover:text-white" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top <ArrowRight size={12} className="-rotate-90" /></button>
        </div>
      </footer>
    </main>
  );
}
