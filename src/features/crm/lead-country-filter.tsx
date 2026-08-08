"use client";

import { NativeSelect } from "@/features/crm/controls";
import { COUNTRIES, US_STATES } from "@/lib/crm-metadata/geographic";

const countryOptions = [
  { value: "", label: "All countries" },
  ...COUNTRIES.filter((country) => country !== "--None--").map((country) => ({
    value: country,
    label: country
  }))
];

const stateOptions = [
  { value: "", label: "All states" },
  ...US_STATES.filter((state) => state !== "--None--").map((state) => ({
    value: state,
    label: state
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

export function LeadStateFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <NativeSelect
      aria-label="Filter leads by state"
      className="h-8 w-48 text-xs"
      options={stateOptions}
      value={value}
      onChange={onChange}
    />
  );
}

export function LeadLocationFilters({
  country,
  state,
  onCountryChange,
  onStateChange
}: {
  country: string;
  state: string;
  onCountryChange: (value: string) => void;
  onStateChange: (value: string) => void;
}) {
  return (
    <>
      <LeadCountryFilter value={country} onChange={onCountryChange} />
      {country === "United States" && <LeadStateFilter value={state} onChange={onStateChange} />}
    </>
  );
}
