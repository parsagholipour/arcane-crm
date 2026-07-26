import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ResourceMutationContext } from "@/server/resources/mutations/context";

export async function handleCalendarAndPartnersMutation(context: ResourceMutationContext) {
  const { payload, values, organizationId, userId, personalWhere } = context;

  if (payload.action === "createPartner") {
    const accountId = String(values.accountId ?? "");
    const name = String(values.name ?? "").trim();
    const role = values.role ? String(values.role) : null;
    if (!accountId || !name)
      return NextResponse.json({ error: "Account and partner name are required." }, { status: 400 });
    if (!(await prisma.account.findFirst({ where: { id: accountId, organizationId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    const partner = await prisma.partner.create({
      data: {
        organizationId,
        accountId,
        name,
        role
      }
    });
    return NextResponse.json({ ok: true, partner: JSON.parse(JSON.stringify(partner)) }, { status: 201 });
  }

  if (payload.action === "createCalendarSource") {
    const name = String(values.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Calendar name is required." }, { status: 400 });
    const source = await prisma.calendarSource.create({
      data: {
        organizationId,
        userId,
        name,
        type: String(values.type ?? "My") === "Other" ? "Other" : "My",
        color: String(values.color ?? "#0176d3"),
        visible: values.visible !== false,
        provider: "Local",
        connectionStatus: "Local",
        readOnly: false
      }
    });
    const calendarSources = await prisma.calendarSource.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json(
      {
        ok: true,
        source: JSON.parse(JSON.stringify(source)),
        calendarSources: JSON.parse(JSON.stringify(calendarSources))
      },
      { status: 201 }
    );
  }

  if (payload.action === "toggleQuickTextFavorite") {
    const quickTextId = String(payload.id ?? values.quickTextId ?? "").trim();
    if (!quickTextId) return NextResponse.json({ error: "Quick Text is required." }, { status: 400 });
    const quickText = await prisma.quickText.findFirst({
      where: { id: quickTextId, organizationId },
      select: { id: true }
    });
    if (!quickText) return NextResponse.json({ error: "Quick Text not found." }, { status: 404 });
    const existing = await prisma.quickTextFavorite.findUnique({
      where: { organizationId_userId_quickTextId: { organizationId, userId, quickTextId } }
    });
    if (existing) await prisma.quickTextFavorite.delete({ where: { id: existing.id } });
    else await prisma.quickTextFavorite.create({ data: { organizationId, userId, quickTextId } });
    const quickTextFavorites = await prisma.quickTextFavorite.findMany({
      where: personalWhere,
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      favorite: !existing,
      quickTextFavorites: JSON.parse(JSON.stringify(quickTextFavorites))
    });
  }

  if (payload.action === "updateCalendarSource") {
    const id = String(payload.id ?? values.id ?? "").trim();
    const name = String(values.name ?? "").trim();
    if (!id || !name) return NextResponse.json({ error: "Calendar and name are required." }, { status: 400 });
    await prisma.calendarSource.updateMany({
      where: { id, ...personalWhere },
      data: {
        name,
        type: String(values.type ?? "My") === "Other" ? "Other" : "My",
        color: String(values.color ?? "#0176d3"),
        visible: values.visible !== false
      }
    });
    const source = await prisma.calendarSource.findFirst({ where: { id, ...personalWhere } });
    if (!source) return NextResponse.json({ error: "Calendar not found." }, { status: 404 });
    const calendarSources = await prisma.calendarSource.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      source: JSON.parse(JSON.stringify(source)),
      calendarSources: JSON.parse(JSON.stringify(calendarSources))
    });
  }

  if (payload.action === "deleteCalendarSource") {
    const id = String(payload.id ?? values.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Calendar is required." }, { status: 400 });
    await prisma.calendarSource.deleteMany({ where: { id, ...personalWhere } });
    const calendarSources = await prisma.calendarSource.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ ok: true, calendarSources: JSON.parse(JSON.stringify(calendarSources)) });
  }

  return null;
}
