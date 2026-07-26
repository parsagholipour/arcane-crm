import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { addCalendarDays, sameDate, startOfDay } from "@/lib/calendar";
import { type TimelineActivity } from "@/features/crm/shared-types";

export function activityTab(active: boolean) {
  return cn(
    "rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]",
    active && "border-brand-500 bg-brand-50 text-brand-700"
  );
}
export function waitForUploadProgress(delay = 160) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}
export function activityDateValue(activity: TimelineActivity) {
  const parsed = Date.parse(String(activity.date ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
export function activityWithinRange(activity: TimelineActivity, range: string) {
  if (range === "All time") return true;
  const days = range === "Within 7 days" ? 7 : 62;
  const age = Math.abs(Date.now() - activityDateValue(activity));
  return age <= days * 24 * 60 * 60 * 1000;
}
export function groupTimelineActivities(activities: TimelineActivity[]) {
  const groups: Array<{ label: string; activities: TimelineActivity[] }> = [];
  activities.forEach((activity) => {
    const label = timelineGroupLabel(activity);
    const existingGroup = groups.find((group) => group.label === label);
    if (existingGroup) existingGroup.activities.push(activity);
    else groups.push({ label, activities: [activity] });
  });
  return groups;
}
export function timelineGroupLabel(activity: TimelineActivity) {
  const timestamp = activityDateValue(activity);
  if (!timestamp) return "No Date";
  const activityDay = startOfDay(new Date(timestamp));
  const today = startOfDay(new Date());
  const yesterday = addCalendarDays(today, -1);
  const tomorrow = addCalendarDays(today, 1);
  if (sameDate(activityDay, today)) return "Today";
  if (sameDate(activityDay, tomorrow)) return "Tomorrow";
  if (sameDate(activityDay, yesterday)) return "Yesterday";
  return formatDate(activityDay.toISOString());
}
export function activityMatchesStatus(activity: TimelineActivity, status: string) {
  if (status === "All activities") return true;
  const time = activityDateValue(activity);
  const now = Date.now();
  const taskCompleted = String(activity.status ?? "") === "Completed";
  if (status === "Completed")
    return (
      activity.kind === "Email" ||
      activity.kind === "Call" ||
      taskCompleted ||
      (activity.kind === "Event" && time < now)
    );
  if (status === "Upcoming")
    return (activity.kind === "Task" && !taskCompleted && time >= now) || (activity.kind === "Event" && time >= now);
  if (status === "Overdue")
    return (activity.kind === "Task" && !taskCompleted && time < now) || (activity.kind === "Event" && time < now);
  return true;
}
export function activityStatusLabel(activity: TimelineActivity) {
  if (activity.kind === "Email") return String(activity.emailAction ?? "Sent") === "log" ? "Logged" : "Sent";
  if (activity.kind === "Call") return "Completed";
  if (activity.kind === "Task") return String(activity.status ?? "Not Started");
  return activityDateValue(activity) >= Date.now() ? "Upcoming" : "Completed";
}
export function activityDetail(activity: TimelineActivity) {
  if (activity.kind === "Email")
    return `To: ${String(activity.to ?? "recipient")} - ${String(activity.body ?? "No email body")}`;
  if (activity.kind === "Call") return String(activity.comments ?? "No call comments");
  if (activity.kind === "Task")
    return `Due: ${formatDate(String(activity.dueDate ?? activity.date))} - Priority: ${String(activity.priority ?? "Normal")}`;
  return `Scheduled for ${formatDateTime(String(activity.date))}`;
}
