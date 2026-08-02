import { timingSafeEqual } from "node:crypto";

export function configuredCalendarReminderCronSecret(environment: NodeJS.ProcessEnv = process.env) {
  return environment.CALENDAR_REMINDER_CRON_SECRET?.trim() ?? "";
}

export function configuredShipmentTrackingCronSecret(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  return environment.SHIPMENT_TRACKING_CRON_SECRET?.trim() ?? "";
}

export function validBearerSecret(authorization: string | null, expectedSecret: string) {
  const prefix = "Bearer ";
  if (!expectedSecret || !authorization?.startsWith(prefix)) return false;
  const receivedSecret = authorization.slice(prefix.length);
  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
