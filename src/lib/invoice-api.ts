import "server-only";

import { Prisma } from "@prisma/client";
import { emailErrorResponse } from "@/lib/email/http";
import { NextResponse } from "next/server";
import { InvoiceDomainError } from "@/lib/invoices";
import { authorizationErrorResponse } from "@/lib/organization-context";

export function invoiceJson(value: unknown, init?: ResponseInit) {
  return NextResponse.json(JSON.parse(JSON.stringify(value)), init);
}

export function invoiceErrorResponse(error: unknown) {
  const authorizationResponse = authorizationErrorResponse(error);
  if (authorizationResponse) return authorizationResponse;
  const deliveryResponse = emailErrorResponse(error);
  if (deliveryResponse) return deliveryResponse;
  if (error instanceof InvoiceDomainError) {
    return NextResponse.json({ error: error.message, ...(error.field ? { field: error.field } : {}) }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "An invoice with that number already exists. Retry the request." }, { status: 409 });
  }
  console.error(error);
  return NextResponse.json({ error: "Unable to complete the invoice request." }, { status: 500 });
}
