import { Prisma } from "@prisma/client";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
function decimal(value: unknown) { try { const result = new Prisma.Decimal(String(value ?? "")); return result.isFinite() ? result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : null; } catch { return null; } }

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; const book = await prisma.priceBook.findFirst({ where: { id, organizationId: context.organizationId } }); if (!book) return NextResponse.json({ error: "Price Book not found." }, { status: 404 }); const entries = await prisma.priceBookEntry.findMany({ where: { organizationId: context.organizationId, priceBookId: id }, include: { product: true, priceBook: true } }); return NextResponse.json({ priceBook: book, entries: JSON.parse(JSON.stringify(entries)) }); }
  catch (error) { return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load Price Book entries." }, { status: 500 }); }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext(); const { id } = await params; const payload = await request.json();
    const book = await prisma.priceBook.findFirst({ where: { id, organizationId: context.organizationId } }); if (!book) return NextResponse.json({ error: "Price Book not found." }, { status: 404 });
    const productId = String(payload.productId ?? ""); const product = await prisma.product.findFirst({ where: { id: productId, organizationId: context.organizationId } }); if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const currency = String(payload.currency ?? "USD").toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: "Currency must be a three-letter ISO code." }, { status: 400 });
    const listPrice = decimal(payload.listPrice); if (!listPrice || listPrice.lt(0)) return NextResponse.json({ error: "List price must be zero or greater." }, { status: 400 });
    const duplicate = await prisma.priceBookEntry.findFirst({ where: { organizationId: context.organizationId, priceBookId: id, productId, currency } }); if (duplicate) return NextResponse.json({ error: "This Product and currency already have an entry in the Price Book." }, { status: 409 });
    const entry = await prisma.priceBookEntry.create({ data: { organizationId: context.organizationId, priceBookId: id, productId, currency, listPrice, active: payload.active !== false }, include: { product: true, priceBook: true } });
    return NextResponse.json({ entry: JSON.parse(JSON.stringify(entry)) }, { status: 201 });
  } catch (error) { return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to create Price Book entry." }, { status: 500 }); }
}
