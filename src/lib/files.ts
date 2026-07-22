const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const ABSOLUTE_MAX_FILE_BYTES = 25 * 1024 * 1024;

const blockedExtensions = new Set([
  "app", "bat", "cmd", "com", "cpl", "dll", "dmg", "exe", "hta", "jar", "js", "jse", "msi", "msp", "pif", "ps1", "scr", "vbe", "vbs", "wsf"
]);

const previewableTypes = new Set([
  "application/pdf",
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain"
]);

export class FileValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function configuredMaxFileBytes() {
  const configured = Number(process.env.CRM_MAX_FILE_BYTES ?? DEFAULT_MAX_FILE_BYTES);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_FILE_BYTES;
  return Math.min(Math.floor(configured), ABSOLUTE_MAX_FILE_BYTES);
}

export function normalizeFileName(value: string) {
  const leaf = value.replace(/\\/g, "/").split("/").pop() ?? "file";
  const normalized = leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
  return normalized || "file";
}

export function validateFileMetadata(name: string, size: number, contentType: string) {
  if (!Number.isInteger(size) || size <= 0) throw new FileValidationError("Choose a non-empty file.");
  const maxBytes = configuredMaxFileBytes();
  if (size > maxBytes) throw new FileValidationError(`File size cannot exceed ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413);
  const normalizedName = normalizeFileName(name);
  const extension = normalizedName.includes(".") ? normalizedName.split(".").pop()!.toLowerCase() : "";
  const normalizedType = contentType.trim().toLowerCase() || "application/octet-stream";
  if (blockedExtensions.has(extension) || normalizedType === "image/svg+xml" || normalizedType.includes("javascript")) {
    throw new FileValidationError("This file type is not allowed.", 415);
  }
  return { name: normalizedName, contentType: normalizedType };
}

export function isPreviewableContentType(contentType: string | null | undefined) {
  return previewableTypes.has(String(contentType ?? "").toLowerCase());
}

export function contentDisposition(name: string, inline: boolean) {
  const normalized = normalizeFileName(name);
  const ascii = normalized.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(normalized)}`;
}
