import { NextResponse } from "next/server";
import { EmailError } from "@/lib/email/errors";

export function emailErrorResponse(error: unknown) {
  if (!(error instanceof EmailError)) return null;
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
}
