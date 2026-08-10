import type { AiFact, AiNavigationAction } from "@/lib/ai-types";
import type { DeepSeekTool } from "@/lib/ai/deepseek";

export type ToolObject = "Account" | "Contact" | "Lead" | "Opportunity" | "Case" | "Event" | "Task";

export type ToolFilter = {
  field: string;
  operator: "eq" | "in" | "contains" | "before" | "after" | "gte" | "lte";
  value: unknown;
};

export type AgentRuntime = {
  organizationId: string;
  userId: string;
  facts: Map<string, AiFact>;
  actions: Map<string, AiNavigationAction>;
  knownRecordIds: Set<string>;
};

export const actionCatalog: AiNavigationAction[] = [
  { id: "open_home", label: "Open Home", href: "/lightning/page/home" },
  { id: "open_analytics", label: "Open Analytics", href: "/lightning/page/analytics" },
  {
    id: "pipeline_report",
    label: "View Pipeline Report",
    href: "/lightning/page/analytics?report=Pipeline%20by%20Stage"
  },
  { id: "open_opportunities", label: "Open Opportunities", href: "/lightning/o/Opportunity/list" },
  { id: "new_opportunity", label: "New Opportunity", href: "/lightning/o/Opportunity/new" },
  { id: "open_cases", label: "Open Cases", href: "/lightning/o/Case/list?filterName=AllOpenCases" },
  { id: "new_case", label: "New Case", href: "/lightning/o/Case/new" },
  { id: "open_leads", label: "Open Leads", href: "/lightning/o/Lead/list?filterName=AllOpenLeads" },
  { id: "new_lead", label: "New Lead", href: "/lightning/o/Lead/new" },
  { id: "open_accounts", label: "Open Accounts", href: "/lightning/o/Account/list" },
  { id: "open_contacts", label: "Open Contacts", href: "/lightning/o/Contact/list" },
  { id: "open_calendar", label: "Open Calendar", href: "/lightning/o/Event/home" },
  { id: "open_list_email", label: "Open List Emails", href: "/lightning/o/ListEmail/list" }
];

export const objectFields: Record<ToolObject, Record<string, "string" | "number" | "date">> = {
  Account: {
    id: "string",
    name: "string",
    type: "string",
    ownerId: "string",
    website: "string",
    billingCity: "string",
    billingState: "string",
    createdAt: "date",
    updatedAt: "date"
  },
  Contact: {
    id: "string",
    firstName: "string",
    lastName: "string",
    accountId: "string",
    title: "string",
    email: "string",
    ownerId: "string",
    createdAt: "date",
    updatedAt: "date"
  },
  Lead: {
    id: "string",
    firstName: "string",
    lastName: "string",
    company: "string",
    status: "string",
    rating: "string",
    leadSource: "string",
    industry: "string",
    annualRevenue: "number",
    ownerId: "string",
    createdAt: "date",
    updatedAt: "date"
  },
  Opportunity: {
    id: "string",
    name: "string",
    accountId: "string",
    contactId: "string",
    stage: "string",
    forecastCategory: "string",
    closeDate: "date",
    amount: "number",
    courier: "string",
    trackingNumber: "string",
    deliveryDate: "date",
    ownerId: "string",
    createdAt: "date",
    updatedAt: "date"
  },
  Case: {
    id: "string",
    caseNumber: "string",
    subject: "string",
    status: "string",
    priority: "string",
    origin: "string",
    accountId: "string",
    contactId: "string",
    ownerId: "string",
    openedAt: "date",
    closedAt: "date",
    createdAt: "date",
    updatedAt: "date"
  },
  Event: {
    id: "string",
    subject: "string",
    startAt: "date",
    endAt: "date",
    assignedToId: "string",
    relatedObjectType: "string",
    relatedRecordId: "string",
    createdAt: "date",
    updatedAt: "date"
  },
  Task: {
    id: "string",
    subject: "string",
    dueDate: "date",
    status: "string",
    priority: "string",
    ownerId: "string",
    relatedObjectType: "string",
    relatedRecordId: "string",
    createdAt: "date",
    updatedAt: "date"
  }
};

export const searchFields: Record<ToolObject, string[]> = {
  Account: ["name", "type", "website"],
  Contact: ["firstName", "lastName", "title", "email"],
  Lead: ["firstName", "lastName", "company", "status", "rating"],
  Opportunity: ["name", "stage", "forecastCategory"],
  Case: ["caseNumber", "subject", "status", "priority"],
  Event: ["subject", "location"],
  Task: ["subject", "status", "priority"]
};

export const agentTools: DeepSeekTool[] = [
  {
    type: "function",
    function: {
      name: "get_workspace_summary",
      description:
        "Get exact CRM totals, pipeline, lead, case, task, and event summary facts for the active organization.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "query_records",
      description:
        "Read a bounded list of CRM records. Use only documented fields and filters. This never changes data.",
      parameters: {
        type: "object",
        properties: {
          object: { type: "string", enum: Object.keys(objectFields) },
          search: { type: "string", description: "Optional case-insensitive text search." },
          filters: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                operator: { type: "string", enum: ["eq", "in", "contains", "before", "after", "gte", "lte"] },
                value: {}
              },
              required: ["field", "operator", "value"],
              additionalProperties: false
            }
          },
          sortField: { type: "string" },
          sortDirection: { type: "string", enum: ["asc", "desc"] },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        },
        required: ["object"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_record_context",
      description: "Get organization-scoped details and relationships for one CRM record.",
      parameters: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["Account", "Contact", "Lead", "Opportunity", "Case"] },
          id: { type: "string" }
        },
        required: ["object", "id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_record_activities",
      description: "Get the latest email, call, task, and event activities for an Account or Contact.",
      parameters: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["Account", "Contact"] },
          id: { type: "string" }
        },
        required: ["object", "id"],
        additionalProperties: false
      }
    }
  }
];
