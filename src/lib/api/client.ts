import type { ZodType } from "zod";
import type { ApiErrorBody, ApiFailure, ApiSuccess } from "@/lib/api/contracts";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(error: ApiErrorBody, status: number) {
    super(error.message);
    this.name = "ApiError";
    this.code = error.code;
    this.status = status;
    this.fieldErrors = error.fieldErrors;
  }
}

function isFailure(value: unknown): value is ApiFailure {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(error && typeof error === "object" && "message" in error);
}

function legacyError(value: unknown, fallback: string): ApiErrorBody {
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const message =
      typeof source.error === "string" ? source.error : typeof source.message === "string" ? source.message : fallback;
    const fieldErrors =
      source.fields && typeof source.fields === "object"
        ? Object.fromEntries(Object.entries(source.fields).map(([key, item]) => [key, String(item)]))
        : undefined;
    return { code: "REQUEST_FAILED", message, fieldErrors };
  }
  return { code: "REQUEST_FAILED", message: fallback };
}

export async function apiRequest<T>(url: string, init?: RequestInit, schema?: ZodType<T>): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  const payload = await response.json().catch(() => null);

  if (!response.ok || isFailure(payload)) {
    const error = isFailure(payload)
      ? payload.error
      : legacyError(payload, response.statusText || "The request could not be completed.");
    throw new ApiError(error, response.status);
  }

  const value =
    payload && typeof payload === "object" && "data" in payload ? (payload as ApiSuccess<unknown>).data : payload;
  return schema ? schema.parse(value) : (value as T);
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}
