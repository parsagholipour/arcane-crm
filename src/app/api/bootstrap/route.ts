import { loadBootstrapData } from "@/lib/bootstrap";
import { authorizationErrorResponse } from "@/lib/organization-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await loadBootstrapData());
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load CRM data." }, { status: 500 });
  }
}
