import recappEduMark from "../assets/recappedu-logo-icon.svg";

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

/** Shared RecappEdu lockup built from the current brand mark and wordmark. */
export function BrandLogo({ className = "h-38", alt = "RecappEdu" }: BrandLogoProps) {
  return (
    <span
      aria-label={alt}
      className={`inline-flex max-w-full items-center gap-9 whitespace-nowrap text-ink ${className}`}
      role="img"
    >
      <img alt="" className="aspect-square h-full w-auto shrink-0 object-contain" src={recappEduMark} />
      <span aria-hidden="true" className="font-grotesk text-[clamp(12px,1.15vw,16px)] font-extrabold tracking-[-0.045em]">
        RecappEdu
      </span>
    </span>
  );
}
