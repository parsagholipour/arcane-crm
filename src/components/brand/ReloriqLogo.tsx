import { useId } from "react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type ReloriqMarkProps = {
  className?: string;
  title?: string;
};

type ReloriqLogoProps = ReloriqMarkProps & {
  wordmarkClassName?: string;
};

export function ReloriqMark({ className, title }: ReloriqMarkProps) {
  const markId = useId().replace(/:/g, "");
  const markGradientId = `${markId}-mark`;
  const accentGradientId = `${markId}-accent`;
  const shadowId = `${markId}-shadow`;

  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 48 48"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={markGradientId} x1="7" y1="5" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.58" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
        <linearGradient id={accentGradientId} x1="31" y1="19" x2="41" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1E1B4B" floodOpacity="0.2" />
        </filter>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="13" fill={`url(#${markGradientId})`} filter={`url(#${shadowId})`} />
      <path
        d="M15 35.5V20.25C15 15.69 18.69 12 23.25 12H25.75C31.41 12 36 16.59 36 22.25C36 27.91 31.41 32.5 25.75 32.5H15"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M26.5 32.5L35.75 40" stroke={`url(#${accentGradientId})`} strokeWidth="4" strokeLinecap="round" />
      <circle cx="36" cy="22.25" r="3" fill="#5EEAD4" stroke="#312E81" strokeWidth="1.5" />
      <circle cx="35.75" cy="40" r="2.25" fill="#5EEAD4" />
    </svg>
  );
}

export function ReloriqLogo({ className, title = BRAND.name, wordmarkClassName }: ReloriqLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ReloriqMark className="h-9 w-9" title={title} />
      <span className={cn("tracking-[-0.035em]", wordmarkClassName)}>{BRAND.name}</span>
    </span>
  );
}
