/**
 * Decorative wave above the page foot — crest biased to the right (mirrors common “peak left” layouts)
 * using Manifest brand teal / soft blues.
 */
export function PageWaveFooter() {
  const gradId = "manifest-footer-wave-grad";

  const d =
    "M0 120 L0 58 C200 62 280 88 520 72 C760 56 880 22 1200 18 L1200 120 Z";

  return (
    <div className="pointer-events-none relative mt-auto w-full shrink-0 select-none overflow-hidden">
      <div className="relative h-14 w-full sm:h-[4.5rem] md:h-24" aria-hidden>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00A3AD" stopOpacity="0.22" />
              <stop offset="45%" stopColor="#7CC4CA" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#00A3AD" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id={`${gradId}-dark`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00A3AD" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#7CC4CA" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#00A3AD" stopOpacity="0.28" />
            </linearGradient>
          </defs>
          <path fill={`url(#${gradId})`} d={d} className="dark:hidden" />
          <path fill={`url(#${gradId}-dark)`} d={d} className="hidden dark:block" />
        </svg>
        <div
          className="absolute -bottom-6 right-[-10%] h-24 w-[55%] rounded-full bg-brand/15 blur-3xl dark:bg-brand/10 sm:h-32 sm:w-[45%]"
          aria-hidden
        />
      </div>
    </div>
  );
}
