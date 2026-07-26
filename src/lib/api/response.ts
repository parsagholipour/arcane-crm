import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorBody, ApiFailure, ApiSuccess } from "@/lib/api/contracts";
import { AppAuthorizationError } from "@/lib/organization-context";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data }, { status });
}

export function apiFailure(error: ApiErrorBody, status: number) {
  return NextResponse.json<ApiFailure>({ error }, { status });
}

export function apiErrorResponse(error: unknown, fallback = "The request could not be completed.") {
  if (error instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      error.issues.map((issue) => [issue.path.join(".") || "request", issue.message])
    );
    return apiFailure({ code: "VALIDATION_ERROR", message: "Check the highlighted values.", fieldErrors }, 400);
  }
  if (error instanceof AppAuthorizationError) {
    return apiFailure(
      { code: error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message: error.message },
      error.status
    );
  }
  console.error(error);
  return apiFailure({ code: "INTERNAL_ERROR", message: fallback }, 500);
}

export async function standardizeApiResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok) {
    if (payload && "data" in payload) {
      return NextResponse.json(payload, { status: response.status });
    }
    const data = payload ? { ...payload } : {};
    return apiSuccess(data, response.status);
  }

  const structured =
    payload?.error && typeof payload.error === "object" ? (payload.error as Partial<ApiErrorBody>) : null;
  const message =
    structured?.message ?? (typeof payload?.error === "string" ? payload.error : "The request could not be completed.");
  const fieldErrors =
    structured?.fieldErrors ??
    (typeof payload?.field === "string"
      ? { [payload.field]: message }
      : Array.isArray(payload?.fields)
        ? Object.fromEntries(payload.fields.map((field) => [String(field), message]))
        : undefined);
  return apiFailure(
    {
      code: structured?.code ?? "REQUEST_FAILED",
      message,
      ...(fieldErrors ? { fieldErrors } : {})
    },
    response.status
  );
}
