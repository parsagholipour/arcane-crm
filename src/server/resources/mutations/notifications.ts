import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ResourceMutationContext } from "@/server/resources/mutations/context";

export async function handleNotificationsMutation(context: ResourceMutationContext) {
  const { payload, values, organizationId, userId, personalWhere } = context;

  if (payload.action === "markNotificationRead" && payload.id) {
    const notification = await prisma.notification.updateManyAndReturn({
      where: { id: payload.id, ...personalWhere },
      data: { read: true }
    });
    if (!notification[0]) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    return NextResponse.json({ ok: true, notification: JSON.parse(JSON.stringify(notification[0])) });
  }

  if (payload.action === "markAllNotificationsRead") {
    await prisma.notification.updateMany({
      where: { ...personalWhere, read: false },
      data: { read: true }
    });
    const notifications = await prisma.notification.findMany({
      where: personalWhere,
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ ok: true, notifications: JSON.parse(JSON.stringify(notifications)) });
  }

  if (payload.action === "deleteNotification" && payload.id) {
    await prisma.notification.deleteMany({ where: { id: payload.id, ...personalWhere } });
    return NextResponse.json({ ok: true });
  }

  if (payload.action === "clearReadNotifications") {
    await prisma.notification.deleteMany({ where: { ...personalWhere, read: true } });
    const notifications = await prisma.notification.findMany({
      where: personalWhere,
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ ok: true, notifications: JSON.parse(JSON.stringify(notifications)) });
  }

  if (payload.action === "clearAllNotifications") {
    await prisma.notification.deleteMany({ where: personalWhere });
    return NextResponse.json({ ok: true, notifications: [] });
  }

  if (payload.action === "createNotification") {
    const category = values.category ? String(values.category) : "General";
    const preference = await prisma.notificationPreference.findUnique({
      where: { organizationId_userId_category: { organizationId, userId, category } }
    });
    if (preference?.enabled === false) {
      const notifications = await prisma.notification.findMany({
        where: personalWhere,
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json({ ok: true, skipped: true, notifications: JSON.parse(JSON.stringify(notifications)) });
    }
    const notification = await prisma.notification.create({
      data: {
        organizationId,
        userId,
        title: String(values.title ?? "Notification"),
        body: String(values.body ?? ""),
        href: values.href ? String(values.href) : null,
        category,
        read: false
      }
    });
    return NextResponse.json({ ok: true, notification: JSON.parse(JSON.stringify(notification)) }, { status: 201 });
  }

  if (payload.action === "updateNotificationPreference") {
    const category = String(values.category ?? "").trim();
    if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
    const preference = await prisma.notificationPreference.upsert({
      where: { organizationId_userId_category: { organizationId, userId, category } },
      update: { enabled: values.enabled !== false },
      create: { organizationId, userId, category, enabled: values.enabled !== false }
    });
    const notificationPreferences = await prisma.notificationPreference.findMany({ where: personalWhere });
    return NextResponse.json({
      ok: true,
      preference: JSON.parse(JSON.stringify(preference)),
      notificationPreferences: JSON.parse(JSON.stringify(notificationPreferences))
    });
  }

  return null;
}
