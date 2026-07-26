export type CrmObject =
  | "Account"
  | "Contact"
  | "Lead"
  | "Opportunity"
  | "Product2"
  | "Pricebook2"
  | "Event"
  | "Case"
  | "QuickText"
  | "MessagingSession"
  | "Knowledge__kav"
  | "ListEmail"
  | "Campaign"
  | "Invoice"
  | "VideoCall";

export type RecordData = {
  id?: string;
  [key: string]: unknown;
};

export type UserRecord = {
  id: string;
  name: string;
  alias: string;
  email?: string | null;
  avatarUrl?: string | null;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role?: "ADMIN" | "MEMBER";
};

export type ScopedCrmData = {
  user: UserRecord;
  users: UserRecord[];
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  organizationRole: "ADMIN" | "MEMBER";
  isSuperAdmin: boolean;
  emailDeliveryConfigured: boolean;
  accounts: RecordData[];
  contacts: RecordData[];
  leads: RecordData[];
  opportunities: RecordData[];
  cases: RecordData[];
  products: RecordData[];
  priceBooks: RecordData[];
  priceBookEntries: RecordData[];
  events: RecordData[];
  calendarSources: RecordData[];
  quickTexts: RecordData[];
  quickTextFolders: RecordData[];
  quickTextFavorites: RecordData[];
  knowledgeArticles: RecordData[];
  listEmails: RecordData[];
  messagingSessions: RecordData[];
  invoices: RecordData[];
  videoCalls: RecordData[];
  files: RecordData[];
  attachments: RecordData[];
  tasks: RecordData[];
  emailActivities: RecordData[];
  emailDeliveries: RecordData[];
  callActivities: RecordData[];
  partners: RecordData[];
  stores: RecordData[];
  commerceOrders: RecordData[];
  inventoryItems: RecordData[];
  commercePromotions: RecordData[];
  commerceFulfillments: RecordData[];
  campaigns: RecordData[];
  campaignMembers: RecordData[];
  recordLabels: RecordData[];
  marketingActivations: RecordData[];
  marketingLandingPages: RecordData[];
  customReports: RecordData[];
  customDashboards: RecordData[];
  notifications: RecordData[];
  notificationPreferences: RecordData[];
  guidanceItems: RecordData[];
  guidanceStates: RecordData[];
  userPreferences: RecordData[];
  setupShortcutStates: RecordData[];
  helpArticleStates: RecordData[];
  appNavPreferences: RecordData[];
  listViewPreferences: RecordData[];
  globalSearchRecents: RecordData[];
  agentforceMessages: RecordData[];
};

export type ColumnDefinition = {
  key: string;
  label: string;
  editable?: boolean;
  link?: boolean;
  width?: string;
};

export type ObjectDefinition = {
  object: CrmObject;
  label: string;
  plural: string;
  icon: string;
  dataKey: keyof ScopedCrmData;
  defaultList: string;
  listViews: string[];
  actions: string[];
  columns: ColumnDefinition[];
  searchInputName: string;
  statusWhenEmpty?: string;
  emptyTitle?: string;
  emptyBody?: string;
  disabledInlineEditMessage?: string;
  supportsNew?: boolean;
};

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "url"
  | "phone"
  | "number"
  | "currency"
  | "date"
  | "time"
  | "checkbox"
  | "picklist"
  | "lookup"
  | "readonly";

export type FieldDefinition = {
  name: string;
  label: string;
  section: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  /** When set, picklist options are resolved from the controlling field's value (e.g. country → state). */
  dependsOn?: string;
  lookupObject?: CrmObject | "User" | "People";
  defaultValue?: string | boolean | number;
  readOnly?: boolean;
};

export type FormDefinition = {
  object: CrmObject;
  title: string;
  fields: FieldDefinition[];
  saveLabel?: string;
};

export type AppKey = "home" | "contacts" | "accounts" | "sales" | "service" | "marketing" | "commerce" | "your-account";

export type AppNavItem = {
  label: string;
  href: string;
  object?: CrmObject;
};
