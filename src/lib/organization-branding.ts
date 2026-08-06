const MAX_LOGO_URL_LENGTH = 2048;
export const MAX_ORGANIZATION_LOGO_BYTES = 2 * 1024 * 1024;

const logoTypes = {
  "image/gif": { extension: "gif", signature: [0x47, 0x49, 0x46, 0x38] },
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }
} as const;

type LogoType = keyof typeof logoTypes | "image/webp";

export class OrganizationLogoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationLogoValidationError";
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function detectedLogoType(bytes: Uint8Array): LogoType | null {
  for (const [contentType, definition] of Object.entries(logoTypes)) {
    if (startsWith(bytes, definition.signature)) return contentType as keyof typeof logoTypes;
  }
  const riff = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]);
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return riff && webp ? "image/webp" : null;
}

export function validateOrganizationLogo(file: { size: number; type: string }, bytes: Uint8Array) {
  if (!Number.isInteger(file.size) || file.size <= 0)
    throw new OrganizationLogoValidationError("Choose a non-empty logo image.");
  if (file.size > MAX_ORGANIZATION_LOGO_BYTES)
    throw new OrganizationLogoValidationError("Organization logos cannot exceed 2 MB.");
  if (bytes.byteLength !== file.size) throw new OrganizationLogoValidationError("The logo upload was incomplete.");

  const contentType = detectedLogoType(bytes);
  if (!contentType) throw new OrganizationLogoValidationError("Logo must be a PNG, JPEG, WebP, or GIF image.");
  const declaredType = file.type.trim().toLowerCase();
  if (declaredType && declaredType !== contentType)
    throw new OrganizationLogoValidationError("The logo file content does not match its declared image type.");

  return {
    contentType,
    extension: contentType === "image/webp" ? "webp" : logoTypes[contentType].extension
  };
}

export function normalizeOrganizationLogoUrl(value: unknown) {
  const logoUrl = typeof value === "string" ? value.trim() : "";
  if (!logoUrl) return null;
  if (logoUrl.length > MAX_LOGO_URL_LENGTH) throw new Error("Organization logo URL is too long.");

  let parsed: URL;
  try {
    parsed = new URL(logoUrl);
  } catch {
    throw new Error("Organization logo must be a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Organization logo must use an http or https URL.");
  }
  return logoUrl;
}

export function resolveOrganizationLogoUrl(organization: {
  id: string;
  logoUrl?: string | null;
  logoObjectKey?: string | null;
  updatedAt?: Date | string | number | null;
}) {
  if (!organization.logoObjectKey) return organization.logoUrl ?? null;
  const updatedAt = organization.updatedAt ? new Date(organization.updatedAt).getTime() : NaN;
  const version = Number.isFinite(updatedAt) ? `?v=${updatedAt}` : "";
  return `/api/organizations/${encodeURIComponent(organization.id)}/logo${version}`;
}
