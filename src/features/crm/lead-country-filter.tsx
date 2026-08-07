"use client";

import { NativeSelect } from "@/features/crm/controls";
import { COUNTRIES } from "@/lib/crm-metadata/geographic";

const countryOptions = [
  { value: "", label: "All countries" },
  ...COUNTRIES.filter((country) => country !== "--None--").map((country) => ({
    value: country,
    label: country
  }))
];

export function LeadCountryFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <NativeSelect
      aria-label="Filter leads by country"
      className="h-8 w-48 text-xs"
      options={countryOptions}
      value={value}
      onChange={onChange}
    />
  );
}
