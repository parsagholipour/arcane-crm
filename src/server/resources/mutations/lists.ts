import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RECENT_HISTORY_LIMIT } from "@/lib/recent-records";
import type { ResourceMutationContext } from "@/server/resources/mutations/context";

export async function handleListsMutation(context: ResourceMutationContext) {
  const { payload, values, organizationId, userId, personalWhere } = context;

  if (payload.action === "saveListViewPreference") {
    const object = String(values.object ?? "");
    const viewName = String(values.viewName ?? "").trim();
    const columns = Array.isArray(values.columns) ? values.columns.map(String) : [];
    const columnWidths = inputJsonObject(values.columnWidths);
    const filters = Array.isArray(values.filters) ? values.filters : [];
    const chartType = values.chartType ? String(values.chartType) : null;
    const chartField = values.chartField ? String(values.chartField) : null;
    const sharing = values.sharing ? String(values.sharing) : undefined;
    if (!object || !viewName || columns.length === 0)
      return NextResponse.json({ error: "Object, view name, and columns are required." }, { status: 400 });
    const previousViewName = values.previousViewName ? String(values.previousViewName) : "";
    if (previousViewName && previousViewName !== viewName) {
      await prisma.listViewPreference.deleteMany({ where: { ...personalWhere, object, viewName: previousViewName } });
    }

    const pinned = Boolean(values.pinned);
    if (pinned) {
      await prisma.listViewPreference.updateMany({
        where: { ...personalWhere, object },
        data: { pinned: false }
      });
    }

    const preference = await prisma.listViewPreference.upsert({
      where: { organizationId_userId_object_viewName: { organizationId, userId, object, viewName } },
      update: {
        columns,
        columnWidths,
        filters,
        chartType,
        chartField,
        sharing,
        pinned,
        isCustom: Boolean(values.isCustom)
      },
      create: {
        organizationId,
        userId,
        object,
        viewName,
        columns,
        columnWidths,
        filters,
        chartType,
        chartField,
        sharing,
        pinned,
        isCustom: Boolean(values.isCustom)
      }
    });
    const preferences = await prisma.listViewPreference.findMany({
      where: { ...personalWhere, object },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      listViewPreference: JSON.parse(JSON.stringify(preference)),
      listViewPreferences: JSON.parse(JSON.stringify(preferences))
    });
  }

  if (payload.action === "pinListViewPreference") {
    const object = String(values.object ?? "");
    const viewName = String(values.viewName ?? "");
    const columns = Array.isArray(values.columns) ? values.columns.map(String) : [];
    const columnWidths = inputJsonObject(values.columnWidths);
    const filters = Array.isArray(values.filters) ? values.filters : [];
    const chartType = values.chartType ? String(values.chartType) : null;
    const chartField = values.chartField ? String(values.chartField) : null;
    if (!object || !viewName || columns.length === 0)
      return NextResponse.json({ error: "Object, view name, and columns are required." }, { status: 400 });

    await prisma.listViewPreference.updateMany({
      where: { ...personalWhere, object },
      data: { pinned: false }
    });
    const preference = await prisma.listViewPreference.upsert({
      where: { organizationId_userId_object_viewName: { organizationId, userId, object, viewName } },
      update: { columns, columnWidths, filters, chartType, chartField, pinned: true },
      create: {
        organizationId,
        userId,
        object,
        viewName,
        columns,
        columnWidths,
        filters,
        chartType,
        chartField,
        pinned: true,
        isCustom: Boolean(values.isCustom)
      }
    });
    const preferences = await prisma.listViewPreference.findMany({
      where: { ...personalWhere, object },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      listViewPreference: JSON.parse(JSON.stringify(preference)),
      listViewPreferences: JSON.parse(JSON.stringify(preferences))
    });
  }

  if (payload.action === "deleteListViewPreference") {
    const object = String(values.object ?? "");
    const viewName = String(values.viewName ?? "");
    if (!object || !viewName)
      return NextResponse.json({ error: "Object and view name are required." }, { status: 400 });
    await prisma.listViewPreference.deleteMany({ where: { ...personalWhere, object, viewName } });
    const preferences = await prisma.listViewPreference.findMany({
      where: { ...personalWhere, object },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ ok: true, listViewPreferences: JSON.parse(JSON.stringify(preferences)) });
  }

  if (payload.action === "saveGlobalSearchRecent") {
    const href = String(values.href ?? "").trim();
    const label = String(values.label ?? "").trim();
    const context = String(values.context ?? "").trim();
    const category = String(values.category ?? "Record").trim();
    const query = values.query ? String(values.query).trim() : null;
    if (!href || !label || !context)
      return NextResponse.json({ error: "Search label, context, and destination are required." }, { status: 400 });

    const recent = await prisma.globalSearchRecent.upsert({
      where: { organizationId_userId_href: { organizationId, userId, href } },
      update: { query, label, context, category },
      create: { organizationId, userId, query, label, context, href, category }
    });
    const recents = await prisma.globalSearchRecent.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" },
      take: RECENT_HISTORY_LIMIT
    });
    return NextResponse.json({
      ok: true,
      recent: JSON.parse(JSON.stringify(recent)),
      globalSearchRecents: JSON.parse(JSON.stringify(recents))
    });
  }

  if (payload.action === "clearGlobalSearchRecents") {
    await prisma.globalSearchRecent.deleteMany({ where: { ...personalWhere, query: { not: null } } });
    const recents = await prisma.globalSearchRecent.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" },
      take: RECENT_HISTORY_LIMIT
    });
    return NextResponse.json({ ok: true, globalSearchRecents: JSON.parse(JSON.stringify(recents)) });
  }

  if (payload.action === "resetListViewPreferences") {
    const object = String(values.object ?? "");
    if (!object) return NextResponse.json({ error: "Object is required." }, { status: 400 });
    await prisma.listViewPreference.deleteMany({ where: { ...personalWhere, object } });
    return NextResponse.json({ ok: true, listViewPreferences: [] });
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputJsonObject(value: unknown): Prisma.InputJsonObject {
  if (!isPlainObject(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, Prisma.InputJsonValue] =>
    isJsonPrimitive(entry[1])
  );
  return Object.fromEntries(entries) as Prisma.InputJsonObject;
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null;
}
