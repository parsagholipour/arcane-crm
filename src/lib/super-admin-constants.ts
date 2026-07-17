export function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function configuredSuperAdminEmails() {
  return new Set(
    (process.env.SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean)
  );
}

export function isSuperAdminEmail(value: string | null | undefined) {
  const normalized = normalizeEmail(value);
  return Boolean(normalized) && configuredSuperAdminEmails().has(normalized);
}
