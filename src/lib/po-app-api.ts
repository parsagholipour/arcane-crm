import { apiFailure } from "@/lib/api/response";
import { PoAppError } from "@/lib/po-app-client";
import { poAppFailureReason } from "@/lib/po-app-integration";

/**
 * Maps a PO App client failure onto the shared error envelope, returning null for anything else
 * so callers can fall through to `apiErrorResponse`. The message is always the sanitised one —
 * an upstream response body is never echoed back to a browser.
 */
export function poAppErrorResponse(error: unknown) {
  if (!(error instanceof PoAppError)) return null;
  return apiFailure({ code: error.code, message: poAppFailureReason(error) }, error.status);
}
