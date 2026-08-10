/** Pure helpers for resolving a user's display / welcome name from IdP claims. */

export function stringClaim(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  for (const key of keys) {
    const claim = source[key];
    if (typeof claim === "string" && claim.trim()) return claim.trim();
  }
  return null;
}

export function profileDisplayName(
  profile: unknown,
  email: string,
  fallbackLabel = "User"
): { name: string; quality: "full" | "fallback" } {
  const given = stringClaim(profile, ["given_name"]);
  const family = stringClaim(profile, ["family_name"]);
  const composed = [given, family].filter(Boolean).join(" ").trim();
  if (composed) return { name: composed, quality: "full" };

  const preferred = stringClaim(profile, ["preferred_username"]);
  const full = stringClaim(profile, ["name"]);
  if (full && (!preferred || full.toLowerCase() !== preferred.toLowerCase())) {
    return { name: full, quality: "full" };
  }

  const local = email.split("@")[0]?.trim();
  return { name: local || fallbackLabel, quality: "fallback" };
}

export function resolveSyncedDisplayName(input: {
  incoming: string;
  quality: "full" | "fallback";
  existingName: string;
  preferredUsername?: string | null;
  email?: string | null;
}) {
  const existing = input.existingName.trim();
  if (input.quality === "full") return input.incoming.trim();
  if (!existing) return input.incoming.trim();

  const preferred = input.preferredUsername?.trim().toLowerCase() ?? "";
  const emailLocal = input.email?.split("@")[0]?.trim().toLowerCase() ?? "";
  const existingLower = existing.toLowerCase();
  const existingIsUsernameLike =
    (preferred && existingLower === preferred) || (emailLocal && existingLower === emailLocal);

  return existingIsUsernameLike ? input.incoming.trim() : existing;
}

export function welcomeFirstName(fullName: string | null | undefined) {
  const trimmed = String(fullName ?? "").trim();
  if (!trimmed) return "there";
  const base = trimmed.includes("@") ? (trimmed.split("@")[0] ?? trimmed) : trimmed;
  return base.split(/\s+/).find(Boolean) || trimmed;
}

export function splitDisplayName(name: string) {
  const parts = name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}
