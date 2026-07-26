import { Prisma } from "@prisma/client";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string; entryId: string }>;
function decimal(value: unknown) {
  try {
    const result = new Prisma.Decimal(String(value ?? ""));
    return result.isFinite() ? result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : null;
  } catch {
    return null;
  }
}
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id, entryId } = await params;
    const existing = await prisma.priceBookEntry.findFirst({
      where: { id: entryId, priceBookId: id, organizationId: context.organizationId }
    });
    if (!existing) return NextResponse.json({ error: "Price Book entry not found." }, { status: 404 });
    const payload = await request.json();
    const listPrice = payload.listPrice === undefined ? undefined : decimal(payload.listPrice);
    if (payload.listPrice !== undefined && (!listPrice || listPrice.lt(0)))
      return NextResponse.json({ error: "List price must be zero or greater." }, { status: 400 });
    const entry = await prisma.priceBookEntry.update({
      where: { id: entryId },
      data: { listPrice, active: payload.active === undefined ? undefined : Boolean(payload.active) },
      include: { product: true, priceBook: true }
    });
    return NextResponse.json({ entry: JSON.parse(JSON.stringify(entry)) });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to update Price Book entry." }, { status: 500 })
    );
  }
}
export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id, entryId } = await params;
    const existing = await prisma.priceBookEntry.findFirst({
      where: { id: entryId, priceBookId: id, organizationId: context.organizationId }
    });
    if (!existing) return NextResponse.json({ error: "Price Book entry not found." }, { status: 404 });
    const used = await prisma.commerceOrderLine.count({
      where: { organizationId: context.organizationId, priceBookEntryId: entryId }
    });
    if (used)
      return NextResponse.json(
        { error: "An entry used by an order cannot be deleted. Deactivate it instead." },
        { status: 409 }
      );
    await prisma.priceBookEntry.deleteMany({
      where: { id: entryId, priceBookId: id, organizationId: context.organizationId }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to delete Price Book entry." }, { status: 500 })
    );
  }
}
