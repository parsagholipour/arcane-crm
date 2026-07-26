"use client";

import { AssistantUtilityContent } from "@/features/crm/header-agentforce-content";
import { GuidanceUtilityContent } from "@/features/crm/header-guidance-content";
import { HelpUtilityContent } from "@/features/crm/header-help-content";
import { NotificationsUtilityContent } from "@/features/crm/header-notifications-content";
import { ProfileUtilityContent } from "@/features/crm/header-profile-content";
import { SettingsUtilityContent } from "@/features/crm/header-settings-content";
import { type HeaderUtilityProps, type HeaderUtilityState } from "@/features/crm/use-header-utility";

export type HeaderUtilityContentProps = {
  model: HeaderUtilityState;
  utilityProps: HeaderUtilityProps;
};

export function HeaderUtilityContent({ model, utilityProps }: HeaderUtilityContentProps) {
  switch (utilityProps.kind) {
    case "agentforce":
      return <AssistantUtilityContent model={model} utilityProps={utilityProps} />;
    case "guidance":
      return <GuidanceUtilityContent model={model} utilityProps={utilityProps} />;
    case "help":
      return <HelpUtilityContent model={model} utilityProps={utilityProps} />;
    case "settings":
      return <SettingsUtilityContent model={model} utilityProps={utilityProps} />;
    case "notifications":
      return <NotificationsUtilityContent model={model} utilityProps={utilityProps} />;
    case "profile":
      return <ProfileUtilityContent model={model} utilityProps={utilityProps} />;
  }
}
