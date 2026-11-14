import { useCallback, useEffect, useRef, useState, type FocusEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import brand1 from "../assets/brand1.png";
import brand2 from "../assets/brand2.png";

/* Landing-page showcase. The artwork lives in src/assets (brand1/brand2 are the
   course-archive and study-desk shots the brand was drawn around) and Vite
   fingerprints it, so swapping a file is the only step to change a slide.

   The carousel is deliberately quiet: it advances on a fixed beat, stops the
   moment a pointer, keyboard or finger is on it, and never auto-advances for
   someone who asked for reduced motion. Styling lives in App.css with the rest
   of the landing page (`.brand-carousel*`). */
const SLIDES = [
  {
    src: brand2,
    alt: "A student carrying a stack of textbooks and notebooks across campus",
    eyebrow: "Built around your study material",
    title: "Turn an exam PDF into practice",
    copy: "Upload your own PDF, or open one from your course archive — then turn it into flashcards or a timed quiz.",
  },
  {
    src: brand1,
    alt: "A chalkboard covered in study doodles: a microscope, globe, books, beakers and a paper plane",
    eyebrow: "Every course, one desk",
    title: "Revise the way your lecturer examined it",
    copy: "Study PDFs are filed by university, faculty, department and course, so what you practise matches what you will sit.",
  },
];

const AUTO_ADVANCE_MS = 6500;

export function BrandCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const total = SLIDES.length;

  const show = useCallback((next: number) => setIndex(((next % total) + total) % total), [total]);

  useEffect(() => {
    if (paused) return;
    // Reduced motion means no self-moving content at all: the arrows and dots
    // stay, but the timer never starts.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      // A background tab should not race through the slides unseen.
      if (!document.hidden) setIndex((current) => (current + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  /* Focus moves between the controls inside the region, so only a blur that
     really leaves the carousel resumes the timer. */
  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStart.current = event.touches[0]?.clientX ?? null;
    setPaused(true);
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    setPaused(false);
    if (start === null) return;
    const travelled = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(travelled) > 45) show(index + (travelled < 0 ? 1 : -1));
  }

  return (
    <section
      className="mx-auto max-w-[1480px] px-[clamp(28px,6vw,70px)] pb-84 max-680:px-20 max-680:pb-44 [&_.carousel-viewport]:overflow-hidden"
      aria-roledescription="carousel"
      aria-label="RecappEdu in practice"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); show(index - 1); }
        if (event.key === "ArrowRight") { event.preventDefault(); show(index + 1); }
      }}
    >
      <div className="relative overflow-hidden rounded-[25px] bg-[#0f172a] shadow-[0_28px_50px_#1d4ed82b] max-[480px]:rounded-18" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="flex transition-transform duration-500 ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
          {SLIDES.map((slide, slideIndex) => (
            <figure
              className="relative m-0 min-w-full flex-[0_0_100%] [&>img]:block [&>img]:h-[clamp(240px,32vw,430px)] [&>img]:w-full [&>img]:object-cover max-680:[&>img]:h-210 [&>figcaption]:absolute [&>figcaption]:bottom-[clamp(16px,3vw,36px)] [&>figcaption]:left-[clamp(16px,3vw,40px)] [&>figcaption]:max-w-[470px] [&>figcaption]:rounded-18 [&>figcaption]:bg-[#0f172ad9] [&>figcaption]:px-24 [&>figcaption]:py-22 [&>figcaption]:text-white [&>figcaption]:backdrop-blur-[6px] max-680:[&>figcaption]:static max-680:[&>figcaption]:max-w-none max-680:[&>figcaption]:rounded-none max-680:[&>figcaption]:bg-[#0f172a] max-680:[&>figcaption]:px-18 max-680:[&>figcaption]:py-16 max-680:[&>figcaption]:backdrop-blur-none [&_figcaption_.eyebrow]:mb-10 [&_figcaption_.eyebrow]:text-[#f2efff] [&_figcaption_strong]:mb-8 [&_figcaption_strong]:block [&_figcaption_strong]:font-grotesk [&_figcaption_strong]:text-23 [&_figcaption_strong]:font-bold [&_figcaption_span]:block [&_figcaption_span]:text-13 [&_figcaption_span]:leading-[1.65] [&_figcaption_span]:text-[#d7d3e6] max-680:[&_figcaption_strong]:text-19"
              key={slide.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} of ${total}`}
              aria-hidden={slideIndex !== index}
            >
              <img src={slide.src} alt={slide.alt} loading="lazy" draggable={false} />
              <figcaption>
                <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">{slide.eyebrow}</p>
                <strong>{slide.title}</strong>
                <span>{slide.copy}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <button className="absolute left-[clamp(14px,2vw,26px)] top-1/2 grid size-42 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#0f172a99] text-white transition hover:border-white/40 hover:bg-brand" aria-label="Previous slide" onClick={() => show(index - 1)}>
          <ChevronLeft size={18} />
        </button>
        <button className="absolute right-[clamp(14px,2vw,26px)] top-1/2 grid size-42 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#0f172a99] text-white transition hover:border-white/40 hover:bg-brand" aria-label="Next slide" onClick={() => show(index + 1)}>
          <ChevronRight size={18} />
        </button>
        <div className="absolute right-[clamp(14px,2vw,26px)] top-[clamp(14px,2vw,26px)] flex items-center gap-7 rounded-full bg-[#0f172acc] px-11 py-7 [&>button]:size-8 [&>button]:rounded-full [&>button]:bg-white/50 [&>button]:transition [&>.active]:w-22 [&>.active]:rounded-full [&>.active]:bg-white">
          {SLIDES.map((slide, dotIndex) => (
            <button
              key={slide.title}
              className={dotIndex === index ? "active" : ""}
              aria-label={`Show slide ${dotIndex + 1}: ${slide.title}`}
              aria-current={dotIndex === index}
              onClick={() => show(dotIndex)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
