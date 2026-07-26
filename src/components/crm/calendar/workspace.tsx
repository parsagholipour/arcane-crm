"use client";

import { useCalendarWorkspace } from "@/components/crm/calendar/workspace-controller";
import { CalendarWorkspaceView } from "@/components/crm/calendar/workspace-view";
import type { CalendarWorkspaceProps } from "@/components/crm/calendar/primitives";

export function CalendarWorkspace(props: CalendarWorkspaceProps) {
  const model = useCalendarWorkspace(props);
  return <CalendarWorkspaceView model={model} />;
}
