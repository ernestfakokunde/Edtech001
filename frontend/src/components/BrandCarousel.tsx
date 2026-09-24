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
    eyebrow: "Built around your papers",
    title: "Turn a past paper into practice",
    copy: "Upload your own PDF, or open one from your course archive — the same paper becomes flashcards or a timed quiz.",
  },
  {
    src: brand1,
    alt: "A chalkboard covered in study doodles: a microscope, globe, books, beakers and a paper plane",
    eyebrow: "Every course, one desk",
    title: "Revise the way your lecturer examined it",
    copy: "Papers are filed by university, faculty, department and course, so what you practise matches what you will sit.",
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
      className="brand-carousel"
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
      <div className="carousel-viewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {SLIDES.map((slide, slideIndex) => (
            <figure
              className="carousel-slide"
              key={slide.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} of ${total}`}
              aria-hidden={slideIndex !== index}
            >
              <img src={slide.src} alt={slide.alt} loading="lazy" draggable={false} />
              <figcaption>
                <p className="eyebrow">{slide.eyebrow}</p>
                <strong>{slide.title}</strong>
                <span>{slide.copy}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <button className="carousel-arrow prev" aria-label="Previous slide" onClick={() => show(index - 1)}>
          <ChevronLeft size={18} />
        </button>
        <button className="carousel-arrow next" aria-label="Next slide" onClick={() => show(index + 1)}>
          <ChevronRight size={18} />
        </button>
        <div className="carousel-dots">
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
