import { z } from "zod";
import type { AppKey, CrmObject, OrganizationSummary, UserRecord } from "@/lib/crm-types";

export type ApiErrorBody = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: ApiErrorBody };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export const genericRecordSchema = z
  .object({
    id: z.string().optional()
  })
  .passthrough();

export type GenericRecord = z.infer<typeof genericRecordSchema>;

export const entityRecordSchema = genericRecordSchema.extend({
  id: z.string(),
  organizationId: z.string().optional(),
  createdAt: z.coerce.date().or(z.string()).optional(),
  updatedAt: z.coerce.date().or(z.string()).optional()
});

export const accountDtoSchema = entityRecordSchema.extend({
  name: z.string(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  ownerId: z.string().optional()
});

export const contactDtoSchema = entityRecordSchema.extend({
  firstName: z.string().nullable().optional(),
  lastName: z.string(),
  email: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  ownerId: z.string().optional()
});

export const leadDtoSchema = entityRecordSchema.extend({
  firstName: z.string().nullable().optional(),
  lastName: z.string(),
  company: z.string(),
  status: z.string(),
  email: z.string().nullable().optional(),
  ownerId: z.string().optional()
});

export const opportunityDtoSchema = entityRecordSchema.extend({
  name: z.string(),
  stage: z.string(),
  accountId: z.string().nullable().optional(),
  amount: z.union([z.string(), z.number()]).nullable().optional(),
  closeDate: z.coerce.date().or(z.string()).nullable().optional()
});

export const caseDtoSchema = entityRecordSchema.extend({
  caseNumber: z.string(),
  subject: z.string().nullable().optional(),
  status: z.string(),
  priority: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional()
});

export const eventDtoSchema = entityRecordSchema.extend({
  subject: z.string(),
  startAt: z.coerce.date().or(z.string()),
  endAt: z.coerce.date().or(z.string()),
  allDay: z.boolean().optional(),
  recurrenceRule: z.string().nullable().optional()
});

export type AccountDto = z.infer<typeof accountDtoSchema>;
export type ContactDto = z.infer<typeof contactDtoSchema>;
export type LeadDto = z.infer<typeof leadDtoSchema>;
export type OpportunityDto = z.infer<typeof opportunityDtoSchema>;
export type CaseDto = z.infer<typeof caseDtoSchema>;
export type EventDto = z.infer<typeof eventDtoSchema>;

export const listQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).default(""),
  view: z.string().trim().max(120).default(""),
  sort: z.string().trim().max(80).default(""),
  direction: z.enum(["asc", "desc"]).default("asc")
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export type ListResult<T> = {
  items: T[];
  total: number;
  nextCursor: string | null;
};

export type RecordDetail<T, TRelated extends Record<string, unknown> = Record<string, never>> = {
  record: T;
  related: TRelated;
};

export type ShellPayload = {
  user: UserRecord;
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  organizationRole: "ADMIN" | "MEMBER";
  isSuperAdmin: boolean;
  emailDeliveryConfigured: boolean;
  userPreferences: GenericRecord[];
  notificationPreferences: GenericRecord[];
  notifications: GenericRecord[];
  guidanceItems: GenericRecord[];
  guidanceStates: GenericRecord[];
  setupShortcutStates: GenericRecord[];
  helpArticleStates: GenericRecord[];
  appNavPreferences: GenericRecord[];
  listViewPreferences: GenericRecord[];
  globalSearchRecents: GenericRecord[];
  agentforceMessages: GenericRecord[];
};

export type ScreenData =
  | { kind: "home"; payload: GenericRecord }
  | { kind: "list"; object: CrmObject; payload: ListResult<GenericRecord> }
  | { kind: "record"; object: CrmObject; payload: RecordDetail<GenericRecord> }
  | { kind: Exclude<ScreenKind, "home" | "list" | "record">; payload: GenericRecord };

export type ScreenKind =
  "home" | "list" | "record" | "calendar" | "quickText" | "marketing" | "commerce" | "account" | "analytics";

export type RecordScreenObject = Exclude<CrmObject, "Event" | "QuickText">;

export type ScreenDescriptor =
  | { kind: "home"; activeApp: AppKey }
  | { kind: "list"; activeApp: AppKey; object: CrmObject }
  | { kind: "calendar"; activeApp: AppKey }
  | { kind: "quickText"; activeApp: AppKey }
  | { kind: "record"; activeApp: AppKey; object: RecordScreenObject; id: string }
  | { kind: "marketing"; activeApp: AppKey }
  | { kind: "commerce"; activeApp: AppKey }
  | { kind: "account"; activeApp: AppKey }
  | { kind: "analytics"; activeApp: AppKey };
