import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ResourceMutationContext } from "@/server/resources/mutations/context";

export async function handleAnalyticsMutation(context: ResourceMutationContext) {
  const { payload, values, organizationId, userId, personalWhere } = context;

  if (payload.action === "saveCustomReport") {
    const name = String(values.name ?? "").trim();
    const object = String(values.object ?? "").trim();
    const groupField = String(values.groupField ?? "").trim();
    const columns = Array.isArray(values.columns) ? values.columns.map(String).filter(Boolean) : [];
    if (!name || !object || !groupField || columns.length === 0)
      return NextResponse.json(
        { error: "Report name, object, group field, and columns are required." },
        { status: 400 }
      );
    const report = await prisma.customReport.create({
      data: {
        organizationId,
        userId,
        name,
        object,
        groupField,
        columns
      }
    });
    const reports = await prisma.customReport.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
    return NextResponse.json(
      { ok: true, report: JSON.parse(JSON.stringify(report)), customReports: JSON.parse(JSON.stringify(reports)) },
      { status: 201 }
    );
  }

  if (payload.action === "updateCustomReport") {
    const id = String(payload.id ?? values.id ?? "").trim();
    const name = String(values.name ?? "").trim();
    const object = String(values.object ?? "").trim();
    const groupField = String(values.groupField ?? "").trim();
    const columns = Array.isArray(values.columns) ? values.columns.map(String).filter(Boolean) : [];
    if (!id || !name || !object || !groupField || columns.length === 0)
      return NextResponse.json(
        { error: "Report, name, object, group field, and columns are required." },
        { status: 400 }
      );
    const changed = await prisma.customReport.updateMany({
      where: { id, ...personalWhere },
      data: { name, object, groupField, columns }
    });
    if (!changed.count) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const report = await prisma.customReport.findFirst({ where: { id, ...personalWhere } });
    const reports = await prisma.customReport.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({
      ok: true,
      report: JSON.parse(JSON.stringify(report)),
      customReports: JSON.parse(JSON.stringify(reports))
    });
  }

  if (payload.action === "deleteCustomReport") {
    const id = String(payload.id ?? values.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Report is required." }, { status: 400 });
    const existing = await prisma.customReport.findFirst({ where: { id, ...personalWhere }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const componentId = `custom-report-${id}`;
    const dashboards = await prisma.customDashboard.findMany({ where: personalWhere });
    await prisma.$transaction([
      ...dashboards.map((dashboard) =>
        prisma.customDashboard.update({
          where: { id: dashboard.id },
          data: {
            reportIds: Array.isArray(dashboard.reportIds)
              ? (dashboard.reportIds as Prisma.JsonArray)
                  .map(String)
                  .filter((item) => item !== componentId && item !== id)
              : []
          }
        })
      ),
      prisma.customReport.delete({ where: { id } })
    ]);
    const reports = await prisma.customReport.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
    const customDashboards = await prisma.customDashboard.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      customReports: JSON.parse(JSON.stringify(reports)),
      customDashboards: JSON.parse(JSON.stringify(customDashboards))
    });
  }

  if (payload.action === "saveCustomDashboard") {
    const name = String(values.name ?? "").trim();
    const reportIds = Array.isArray(values.reportIds) ? values.reportIds.map(String).filter(Boolean) : [];
    if (!name || reportIds.length === 0)
      return NextResponse.json({ error: "Dashboard name and at least one component are required." }, { status: 400 });
    const dashboard = await prisma.customDashboard.create({
      data: {
        organizationId,
        userId,
        name,
        reportIds
      }
    });
    const dashboards = await prisma.customDashboard.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json(
      {
        ok: true,
        dashboard: JSON.parse(JSON.stringify(dashboard)),
        customDashboards: JSON.parse(JSON.stringify(dashboards))
      },
      { status: 201 }
    );
  }

  if (payload.action === "updateCustomDashboard") {
    const id = String(payload.id ?? values.id ?? "").trim();
    const name = String(values.name ?? "").trim();
    const reportIds = Array.isArray(values.reportIds) ? values.reportIds.map(String).filter(Boolean) : [];
    if (!id || !name || reportIds.length === 0)
      return NextResponse.json({ error: "Dashboard, name, and at least one component are required." }, { status: 400 });
    const changed = await prisma.customDashboard.updateMany({
      where: { id, ...personalWhere },
      data: { name, reportIds }
    });
    if (!changed.count) return NextResponse.json({ error: "Dashboard not found." }, { status: 404 });
    const dashboard = await prisma.customDashboard.findFirst({ where: { id, ...personalWhere } });
    const dashboards = await prisma.customDashboard.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      dashboard: JSON.parse(JSON.stringify(dashboard)),
      customDashboards: JSON.parse(JSON.stringify(dashboards))
    });
  }

  if (payload.action === "deleteCustomDashboard") {
    const id = String(payload.id ?? values.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Dashboard is required." }, { status: 400 });
    const removed = await prisma.customDashboard.deleteMany({ where: { id, ...personalWhere } });
    if (!removed.count) return NextResponse.json({ error: "Dashboard not found." }, { status: 404 });
    const dashboards = await prisma.customDashboard.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ ok: true, customDashboards: JSON.parse(JSON.stringify(dashboards)) });
  }

  return null;
}
