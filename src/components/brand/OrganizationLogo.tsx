"use client";

import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

type OrganizationLogoProps = {
  name: string;
  logoUrl?: string | null;
  className?: string;
};

export function OrganizationLogo({ name, logoUrl, className }: OrganizationLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!logoUrl || logoUrl === failedUrl) {
    return <Logo className={cn("min-w-[112px] text-shell", className)} wordmarkClassName="text-[17px] font-bold" />;
  }

  return (
    <span className={cn("inline-flex h-9 min-w-[112px] shrink-0 items-center", className)}>
      {/* Organization branding can be hosted on any HTTPS origin, so Next Image optimization is intentionally bypassed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="block max-h-9 max-w-[160px] object-contain"
        onError={() => setFailedUrl(logoUrl)}
      />
    </span>
  );
}
