import { loadBootstrapData } from "@/lib/bootstrap";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadBootstrapData();
  return NextResponse.json(data);
}
