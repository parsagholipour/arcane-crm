import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ResourceMutationContext } from "@/server/resources/mutations/context";

export async function handlePreferencesMutation(context: ResourceMutationContext) {
  const { payload, values, organizationId, userId, personalWhere } = context;

  if (payload.action === "updateGuidance" && payload.id) {
    const state = await prisma.userGuidanceState.upsert({
      where: { organizationId_userId_itemId: { organizationId, userId, itemId: payload.id } },
      update: {
        status: String(values.status ?? "ACTIVE"),
        snoozedUntil: values.snoozedUntil ? new Date(String(values.snoozedUntil)) : null
      },
      create: {
        organizationId,
        userId,
        itemId: payload.id,
        status: String(values.status ?? "ACTIVE"),
        snoozedUntil: values.snoozedUntil ? new Date(String(values.snoozedUntil)) : null
      }
    });
    return NextResponse.json({ ok: true, state: JSON.parse(JSON.stringify(state)) });
  }

  if (payload.action === "updatePreferences") {
    const preferences = await prisma.userPreference.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      update: {
        displayDensity: values.displayDensity ? String(values.displayDensity) : undefined,
        guidanceEnabled: typeof values.guidanceEnabled === "boolean" ? values.guidanceEnabled : undefined,
        consoleTabsEnabled: typeof values.consoleTabsEnabled === "boolean" ? values.consoleTabsEnabled : undefined,
        homeMode: values.homeMode ? String(values.homeMode) : undefined,
        quarterlyGoal:
          values.quarterlyGoal === null
            ? null
            : values.quarterlyGoal !== undefined
              ? Number(values.quarterlyGoal)
              : undefined,
        timezone: values.timezone ? String(values.timezone) : undefined,
        locale: values.locale ? String(values.locale) : undefined
      },
      create: {
        organizationId,
        userId,
        displayDensity: String(values.displayDensity ?? "Comfy"),
        guidanceEnabled: typeof values.guidanceEnabled === "boolean" ? values.guidanceEnabled : true,
        consoleTabsEnabled: typeof values.consoleTabsEnabled === "boolean" ? values.consoleTabsEnabled : true,
        homeMode: String(values.homeMode ?? "Onboarding"),
        quarterlyGoal:
          values.quarterlyGoal === null || values.quarterlyGoal === undefined ? null : Number(values.quarterlyGoal),
        timezone: values.timezone ? String(values.timezone) : "Asia/Dubai",
        locale: values.locale ? String(values.locale) : "en-US"
      }
    });
    return NextResponse.json({ ok: true, preferences: JSON.parse(JSON.stringify(preferences)) });
  }

  if (payload.action === "updateSetupShortcutState") {
    const shortcutId = String(values.shortcutId ?? payload.id ?? "").trim();
    if (!shortcutId) return NextResponse.json({ error: "Shortcut is required." }, { status: 400 });
    const state = await prisma.setupShortcutState.upsert({
      where: { organizationId_userId_shortcutId: { organizationId, userId, shortcutId } },
      update: {
        pinned: typeof values.pinned === "boolean" ? values.pinned : undefined,
        lastOpenedAt: values.lastOpenedAt ? new Date(String(values.lastOpenedAt)) : undefined
      },
      create: {
        organizationId,
        userId,
        shortcutId,
        pinned: typeof values.pinned === "boolean" ? values.pinned : false,
        lastOpenedAt: values.lastOpenedAt ? new Date(String(values.lastOpenedAt)) : null
      }
    });
    const setupShortcutStates = await prisma.setupShortcutState.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      state: JSON.parse(JSON.stringify(state)),
      setupShortcutStates: JSON.parse(JSON.stringify(setupShortcutStates))
    });
  }

  if (payload.action === "clearSetupShortcutHistory") {
    await prisma.setupShortcutState.updateMany({
      where: { ...personalWhere, pinned: false },
      data: { lastOpenedAt: null }
    });
    await prisma.setupShortcutState.deleteMany({ where: { ...personalWhere, pinned: false, lastOpenedAt: null } });
    const setupShortcutStates = await prisma.setupShortcutState.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ ok: true, setupShortcutStates: JSON.parse(JSON.stringify(setupShortcutStates)) });
  }

  if (payload.action === "updateHelpArticleState") {
    const articleId = String(values.articleId ?? payload.id ?? "").trim();
    if (!articleId) return NextResponse.json({ error: "Article is required." }, { status: 400 });
    const state = await prisma.helpArticleState.upsert({
      where: { organizationId_userId_articleId: { organizationId, userId, articleId } },
      update: {
        saved: typeof values.saved === "boolean" ? values.saved : undefined,
        helpful: typeof values.helpful === "boolean" ? values.helpful : undefined,
        viewedAt: values.viewedAt ? new Date(String(values.viewedAt)) : undefined
      },
      create: {
        organizationId,
        userId,
        articleId,
        saved: typeof values.saved === "boolean" ? values.saved : false,
        helpful: typeof values.helpful === "boolean" ? values.helpful : null,
        viewedAt: values.viewedAt ? new Date(String(values.viewedAt)) : null
      }
    });
    const helpArticleStates = await prisma.helpArticleState.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({
      ok: true,
      state: JSON.parse(JSON.stringify(state)),
      helpArticleStates: JSON.parse(JSON.stringify(helpArticleStates))
    });
  }

  if (payload.action === "clearHelpArticleHistory") {
    await prisma.helpArticleState.updateMany({
      where: { ...personalWhere, saved: false },
      data: { viewedAt: null, helpful: null }
    });
    await prisma.helpArticleState.deleteMany({ where: { ...personalWhere, saved: false, viewedAt: null } });
    const helpArticleStates = await prisma.helpArticleState.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ ok: true, helpArticleStates: JSON.parse(JSON.stringify(helpArticleStates)) });
  }

  if (payload.action === "updateAppNavPreference") {
    const app = String(values.app ?? "");
    const items = Array.isArray(values.items) ? values.items : [];
    if (!app || items.length === 0) return NextResponse.json({ error: "App and items are required." }, { status: 400 });

    const preference = await prisma.appNavPreference.upsert({
      where: { organizationId_userId_app: { organizationId, userId, app } },
      update: { items },
      create: {
        organizationId,
        userId,
        app,
        items
      }
    });
    return NextResponse.json({ ok: true, appNavPreference: JSON.parse(JSON.stringify(preference)) });
  }

  if (payload.action === "resetAppNavPreference") {
    const app = String(values.app ?? "");
    if (!app) return NextResponse.json({ error: "App is required." }, { status: 400 });
    await prisma.appNavPreference.deleteMany({ where: { ...personalWhere, app } });
    return NextResponse.json({ ok: true, app });
  }

  if (payload.action === "updateProfile") {
    const alias = values.alias === undefined ? undefined : String(values.alias).trim();
    if (alias !== undefined && (!alias || alias.length > 8))
      return NextResponse.json({ error: "Alias is required and cannot exceed 8 characters." }, { status: 400 });
    const avatarUrl =
      values.avatarUrl === null ? null : values.avatarUrl === undefined ? undefined : String(values.avatarUrl).trim();
    if (avatarUrl) {
      try {
        const url = new URL(avatarUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
      } catch {
        return NextResponse.json({ error: "Avatar URL must be a valid HTTP or HTTPS URL." }, { status: 400 });
      }
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        alias,
        avatarUrl
      }
    });
    return NextResponse.json({ ok: true, user: JSON.parse(JSON.stringify(user)) });
  }

  return null;
}
