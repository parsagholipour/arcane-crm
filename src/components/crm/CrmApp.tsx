"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Activity,
  AlertCircle,
  BadgeDollarSign,
  Bell,
  Bookmark,
  BookOpen,
  Box,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Cloud,
  Columns3,
  Download,
  Edit3,
  Eye,
  Filter,
  GripVertical,
  History,
  HelpCircle,
  Home,
  LayoutDashboard,
  Library,
  List,
  Mail,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Video,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode
} from "react";
import {
  APP_NAV,
  CASE_STATUS,
  CURRENT_USER,
  EVENT_SUBJECTS,
  FORECAST_CATEGORY,
  FORM_DEFINITIONS,
  LEAD_STATUS,
  LIST_EMAIL_LAYOUTS,
  NAME_OBJECT_TYPES,
  OBJECT_DEFINITIONS,
  OPPORTUNITY_STAGE,
  PRODUCT_FAMILY,
  RELATED_OBJECT_TYPES,
  SHOW_TIME_AS,
  stateOptionsForCountry,
  TIME_SLOTS
} from "@/lib/crm-metadata";
import { contactName, dataKeyForObject, decorateBootstrap, recordTitle, routeForRecord } from "@/lib/crm-data";
import type { AppKey, AppNavItem, BootstrapData, CrmObject, FieldDefinition, FormDefinition, ObjectDefinition, RecordData } from "@/lib/crm-types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

type ModalState =
  | { type: "record"; mode: "new" | "edit"; object: CrmObject; record?: RecordData }
  | { type: "product" }
  | { type: "event"; relatedObjectType?: CrmObject; relatedRecordId?: string; startDate?: string; startTime?: string; endDate?: string; endTime?: string }
  | { type: "quickText" }
  | { type: "knowledge" }
  | { type: "listEmail" }
  | { type: "listAction"; action: string; object: CrmObject; records: RecordData[]; selectedIds: string[] }
  | { type: "quickTextFolder" }
  | { type: "marketingActivation" }
  | { type: "store" }
  | { type: "reportBuilder"; reportType?: string }
  | { type: "navEdit"; app: AppKey }
  | { type: "confirm"; title: string; body: string; onConfirm: () => void };

type ToastState = {
  tone: "success" | "error" | "warning";
  message: string;
} | null;

type ConsoleTab = {
  href: string;
  label: string;
};

type BootstrapDataUpdater = (updater: (previous: BootstrapData) => BootstrapData) => void;
type SaveRecordHandler = (object: CrmObject, values: RecordData, options?: { id?: string; stayOpen?: boolean }) => Promise<boolean>;

type KanbanConfig = {
  field: string;
  label: string;
  values: string[];
  summaryField?: string;
};

type ListSortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

type TimelineActivity = RecordData & {
  kind: "Email" | "Call" | "Task" | "Event";
  date: unknown;
};

type RelatedListObject = CrmObject | "Partner";

type RecordPageDialog =
  | { type: "hierarchy" }
  | { type: "relatedList"; title: string; object: RelatedListObject; records: RecordData[]; fields: string[] }
  | { type: "partner" }
  | { type: "mergeDuplicate"; duplicate: RecordData };

type SearchResult = {
  id: string;
  label: string;
  context: string;
  href: string;
  category: "Record" | "List View" | "Report" | "Suggested Search" | "Recent";
  description?: string;
  query?: string;
};

type ReportMetric = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};

type ReportRow = {
  label: string;
  count: number;
  amount?: number;
  secondary?: string;
  href?: string;
};

type AnalyticsReportDefinition = {
  id: string;
  title: string;
  objectLabel: string;
  description: string;
  rowHeader: string;
  valueHeader: string;
  valueKind: "count" | "currency";
  emptyMessage: string;
  metrics: ReportMetric[];
  rows: ReportRow[];
  href: string;
};

type ReportBuilderType = "Accounts" | "Contacts" | "Leads" | "Cases" | "Opportunities";

type ReportBuilderConfig = {
  object: CrmObject;
  defaultGroup: string;
  groupOptions: Array<{ field: string; label: string }>;
  columns: string[];
  amountField?: string;
};

type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  category: string;
  href: string;
  tags: string[];
};

type SetupShortcut = {
  id: string;
  title: string;
  summary: string;
  category: string;
  href: string;
  tags: string[];
};

type AgentforceMessageMetadata = {
  kind?: string;
  actions?: Array<{ label: string; href: string }>;
  facts?: Array<{ label: string; value: string }>;
  draft?: {
    subject?: string;
    body?: string;
    to?: string;
  };
};

type SearchParamsLike = {
  get(name: string): string | null;
  toString(): string;
};

type UtilityKind = "agentforce" | "guidance" | "help" | "settings" | "notifications" | "profile";

type ScreenState =
  | { kind: "home"; activeApp: AppKey }
  | { kind: "list"; activeApp: AppKey; object: CrmObject }
  | { kind: "calendar"; activeApp: AppKey }
  | { kind: "quickText"; activeApp: AppKey }
  | { kind: "record"; activeApp: AppKey; object: "Account" | "Contact"; id: string }
  | { kind: "marketing"; activeApp: AppKey }
  | { kind: "commerce"; activeApp: AppKey }
  | { kind: "account"; activeApp: AppKey }
  | { kind: "analytics"; activeApp: AppKey };

const objectList = Object.keys(OBJECT_DEFINITIONS) as CrmObject[];

const iconMap: Record<string, ElementType> = {
  user: User,
  building: Building2,
  target: Target,
  "badge-dollar-sign": BadgeDollarSign,
  box: Box,
  "book-open": BookOpen,
  calendar: CalendarDays,
  "circle-help": CircleHelp,
  "message-square-text": MessageSquareText,
  "messages-square": MessagesSquare,
  library: Library,
  mail: Mail,
  receipt: Receipt,
  video: Video
};

const appRail: Array<{ key: AppKey; label: string; href: string; icon: ElementType }> = [
  { key: "home", label: "Home", href: "/lightning/page/home", icon: Home },
  { key: "contacts", label: "Contacts", href: "/lightning/app/contacts", icon: User },
  { key: "accounts", label: "Accounts", href: "/lightning/app/accounts", icon: Building2 },
  { key: "sales", label: "Sales", href: "/lightning/app/sales", icon: Target },
  { key: "service", label: "Service", href: "/lightning/app/service", icon: CircleHelp },
  { key: "marketing", label: "Marketing", href: "/lightning/app/marketing", icon: Megaphone },
  { key: "commerce", label: "Commerce", href: "/lightning/app/commerce", icon: ShoppingBag },
  { key: "your-account", label: "Your Account", href: "/lightning/app/your-account", icon: Receipt }
];

const notificationCategories = ["Records", "Workflow", "Marketing", "Activity", "Files", "Email"] as const;

const helpArticleCatalog: HelpArticle[] = [
  {
    id: "help-create-records",
    title: "Create records and list views",
    summary: "Create, edit, import, pin, and personalize Salesforce-style object lists.",
    category: "Records",
    href: "/lightning/o/Lead/list?filterName=AllOpenLeads",
    tags: ["records", "leads", "list views", "import"]
  },
  {
    id: "help-customize-navigation",
    title: "Customize navigation items",
    summary: "Reorder app tabs, remove unused destinations, and restore the default app navigation.",
    category: "Navigation",
    href: "/lightning/page/home",
    tags: ["navigation", "tabs", "apps"]
  },
  {
    id: "help-list-email",
    title: "Use list email layouts",
    summary: "Create list email drafts, choose layouts, schedule or send messages, and track notifications.",
    category: "Email",
    href: "/lightning/o/ListEmail/list",
    tags: ["email", "marketing", "layouts", "send"]
  },
  {
    id: "help-track-cases",
    title: "Track support with cases",
    summary: "Use case list views, merge cases, change owners, close work, and notify contacts.",
    category: "Service",
    href: "/lightning/o/Case/list?filterName=AllOpenCases",
    tags: ["cases", "support", "merge", "notifications"]
  },
  {
    id: "help-reports-dashboards",
    title: "Build reports and dashboards",
    summary: "Open live Analytics reports, build grouped previews, and assemble dashboard components.",
    category: "Analytics",
    href: "/lightning/page/analytics?report=Pipeline%20by%20Stage",
    tags: ["reports", "dashboards", "analytics", "charts"]
  },
  {
    id: "help-guidance-settings",
    title: "Manage guidance and quick settings",
    summary: "Snooze guidance, adjust density, toggle console tabs, and save locale preferences.",
    category: "Settings",
    href: "/lightning/page/home",
    tags: ["settings", "guidance", "density", "locale"]
  }
];

const setupShortcutCatalog: SetupShortcut[] = [
  {
    id: "setup-home",
    title: "Setup Home",
    summary: "Return to the CRM home dashboard and onboarding setup cards.",
    category: "Setup",
    href: "/lightning/page/home",
    tags: ["setup", "home", "dashboard"]
  },
  {
    id: "setup-object-manager-leads",
    title: "Object Manager: Leads",
    summary: "Open lead list configuration, fields, filters, and prospecting setup.",
    category: "Object Manager",
    href: "/lightning/o/Lead/list?filterName=AllOpenLeads",
    tags: ["object", "lead", "fields", "list"]
  },
  {
    id: "setup-object-manager-cases",
    title: "Object Manager: Cases",
    summary: "Open case configuration for support lists, owners, priorities, and merge workflows.",
    category: "Object Manager",
    href: "/lightning/o/Case/list?filterName=AllOpenCases",
    tags: ["object", "case", "support", "priority"]
  },
  {
    id: "setup-analytics",
    title: "Reports & Dashboards",
    summary: "Open Analytics to inspect computed reports and dashboard builder output.",
    category: "Analytics",
    href: "/lightning/page/analytics?report=Pipeline%20by%20Stage",
    tags: ["reports", "dashboard", "analytics"]
  },
  {
    id: "setup-calendar",
    title: "Calendar Settings",
    summary: "Open the calendar workspace to review visible calendars and scheduling preferences.",
    category: "Productivity",
    href: "/lightning/o/Event/home",
    tags: ["calendar", "events", "schedule"]
  },
  {
    id: "setup-email",
    title: "List Email Setup",
    summary: "Open list email tools for layouts, recipients, drafts, schedules, and delivery status.",
    category: "Email",
    href: "/lightning/o/ListEmail/list",
    tags: ["email", "marketing", "list email"]
  },
  {
    id: "setup-guidance",
    title: "Guidance Center",
    summary: "Manage onboarding cards, snoozed guidance, and dismissed recommendations.",
    category: "Guidance",
    href: "/lightning/page/home",
    tags: ["guidance", "onboarding", "help"]
  },
  {
    id: "setup-profile",
    title: "User Profile",
    summary: "Edit profile identity, avatar, locale, timezone, and console preferences.",
    category: "User",
    href: "/lightning/app/your-account",
    tags: ["profile", "user", "locale", "timezone"]
  }
];

const homeReportCards = [
  { objectLabel: "Leads", reportTitle: "Leads by Status" },
  { objectLabel: "Opportunities", reportTitle: "Pipeline by Stage" },
  { objectLabel: "Contacts", reportTitle: "Contacts by Account" },
  { objectLabel: "Cases", reportTitle: "Open Cases for Accounts I Own" }
] as const;

const reportSearchCatalog = [
  { title: "Open Cases for Accounts I Own", context: "Report - Cases", description: "Support workload by account ownership" },
  { title: "My Closed Cases by Close Date", context: "Report - Cases", description: "Closed support volume over time" },
  { title: "My Cases Closed MTD", context: "Report - Cases", description: "Month-to-date case closures" },
  { title: "Pipeline by Stage", context: "Report - Opportunities", description: "Opportunity amount grouped by stage" },
  { title: "Leads by Status", context: "Report - Leads", description: "Lead counts grouped by status" },
  { title: "Contacts by Account", context: "Report - Contacts", description: "Contact coverage grouped by account" },
  { title: "Accounts by Type", context: "Report - Accounts", description: "Account mix grouped by type" }
] as const;

const reportBuilderTypes: ReportBuilderType[] = ["Accounts", "Contacts", "Leads", "Cases", "Opportunities"];

const reportBuilderConfigs: Record<ReportBuilderType, ReportBuilderConfig> = {
  Accounts: {
    object: "Account",
    defaultGroup: "type",
    groupOptions: [
      { field: "type", label: "Account Type" },
      { field: "ownerAlias", label: "Owner Alias" },
      { field: "billingState", label: "Billing State" }
    ],
    columns: ["name", "type", "phone", "ownerAlias", "createdAt"]
  },
  Contacts: {
    object: "Contact",
    defaultGroup: "accountName",
    groupOptions: [
      { field: "accountName", label: "Account Name" },
      { field: "ownerAlias", label: "Owner Alias" },
      { field: "title", label: "Title" }
    ],
    columns: ["displayName", "accountName", "title", "phone", "email"]
  },
  Leads: {
    object: "Lead",
    defaultGroup: "status",
    groupOptions: [
      { field: "status", label: "Lead Status" },
      { field: "rating", label: "Rating" },
      { field: "leadSource", label: "Lead Source" },
      { field: "ownerAlias", label: "Owner Alias" }
    ],
    columns: ["displayName", "company", "status", "rating", "email"]
  },
  Cases: {
    object: "Case",
    defaultGroup: "status",
    groupOptions: [
      { field: "status", label: "Status" },
      { field: "priority", label: "Priority" },
      { field: "accountName", label: "Account Name" },
      { field: "ownerAlias", label: "Owner Alias" }
    ],
    columns: ["caseNumber", "subject", "status", "priority", "openedAt"]
  },
  Opportunities: {
    object: "Opportunity",
    defaultGroup: "stage",
    groupOptions: [
      { field: "stage", label: "Stage" },
      { field: "accountName", label: "Account Name" },
      { field: "ownerAlias", label: "Owner Alias" },
      { field: "forecastCategory", label: "Forecast Category" }
    ],
    columns: ["name", "accountName", "closeDate", "stage", "amount"],
    amountField: "amount"
  }
};

export function CrmApp({ initialData }: { initialData: BootstrapData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<BootstrapData>(() => decorateBootstrap(initialData));
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [consoleTabs, setConsoleTabs] = useState<ConsoleTab[]>([]);
  const [recordLabels, setRecordLabels] = useState<Record<string, string[]>>(() => labelsFromData(initialData.recordLabels));
  const [campaignMembers, setCampaignMembers] = useState<Record<string, string[]>>(() => campaignMembersFromData(initialData.campaignMembers, initialData.campaigns));

  const screen = useMemo(() => parseScreen(pathname, searchParams), [pathname, searchParams]);
  const activePreferences = data.userPreferences[0] ?? { displayDensity: "Comfy", guidanceEnabled: true, consoleTabsEnabled: true };
  const compactDensity = activePreferences.displayDensity === "Compact";
  const showConsoleTabs = activePreferences.consoleTabsEnabled !== false;

  useEffect(() => {
    const tab = screenToTab(screen, pathname, searchParams);
    setConsoleTabs((tabs) => {
      if (tabs.some((item) => item.href === tab.href)) return tabs;
      return [...tabs.slice(-7), tab];
    });
  }, [pathname, screen, searchParams]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] !== "lightning") return;
    if (segments[1] === "o" && isCrmObject(segments[2]) && segments[3] === "new") {
      openCreate(segments[2]);
    }
    if (segments[1] === "r" && isCrmObject(segments[2]) && segments[4] === "edit") {
      const record = getRecords(segments[2]).find((item) => item.id === segments[3]);
      if (record) setModal({ type: "record", mode: "edit", object: segments[2], record });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function showToast(next: ToastState) {
    setToast(next);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  function getRecords(object: CrmObject) {
    return data[dataKeyForObject(object)] as RecordData[];
  }

  function openCreate(object: CrmObject) {
    if (object === "Product2") setModal({ type: "product" });
    else if (object === "Event") setModal({ type: "event" });
    else if (object === "QuickText") setModal({ type: "quickText" });
    else if (object === "Knowledge__kav") setModal({ type: "knowledge" });
    else if (object === "ListEmail") setModal({ type: "listEmail" });
    else setModal({ type: "record", mode: "new", object });
  }

  function closeModal() {
    setModal(null);
    if (pathname.endsWith("/new")) {
      router.push(defaultRouteForObject(screen.kind === "list" ? screen.object : "Lead"));
    }
    if (pathname.endsWith("/edit")) {
      router.push(pathname.replace("/edit", "/view"));
    }
  }

  async function createAppNotification(values: { title: string; body: string; href?: string | null; category: string }) {
    const response = await postUtility("createNotification", undefined, values);
    if (Array.isArray(response?.notifications)) {
      setData((previous) => ({ ...previous, notifications: response.notifications as RecordData[] }));
      return null;
    }
    const notification = response?.notification as RecordData | undefined;
    if (!notification?.id) return null;
    setData((previous) => ({
      ...previous,
      notifications: [notification, ...previous.notifications.filter((item) => item.id !== notification.id)]
    }));
    return notification;
  }

  async function saveRecord(object: CrmObject, values: RecordData, options: { id?: string; stayOpen?: boolean } = {}) {
    const key = dataKeyForObject(object);
    const method = options.id ? "PATCH" : "POST";
    const url = options.id ? `/api/records/${object}/${options.id}` : `/api/records/${object}`;
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast({ tone: "error", message: json.error ?? "The record couldn't be saved." });
      return false;
    }

    const record = enrichLocalRecord(object, { ...values, ...(json.record ?? {}), id: options.id ?? json.record?.id });
    setData((previous) => {
      const records = previous[key] as RecordData[];
      const nextRecords = options.id
        ? records.map((item) => (item.id === options.id ? { ...item, ...record } : item))
        : [record, ...records];
      const nextData = { ...previous, [key]: nextRecords } as BootstrapData;

      if (object === "Product2") {
        const priceBook = json.record?.priceBook as RecordData | null | undefined;
        const priceBookEntry = json.record?.priceBookEntry as RecordData | null | undefined;

        if (priceBook?.id) {
          nextData.priceBooks = previous.priceBooks.some((item) => item.id === priceBook.id)
            ? previous.priceBooks.map((item) => (item.id === priceBook.id ? { ...item, ...priceBook } : item))
            : [priceBook, ...previous.priceBooks];
        }

        if (priceBookEntry?.id) {
          nextData.priceBookEntries = previous.priceBookEntries.some((item) => item.id === priceBookEntry.id)
            ? previous.priceBookEntries.map((item) => (item.id === priceBookEntry.id ? { ...item, ...priceBookEntry } : item))
            : [priceBookEntry, ...previous.priceBookEntries];
        }
      }

      return decorateBootstrap(nextData);
    });

    void createAppNotification(notificationForSavedRecord(object, record, Boolean(options.id), values));
    showToast({ tone: "success", message: `${OBJECT_DEFINITIONS[object].label} saved.` });
    if (!options.stayOpen) closeModal();
    return true;
  }

  async function deleteRecord(object: CrmObject, id: string) {
    const response = await fetch(`/api/records/${object}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      showToast({ tone: "error", message: "The record couldn't be deleted." });
      return;
    }

    const key = dataKeyForObject(object);
    setData((previous) =>
      decorateBootstrap({
        ...previous,
        [key]: (previous[key] as RecordData[]).filter((record) => record.id !== id)
      } as BootstrapData)
    );
    void createAppNotification({
      title: `${OBJECT_DEFINITIONS[object].label} deleted`,
      body: `${OBJECT_DEFINITIONS[object].label} ${id} was removed from the workspace.`,
      category: "Records"
    });
    showToast({ tone: "success", message: `${OBJECT_DEFINITIONS[object].label} deleted.` });
    router.push(defaultRouteForObject(object));
  }

  async function saveActivity(activity: RecordData) {
    const response = await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activity)
    });
    const json = await response.json().catch(() => ({}));
    const record = json.record ?? { ...activity, id: `${activity.type}-${Date.now()}` };
    setData((previous) => {
      const key = activity.type === "email" ? "emailActivities" : activity.type === "call" ? "callActivities" : "tasks";
      return {
        ...previous,
        [key]: [record, ...(previous[key] as RecordData[])]
      } as BootstrapData;
    });
    void createAppNotification({
      title: activity.type === "email" ? "Email activity logged" : activity.type === "call" ? "Call logged" : "Task created",
      body: String(activity.subject ?? activity.notes ?? "Activity was added to the timeline."),
      href: activity.relatedObjectType && activity.relatedRecordId ? routeForRecord(String(activity.relatedObjectType) as CrmObject, String(activity.relatedRecordId)) : undefined,
      category: "Activity"
    });
    showToast({ tone: "success", message: activity.type === "email" ? "Email activity logged." : activity.type === "call" ? "Call logged." : "Task created." });
  }

  async function saveFile(file: RecordData, attachment = false) {
    const response = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...file, attachment })
    });
    const json = await response.json().catch(() => ({}));
    const record = json.record ?? { ...file, id: `file-${Date.now()}`, uploadedAt: new Date().toISOString() };
    setData((previous) => ({
      ...previous,
      [attachment ? "attachments" : "files"]: [record, ...(previous[attachment ? "attachments" : "files"] as RecordData[])]
    }));
    void createAppNotification({
      title: attachment ? "Attachment uploaded" : "File uploaded",
      body: String(record.name ?? "A file was added to the workspace."),
      href: file.relatedObjectType && file.relatedRecordId ? routeForRecord(String(file.relatedObjectType) as CrmObject, String(file.relatedRecordId)) : undefined,
      category: "Files"
    });
    showToast({ tone: "success", message: attachment ? "Attachment uploaded." : "File uploaded." });
  }

  return (
    <div className={cn("flex h-screen overflow-hidden bg-canvas text-[#181818]", compactDensity && "text-[13px]")}>
      <LeftAppRail activeApp={screen.activeApp} />
      <div className="flex min-w-0 flex-1 flex-col">
        <GlobalHeader
          data={data}
          onNavigate={(href) => router.push(href)}
          onDataChange={(updater) => setData((previous) => decorateBootstrap(updater(previous)))}
          onToast={showToast}
        />
        <AppNavBar data={data} activeApp={screen.activeApp} pathname={pathname} onEditNav={() => setModal({ type: "navEdit", app: screen.activeApp })} />
        {showConsoleTabs && <ConsoleTabs tabs={consoleTabs} activeHref={pathnameWithSearch(pathname, searchParams)} onClose={(href) => setConsoleTabs((tabs) => tabs.filter((tab) => tab.href !== href))} />}
        <main className="slds-scrollbar min-h-0 flex-1 overflow-auto p-3">
          <div key={pathname} className="crm-screen-enter">
          <ScreenRenderer
            screen={screen}
            data={data}
            getRecords={getRecords}
            onCreate={openCreate}
            onEdit={(object, record) => setModal({ type: "record", mode: "edit", object, record })}
            onDelete={(object, record) =>
              setModal({
                type: "confirm",
                title: `Delete ${recordTitle(object, record)}?`,
                body: "This action can't be undone.",
                onConfirm: () => {
                  setModal(null);
                  void deleteRecord(object, requiredId(record));
                }
              })
            }
            onSaveActivity={saveActivity}
            onSaveFile={saveFile}
            onOpenEvent={(relatedObjectType, relatedRecordId, startDate, startTime, endTime) => setModal({ type: "event", relatedObjectType, relatedRecordId, startDate, startTime, endDate: startDate, endTime })}
            onToast={showToast}
            recordLabels={recordLabels}
            campaignMembers={campaignMembers}
            onListAction={(action, object, records, selectedIds) => setModal({ type: "listAction", action, object, records, selectedIds })}
            onQuickTextFolder={() => setModal({ type: "quickTextFolder" })}
            onMarketingActivation={() => setModal({ type: "marketingActivation" })}
            onCreateStore={() => setModal({ type: "store" })}
            onReportBuilder={(reportType) => setModal({ type: "reportBuilder", reportType })}
            onSaveRecord={saveRecord}
            onDataChange={(updater) => setData((previous) => decorateBootstrap(updater(previous)))}
            listSearchQuery={searchParams.get("search") ?? ""}
            analyticsReportName={searchParams.get("report") ?? ""}
          />
          </div>
        </main>
      </div>
      <ModalHost
        modal={modal}
        data={data}
        recordLabels={recordLabels}
        campaignMembers={campaignMembers}
        onClose={closeModal}
        onSaveRecord={saveRecord}
        onSaveAppNav={saveAppNavPreference}
        onResetAppNav={resetAppNavPreference}
        onDataChange={(updater) => setData((previous) => decorateBootstrap(updater(previous)))}
        onToast={showToast}
        onApplyListAction={(action, object, selectedIds, payload) => {
          applyListAction(action, object, selectedIds, payload);
        }}
      />
      <ToastHost toast={toast} />
    </div>
  );

  async function applyListAction(action: string, object: CrmObject, selectedIds: string[], payload: RecordData) {
    const key = dataKeyForObject(object);
    const targetIds = selectedIds;
    const workflowResult = await persistWorkflow(action, object, targetIds, payload);
    if (!workflowResult) return;

    if (action === "Assign Label") {
      const label = String(payload.label ?? "Important");
      const labels = Array.isArray(workflowResult.labels)
        ? (workflowResult.labels as RecordData[])
        : targetIds.map((recordId) => ({ id: `label-${recordId}-${label}`, objectType: object, recordId, label }));
      setRecordLabels((current) => {
        const next = { ...current };
        targetIds.forEach((id) => {
          next[id] = Array.from(new Set([...(next[id] ?? []), label]));
        });
        return next;
      });
      setData((previous) => ({
        ...previous,
        recordLabels: [...labels, ...previous.recordLabels]
      }));
      void createAppNotification({
        title: "Label assigned",
        body: `Label "${label}" was assigned to ${targetIds.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()}.`,
        href: defaultRouteForObject(object),
        category: "Workflow"
      });
      showToast({ tone: "success", message: `Label "${label}" assigned to ${targetIds.length} record${targetIds.length === 1 ? "" : "s"}.` });
      closeModal();
      return;
    }

    if (action === "Add to Campaign") {
      const campaign = String(payload.campaign ?? "Starter Outreach");
      const campaignRecord = isRecordData(workflowResult.campaign) ? workflowResult.campaign : null;
      const memberRecords = Array.isArray(workflowResult.campaignMembers) ? (workflowResult.campaignMembers as RecordData[]) : [];
      setCampaignMembers((current) => {
        const next = { ...current };
        targetIds.forEach((id) => {
          next[id] = Array.from(new Set([...(next[id] ?? []), campaign]));
        });
        return next;
      });
      setData((previous) => ({
        ...previous,
        campaigns: campaignRecord ? [campaignRecord, ...previous.campaigns.filter((item) => item.id !== campaignRecord.id)] : previous.campaigns,
        campaignMembers: [...memberRecords, ...previous.campaignMembers]
      }));
      void createAppNotification({
        title: "Campaign members added",
        body: `${targetIds.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()} added to ${campaign}.`,
        href: defaultRouteForObject(object),
        category: "Marketing"
      });
      showToast({ tone: "success", message: `${targetIds.length} record${targetIds.length === 1 ? "" : "s"} added to ${campaign}.` });
      closeModal();
      return;
    }

    if (action === "Convert Lead" && object === "Lead") {
      const selectedLeads = data.leads.filter((lead) => targetIds.includes(requiredId(lead)));
      if (selectedLeads.length === 0) {
        showToast({ tone: "warning", message: "Select at least one lead to convert." });
        closeModal();
        return;
      }
      const conversion = leadConversionResultFromWorkflow(workflowResult, selectedLeads, data, payload);
      setData((previous) =>
        decorateBootstrap({
          ...previous,
          accounts: upsertRecordsById(previous.accounts, conversion.accounts),
          contacts: upsertRecordsById(previous.contacts, conversion.contacts),
          opportunities: upsertRecordsById(previous.opportunities, conversion.opportunities),
          leads: upsertRecordsById(previous.leads, conversion.leads)
        })
      );
      void createAppNotification({
        title: "Lead converted",
        body: `${selectedLeads.length} lead${selectedLeads.length === 1 ? "" : "s"} converted to account and contact records.`,
        href: defaultRouteForObject("Lead"),
        category: "Workflow"
      });
      showToast({ tone: "success", message: `${selectedLeads.length} lead${selectedLeads.length === 1 ? "" : "s"} converted.` });
      closeModal();
      return;
    }

    if (action === "Change Owner") {
      const ownerName = String(payload.ownerName ?? data.user.name).trim() || data.user.name;
      const updatedRecords = Array.isArray(workflowResult.records) ? (workflowResult.records as RecordData[]) : [];
      setData((previous) =>
        decorateBootstrap({
          ...previous,
          [key]: (previous[key] as RecordData[]).map((record) => {
            const updatedRecord = updatedRecords.find((item) => item.id === record.id);
            if (updatedRecord) return { ...record, ...updatedRecord };
            if (!targetIds.includes(requiredId(record))) return record;
            return {
              ...record,
              ownerId: ownerName,
              updatedById: data.user.id,
              updatedAt: new Date().toISOString()
            };
          })
        } as BootstrapData)
      );
      void createAppNotification({
        title: "Owner changed",
        body: `${targetIds.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()} reassigned to ${ownerName}.`,
        href: defaultRouteForObject(object),
        category: "Workflow"
      });
      showToast({ tone: "success", message: `Owner changed for ${targetIds.length} record${targetIds.length === 1 ? "" : "s"}.` });
      closeModal();
      return;
    }

    if (action === "New Folder") {
      const folder = isRecordData(workflowResult.folder) ? workflowResult.folder : { id: `folder-${Date.now()}`, name: payload.name ?? "New Folder", ownerId: data.user.id, sharing: payload.sharing ?? "Private" };
      const folderName = String(folder.name);
      setData((previous) => ({
        ...previous,
        quickTextFolders: [
          folder,
          ...previous.quickTextFolders
        ]
      }));
      void createAppNotification({
        title: "Quick Text folder created",
        body: `Folder "${folderName}" is available for quick text content.`,
        href: "/lightning/o/QuickText/home",
        category: "Records"
      });
      showToast({ tone: "success", message: `Quick Text folder "${folderName}" created.` });
      closeModal();
      return;
    }

    if (action === "Create Store") {
      const store = isRecordData(workflowResult.store) ? workflowResult.store : { id: `store-${Date.now()}`, name: payload.name ?? "Starter Store", status: "Draft", createdAt: new Date().toISOString() };
      const storeName = String(store.name);
      setData((previous) => ({
        ...previous,
        stores: [store, ...previous.stores]
      }));
      void createAppNotification({
        title: "Store draft created",
        body: `Store "${storeName}" is ready for commerce setup.`,
        href: "/lightning/app/commerce",
        category: "Marketing"
      });
      showToast({ tone: "success", message: `Store "${storeName}" created as a draft.` });
      closeModal();
      return;
    }

    if (action === "Activate Marketing") {
      setData((previous) => ({
        ...previous,
        marketingActivations: isRecordData(workflowResult.activation) ? [workflowResult.activation, ...previous.marketingActivations] : previous.marketingActivations
      }));
      void createAppNotification({
        title: "Marketing activated",
        body: "Marketing tools are active for this workspace.",
        href: "/lightning/app/marketing",
        category: "Marketing"
      });
      showToast({ tone: "success", message: "Marketing tools activated for this workspace." });
      closeModal();
      return;
    }

    if (["Publish", "Assign", "Archive", "Delete Article", "Delete Draft", "Restore"].includes(action)) {
      setData((previous) => {
        if (action === "Delete Article" || action === "Delete Draft") {
          return {
            ...previous,
            knowledgeArticles: previous.knowledgeArticles.filter((article) => {
              if (!targetIds.includes(requiredId(article))) return true;
              if (action === "Delete Draft") return String(article.publicationStatus ?? "Draft") !== "Draft";
              return false;
            })
          };
        }
        return {
          ...previous,
          knowledgeArticles: previous.knowledgeArticles.map((article) => {
            if (!targetIds.includes(requiredId(article))) return article;
            if (action === "Publish") return { ...article, publicationStatus: "Published", validationStatus: "Validated", publishedAt: new Date().toISOString() };
            if (action === "Archive") return { ...article, publicationStatus: "Archived", archivedAt: new Date().toISOString(), archivedById: data.user.id };
            if (action === "Assign") return { ...article, updatedById: payload.assignee ?? data.user.id };
            if (action === "Restore") return { ...article, publicationStatus: "Draft", validationStatus: "Not Validated", archivedAt: null, archivedById: null };
            return article;
          })
        };
      });
      void createAppNotification({
        title: `Knowledge ${action.toLowerCase()}`,
        body: `${action} completed for ${targetIds.length || data.knowledgeArticles.length} knowledge article${(targetIds.length || data.knowledgeArticles.length) === 1 ? "" : "s"}.`,
        href: "/lightning/o/Knowledge__kav/list",
        category: "Workflow"
      });
      showToast({ tone: "success", message: `${action} completed for ${targetIds.length || data.knowledgeArticles.length} article${(targetIds.length || data.knowledgeArticles.length) === 1 ? "" : "s"}.` });
      closeModal();
      return;
    }

    if (action === "Merge Cases") {
      const primaryCase = String(payload.primaryCase ?? "");
      setData((previous) => ({
        ...previous,
        cases: previous.cases.map((caseRecord) => {
          const isSelected = targetIds.includes(requiredId(caseRecord));
          if (!isSelected) return caseRecord;
          if (caseRecord.caseNumber === primaryCase || requiredId(caseRecord) === primaryCase) return { ...caseRecord, subject: `${caseRecord.subject ?? "Merged Case"} (merged)` };
          return { ...caseRecord, status: "Closed", closedAt: new Date().toISOString(), subject: `Merged into ${primaryCase || "primary case"}` };
        })
      }));
      void createAppNotification({
        title: "Cases merged",
        body: `${targetIds.length} cases were merged into ${primaryCase || "the selected primary case"}.`,
        href: "/lightning/o/Case/list?filterName=AllOpenCases",
        category: "Workflow"
      });
      showToast({ tone: "success", message: "Cases merged." });
      closeModal();
      return;
    }

    showToast({ tone: "success", message: `${action} completed.` });
    closeModal();
  }

  async function persistWorkflow(action: string, object: CrmObject, selectedIds: string[], payload: RecordData) {
    const response = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, object, selectedIds, values: payload })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast({ tone: "error", message: json.error ?? `${action} couldn't be completed.` });
      return null;
    }
    return json as RecordData;
  }

  async function saveAppNavPreference(app: AppKey, items: AppNavItem[]) {
    const response = await postUtility("updateAppNavPreference", undefined, { app, items: items.map(cleanNavItem) });
    const preference = response?.appNavPreference as RecordData | undefined;
    if (!preference?.id) {
      showToast({ tone: "error", message: "Navigation items couldn't be saved." });
      return false;
    }
    setData((previous) => ({
      ...previous,
      appNavPreferences: [preference, ...previous.appNavPreferences.filter((item) => item.id !== preference.id && item.app !== app)]
    }));
    showToast({ tone: "success", message: "Navigation items saved." });
    closeModal();
    return true;
  }

  async function resetAppNavPreference(app: AppKey) {
    const response = await postUtility("resetAppNavPreference", undefined, { app });
    if (!response?.ok) {
      showToast({ tone: "error", message: "Navigation items couldn't be reset." });
      return false;
    }
    setData((previous) => ({
      ...previous,
      appNavPreferences: previous.appNavPreferences.filter((item) => item.app !== app)
    }));
    showToast({ tone: "success", message: "Navigation items reset." });
    closeModal();
    return true;
  }
}

function ScreenRenderer({
  screen,
  data,
  getRecords,
  onCreate,
  onEdit,
  onDelete,
  onSaveActivity,
  onSaveFile,
  onOpenEvent,
  onToast,
  recordLabels,
  campaignMembers,
  onListAction,
  onQuickTextFolder,
  onMarketingActivation,
  onCreateStore,
  onReportBuilder,
  onSaveRecord,
  onDataChange,
  listSearchQuery,
  analyticsReportName
}: {
  screen: ScreenState;
  data: BootstrapData;
  getRecords: (object: CrmObject) => RecordData[];
  onCreate: (object: CrmObject) => void;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onSaveActivity: (activity: RecordData) => Promise<void>;
  onSaveFile: (file: RecordData, attachment?: boolean) => Promise<void>;
  onOpenEvent: (object: CrmObject, id: string, startDate?: string, startTime?: string, endTime?: string) => void;
  onToast: (toast: ToastState) => void;
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  onListAction: (action: string, object: CrmObject, records: RecordData[], selectedIds: string[]) => void;
  onQuickTextFolder: () => void;
  onMarketingActivation: () => void;
  onCreateStore: () => void;
  onReportBuilder: (reportType?: string) => void;
  onSaveRecord: SaveRecordHandler;
  onDataChange: BootstrapDataUpdater;
  listSearchQuery: string;
  analyticsReportName: string;
}) {
  if (screen.kind === "home") return <HomePage data={data} onReportBuilder={onReportBuilder} onDataChange={onDataChange} onToast={onToast} />;
  if (screen.kind === "marketing") return <MarketingPage data={data} onCreate={onCreate} onActivate={onMarketingActivation} />;
  if (screen.kind === "commerce") return <CommercePage stores={data.stores} onCreateStore={onCreateStore} />;
  if (screen.kind === "account") return <YourAccountPage user={data.user} />;
  if (screen.kind === "analytics") return <AnalyticsPage data={data} reportName={analyticsReportName} onReportBuilder={onReportBuilder} onToast={onToast} />;
  if (screen.kind === "calendar") return <CalendarPage data={data} events={data.events} onCreate={(startDate, startTime, endTime) => onOpenEvent("Event", "", startDate, startTime, endTime)} onDataChange={onDataChange} onToast={onToast} />;
  if (screen.kind === "quickText") return <QuickTextPage data={data} onCreate={() => onCreate("QuickText")} onCreateFolder={onQuickTextFolder} onDelete={(record) => onDelete("QuickText", record)} />;
  if (screen.kind === "record") {
    const record = getRecords(screen.object).find((item) => item.id === screen.id);
    if (!record) return <NotFoundPanel title="Record not found" body="The requested record could not be found." />;
    return (
      <RecordPage
        object={screen.object}
        record={record}
        data={data}
        onCreate={onCreate}
        onEdit={() => onEdit(screen.object, record)}
        onDelete={() => onDelete(screen.object, record)}
        onChangeOwner={() => onListAction("Change Owner", screen.object, [record], [requiredId(record)])}
        onRecordEdit={onEdit}
        onRecordDelete={onDelete}
        onSaveActivity={onSaveActivity}
        onSaveFile={onSaveFile}
        onOpenEvent={() => onOpenEvent(screen.object, requiredId(record))}
        onDataChange={onDataChange}
        onToast={onToast}
        labels={recordLabels[requiredId(record)] ?? []}
        campaigns={campaignMembers[requiredId(record)] ?? []}
      />
    );
  }

  return <ListViewPage object={screen.object} data={data} records={getRecords(screen.object)} recordLabels={recordLabels} campaignMembers={campaignMembers} initialQuery={listSearchQuery} onCreate={onCreate} onEdit={onEdit} onDelete={onDelete} onToast={onToast} onListAction={onListAction} onSaveRecord={onSaveRecord} onDataChange={onDataChange} />;
}

function LeftAppRail({ activeApp }: { activeApp: AppKey }) {
  return (
    <aside className="flex w-[80px] shrink-0 flex-col items-center bg-shell py-3 text-white">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded bg-white text-brand-600 shadow-sm">
        <Cloud size={24} fill="currentColor" />
      </div>
      <nav className="flex w-full flex-1 flex-col items-stretch gap-0.5 px-1.5" aria-label="App launcher">
        {appRail.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeApp;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-[12.5px] leading-tight text-[#c9e0f5] outline-none transition-[background-color,color,box-shadow] duration-150",
                "hover:bg-[#1b4f81] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
                "focus-visible:bg-[#1b4f81] focus-visible:text-white focus-visible:shadow-[inset_0_0_0_2px_#ffffff]",
                "active:bg-[#163a5f]",
                active && "bg-[#1b4f81] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]"
              )}
            >
              {active && <span className="absolute left-0.5 top-2 bottom-2 w-0.5 rounded-full bg-white" aria-hidden="true" />}
              <Icon size={22} className={cn("transition-transform duration-150 group-hover:scale-105", active && "scale-105")} />
              <span className="text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function GlobalHeader({ data, onNavigate, onDataChange, onToast }: { data: BootstrapData; onNavigate: (href: string) => void; onDataChange: BootstrapDataUpdater; onToast: (toast: ToastState) => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#d8dde6] bg-white px-3">
      <div className="flex items-center gap-2 font-semibold text-shell">
        <Cloud size={25} fill="#0176d3" className="text-brand-500" />
        <span>Salesforce</span>
      </div>
      <SearchOverlay data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
      <div className="ml-auto flex items-center gap-1">
        <HeaderUtility icon={Sparkles} label="Agentforce" kind="agentforce" data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
        <HeaderUtility icon={Activity} label="Guidance Center" kind="guidance" data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
        <HeaderUtility icon={HelpCircle} label="Salesforce Help" kind="help" data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
        <HeaderUtility icon={Settings} label="Quick Settings" kind="settings" data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
        <HeaderUtility icon={Bell} label="Notifications" kind="notifications" data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
        <HeaderUtility icon={User} label="View profile" kind="profile" data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
      </div>
    </header>
  );
}

function SearchOverlay({
  data,
  onNavigate,
  onDataChange,
  onToast
}: {
  data: BootstrapData;
  onNavigate: (href: string) => void;
  onDataChange: BootstrapDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchIndex = useMemo(() => buildGlobalSearchIndex(data), [data]);
  const recentResults = useMemo(() => recentSearchResults(data.globalSearchRecents), [data.globalSearchRecents]);
  const suggestedResults = useMemo(() => buildSuggestedSearches(data), [data]);
  const results = useMemo(() => {
    if (!query.trim()) return searchIndex.slice(0, 8);
    return searchIndex.filter((item) => searchResultMatches(item, query)).slice(0, 30);
  }, [query, searchIndex]);
  const groupedResults = groupBy(results, (item) => item.category);

  async function openSearchResult(item: SearchResult) {
    if (item.category === "Suggested Search") {
      setQuery(item.query ?? item.label);
      return;
    }

    if (item.category !== "Recent") {
      const response = await postUtility("saveGlobalSearchRecent", undefined, {
        query: query.trim() || item.query || item.label,
        label: item.label,
        context: item.context,
        href: item.href,
        category: item.category
      });
      if (Array.isArray(response?.globalSearchRecents)) {
        onDataChange((previous) => ({ ...previous, globalSearchRecents: response.globalSearchRecents as RecordData[] }));
      }
    }
    setOpen(false);
    onNavigate(item.href);
  }

  async function clearSearchRecents() {
    const response = await postUtility("clearGlobalSearchRecents");
    if (Array.isArray(response?.globalSearchRecents)) {
      onDataChange((previous) => ({ ...previous, globalSearchRecents: [] }));
      onToast({ tone: "success", message: "Recent searches cleared." });
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="mx-auto flex h-8 w-full max-w-xl items-center gap-2 rounded-full border border-[#cfd4dc] bg-[#f2f4f7] px-3.5 text-left text-sm text-[#514f4d] hover:border-[#b5bcc7] hover:bg-white hover:shadow-[0_1px_3px_rgba(16,24,40,0.08)] data-[state=open]:border-brand-500 data-[state=open]:bg-white data-[state=open]:shadow-[0_0_0_3px_rgba(1,118,211,0.14)]" aria-label="Search...">
          <Search size={16} className="text-[#706e6b]" />
          <span>Search...</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="center" className="z-50 w-[680px] rounded border border-[#c9c9c9] bg-white p-3 shadow-popover">
          <div className="flex items-center gap-2 rounded-md border border-brand-500 px-2 shadow-[0_0_0_3px_rgba(1,118,211,0.12)]">
            <Search size={16} className="text-brand-600" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(inputBareClass, "h-9")}
              placeholder="Search records, reports, and list views..."
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) void openSearchResult(results[0]);
              }}
            />
            {query && (
              <button className="rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3]" aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="slds-scrollbar mt-3 max-h-[28rem] overflow-auto">
            {!query.trim() && (
              <>
                {recentResults.length > 0 && (
                  <SearchResultSection title="Recent Searches" actionLabel="Clear" onAction={() => void clearSearchRecents()}>
                    {recentResults.map((item) => (
                      <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                    ))}
                  </SearchResultSection>
                )}
                <SearchResultSection title="Suggested Searches">
                  {suggestedResults.map((item) => (
                    <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                  ))}
                </SearchResultSection>
              </>
            )}
            {query.trim() ? (
              Object.entries(groupedResults).map(([category, items]) => (
                <SearchResultSection key={category} title={category}>
                  {items.map((item) => (
                    <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                  ))}
                </SearchResultSection>
              ))
            ) : (
              <SearchResultSection title="Top Results">
                {results.map((item) => (
                  <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                ))}
              </SearchResultSection>
            )}
            {results.length === 0 && query.trim() && <div className="py-8 text-center text-sm text-[#706e6b]">No results found.</div>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SearchResultSection({ title, actionLabel, onAction, children }: { title: string; actionLabel?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <section className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <div className="text-[11px] font-semibold uppercase text-[#706e6b]">{title}</div>
        {actionLabel && (
          <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}

function SearchResultRow({ item, onOpen }: { item: SearchResult; onOpen: (item: SearchResult) => void | Promise<void> }) {
  return (
    <button onClick={() => void onOpen(item)} className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-brand-50">
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded", searchCategoryClass(item.category))}>
        <Search size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.label}</span>
        <span className="block truncate text-xs text-[#706e6b]">{item.context}</span>
        {item.description && <span className="block truncate text-[11px] text-[#706e6b]">{item.description}</span>}
      </span>
      <span className="shrink-0 rounded bg-[#f3f3f3] px-1.5 py-0.5 text-[11px] text-[#514f4d]">{item.category}</span>
    </button>
  );
}

function searchCategoryClass(category: SearchResult["category"]) {
  switch (category) {
    case "Record":
      return "bg-brand-50 text-brand-700";
    case "List View":
      return "bg-[#e4f6e6] text-[#194f25]";
    case "Report":
      return "bg-[#fef1e8] text-[#8a3b12]";
    case "Recent":
      return "bg-[#f3f3f3] text-[#514f4d]";
    default:
      return "bg-[#eef4ff] text-[#0b5cab]";
  }
}

function buildGlobalSearchIndex(data: BootstrapData): SearchResult[] {
  const recordResults = objectList.flatMap((object) => {
    const definition = OBJECT_DEFINITIONS[object];
    const records = data[definition.dataKey] as RecordData[];
    return records.map((record) => {
      const label = recordTitle(object, record);
      const contextDetail = searchRecordContext(object, record, definition);
      return {
        id: `record-${object}-${requiredId(record)}`,
        label,
        context: contextDetail,
        href: searchRecordHref(object, record, label),
        category: "Record" as const,
        description: searchRecordDescription(object, record, definition)
      };
    });
  });

  return [
    ...recordResults,
    ...buildListViewSearchResults(data),
    ...reportSearchDefinitions(),
    ...customReportSearchResults(data)
  ];
}

function buildListViewSearchResults(data: BootstrapData): SearchResult[] {
  return objectList.flatMap((object) => {
    const definition = OBJECT_DEFINITIONS[object];
    const customViews = data.listViewPreferences.filter((preference) => preference.object === object).map((preference) => String(preference.viewName));
    const views = Array.from(new Set([...definition.listViews, ...customViews]));
    return views.map((viewName) => ({
      id: `list-${object}-${viewName}`,
      label: viewName,
      context: `List View - ${definition.plural}`,
      href: listViewHref(object, viewName),
      category: "List View" as const,
      description: `${definition.label} records`
    }));
  });
}

function reportSearchDefinitions(): SearchResult[] {
  return reportSearchCatalog.map((report) => ({
    id: `report-${reportIdFromTitle(report.title)}`,
    label: report.title,
    context: report.context,
    href: reportHref(report.title),
    category: "Report" as const,
    description: report.description
  }));
}

function customReportSearchResults(data: BootstrapData): SearchResult[] {
  return data.customReports.map((report) => {
    const object = isCrmObject(String(report.object ?? "")) ? String(report.object) as CrmObject : "Lead";
    return {
      id: `custom-report-search-${String(report.id ?? report.name)}`,
      label: String(report.name ?? "Custom Report"),
      context: `${OBJECT_DEFINITIONS[object].plural} Report`,
      href: reportHref(String(report.name ?? "Custom Report")),
      category: "Report" as const,
      description: `Saved custom report grouped by ${reportBuilderFieldLabel(object, String(report.groupField ?? ""))}`
    };
  });
}

function buildSuggestedSearches(data: BootstrapData): SearchResult[] {
  const primaryAccount = data.accounts[0];
  const accountName = String(primaryAccount?.name ?? "Robert");
  return [
    { id: "suggest-robert-accounts", label: `${accountName} accounts`, context: "Suggested Search", href: "", category: "Suggested Search", query: `${accountName} accounts`, description: "Find matching account records" },
    { id: "suggest-customer-accounts", label: "accounts with account type customer", context: "Suggested Search", href: "", category: "Suggested Search", query: "accounts with account type customer", description: "Search account type and list views" },
    { id: "suggest-robert-contacts", label: `${accountName} contacts`, context: "Suggested Search", href: "", category: "Suggested Search", query: `${accountName} contacts`, description: "Find contacts associated with the account" },
    { id: "suggest-open-cases", label: "open cases", context: "Suggested Search", href: "", category: "Suggested Search", query: "open cases", description: "Find support case lists and reports" }
  ];
}

function recentSearchResults(recents: RecordData[]): SearchResult[] {
  return recents.map((item) => ({
    id: `recent-${String(item.id)}`,
    label: String(item.label ?? "Recent search"),
    context: String(item.context ?? "Recent Search"),
    href: String(item.href ?? ""),
    category: "Recent",
    query: item.query ? String(item.query) : undefined,
    description: item.updatedAt ? `Last opened ${formatDateTime(String(item.updatedAt))}` : undefined
  }));
}

function searchResultMatches(item: SearchResult, query: string) {
  const haystack = normalizeSearchText([item.label, item.context, item.description, item.category].filter(Boolean).join(" "));
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token) || haystack.includes(token.replace(/s$/, "")));
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function searchRecordContext(object: CrmObject, record: RecordData, definition: ObjectDefinition) {
  switch (object) {
    case "Contact":
      return `${definition.label} - ${String(record.accountName ?? "Account")}`;
    case "Lead":
      return `${definition.label} - ${String(record.company ?? "Company")}`;
    case "Opportunity":
      return `${definition.label} - ${String(record.accountName ?? "Account")}`;
    case "Case":
      return `${definition.label} - ${String(record.status ?? "Status")}`;
    case "Product2":
      return `${definition.label} - ${String(record.productCode ?? record.family ?? "Product")}`;
    case "ListEmail":
      return `${definition.label} - ${String(record.status ?? "Draft")}`;
    default:
      return definition.label;
  }
}

function searchRecordDescription(object: CrmObject, record: RecordData, definition: ObjectDefinition) {
  const columnSummary = definition.columns
    .filter((column) => column.key !== definition.columns[0]?.key)
    .slice(0, 2)
    .map((column) => formatCell(record[column.key]))
    .filter(Boolean)
    .join(" - ");
  if (columnSummary) return columnSummary;
  if (object === "Event") return [formatCell(record.startAt), formatCell(record.endAt)].filter(Boolean).join(" - ");
  return definition.plural;
}

function searchRecordHref(object: CrmObject, record: RecordData, label: string) {
  if (canRouteToRecord(object)) return routeForRecord(object, requiredId(record));
  return listSearchHref(object, label);
}

function notificationForSavedRecord(object: CrmObject, record: RecordData, isUpdate: boolean, values: RecordData) {
  const title = recordTitle(object, record);
  const href = canRouteToRecord(object) ? routeForRecord(object, requiredId(record)) : listSearchHref(object, title);
  const definition = OBJECT_DEFINITIONS[object];

  if (object === "ListEmail") {
    const status = String(record.status ?? values.status ?? "Draft");
    if (status === "Sent") {
      return {
        title: "List email sent",
        body: `${title} was sent to ${formatCell(record.recipientType) || "selected recipients"}.`,
        href,
        category: "Email"
      };
    }
    if (record.scheduledAt || status === "Scheduled") {
      return {
        title: "List email scheduled",
        body: `${title} is scheduled for ${formatCell(record.scheduledAt) || "delivery"}.`,
        href,
        category: "Email"
      };
    }
    return {
      title: "List email saved",
      body: `${title} was saved as ${status}.`,
      href,
      category: "Email"
    };
  }

  if (object === "Case" && values.status === "Closed") {
    return {
      title: "Case closed",
      body: `${title} was closed and moved out of active support work.`,
      href,
      category: "Workflow"
    };
  }

  if (object === "Case" && values.sendNotificationEmailToContact === true) {
    return {
      title: "Case contact notification queued",
      body: `${title} will notify the related contact.`,
      href,
      category: "Workflow"
    };
  }

  if (object === "Opportunity" && values.stage) {
    return {
      title: "Opportunity stage updated",
      body: `${title} moved to ${String(values.stage)}.`,
      href,
      category: "Workflow"
    };
  }

  if (object === "Lead" && values.status) {
    return {
      title: "Lead status updated",
      body: `${title} moved to ${String(values.status)}.`,
      href,
      category: "Workflow"
    };
  }

  return {
    title: `${definition.label} ${isUpdate ? "updated" : "created"}`,
    body: `${title || definition.label} was ${isUpdate ? "updated" : "created"} in the workspace.`,
    href,
    category: "Records"
  };
}

function listSearchHref(object: CrmObject, query: string) {
  const route = defaultRouteForObject(object);
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}search=${encodeURIComponent(query)}`;
}

function listViewHref(object: CrmObject, viewName: string) {
  const route = defaultRouteForObject(object);
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}filterName=${encodeURIComponent(viewName.replace(/\s+/g, ""))}`;
}

function reportHref(title: string) {
  return `/lightning/page/analytics?report=${encodeURIComponent(title)}`;
}

function reportIdFromTitle(title: string) {
  return normalizeSearchText(title).replace(/\s+/g, "-") || "report";
}

function buildAnalyticsReports(data: BootstrapData): AnalyticsReportDefinition[] {
  const now = new Date();
  const openCases = data.cases.filter((record) => !isClosedCase(record));
  const closedCases = data.cases.filter(isClosedCase);
  const closedCasesThisMonth = closedCases.filter((record) => {
    const closedDate = caseClosedDate(record);
    return closedDate ? sameReportMonth(closedDate, now) : false;
  });
  const ownedAccountIds = new Set(
    data.accounts
      .filter((account) => String(account.ownerId ?? data.user.id) === data.user.id)
      .map(requiredId)
      .filter(Boolean)
  );
  const openCasesForOwnedAccounts = openCases.filter((record) => ownedAccountIds.has(String(record.accountId ?? "")));
  const openOpportunities = data.opportunities.filter((record) => !isClosedOpportunity(record));
  const closedWonOpportunities = data.opportunities.filter((record) => String(record.stage ?? "") === "Closed Won");

  const standardReports = [
    createAnalyticsReport({
      title: "Open Cases for Accounts I Own",
      objectLabel: "Cases",
      description: "Open support work for cases tied to accounts owned by the current user.",
      rowHeader: "Account",
      valueHeader: "Open Cases",
      valueKind: "count",
      emptyMessage: "No open cases are tied to accounts owned by the current user.",
      metrics: [
        { label: "Open Cases", value: String(openCasesForOwnedAccounts.length), tone: openCasesForOwnedAccounts.length > 0 ? "warning" : "success" },
        { label: "Owned Accounts", value: String(ownedAccountIds.size) },
        { label: "High Priority", value: String(openCasesForOwnedAccounts.filter(isHighPriorityCase).length), tone: openCasesForOwnedAccounts.some(isHighPriorityCase) ? "warning" : "default" },
        { label: "Escalated", value: String(openCasesForOwnedAccounts.filter((record) => String(record.status ?? "") === "Escalated").length), tone: openCasesForOwnedAccounts.some((record) => String(record.status ?? "") === "Escalated") ? "warning" : "default" }
      ],
      rows: groupReportRows(openCasesForOwnedAccounts, (record) => String(record.accountName || "No Account"), {
        hrefFor: (label) => listSearchHref("Case", label),
        secondaryFor: (records) => casePrioritySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "My Closed Cases by Close Date",
      objectLabel: "Cases",
      description: "Closed case volume grouped by the date each case moved out of active support.",
      rowHeader: "Close Date",
      valueHeader: "Closed Cases",
      valueKind: "count",
      emptyMessage: "No closed cases have been recorded yet.",
      metrics: [
        { label: "Closed Cases", value: String(closedCases.length), tone: closedCases.length > 0 ? "success" : "default" },
        { label: "Latest Close Date", value: latestReportDate(closedCases.map(caseClosedDate)) || "-" },
        { label: "Accounts Served", value: String(new Set(closedCases.map((record) => String(record.accountId ?? "")).filter(Boolean)).size) },
        { label: "High Priority Closed", value: String(closedCases.filter(isHighPriorityCase).length) }
      ],
      rows: groupReportRows(closedCases, (record) => formatDate(caseClosedDate(record)) || "No Close Date", {
        hrefFor: (label) => listSearchHref("Case", label),
        secondaryFor: (records) => casePrioritySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "My Cases Closed MTD",
      objectLabel: "Cases",
      description: "Month-to-date closed case throughput, grouped by priority.",
      rowHeader: "Priority",
      valueHeader: "Closed MTD",
      valueKind: "count",
      emptyMessage: "No cases have closed during the current month.",
      metrics: [
        { label: "Closed MTD", value: String(closedCasesThisMonth.length), tone: closedCasesThisMonth.length > 0 ? "success" : "default" },
        { label: "High Priority", value: String(closedCasesThisMonth.filter(isHighPriorityCase).length) },
        { label: "Daily Pace", value: (closedCasesThisMonth.length / Math.max(1, now.getDate())).toFixed(1) },
        { label: "Total Closed", value: String(closedCases.length) }
      ],
      rows: groupReportRows(closedCasesThisMonth, (record) => formatCell(record.priority) || "No Priority", {
        hrefFor: (label) => listSearchHref("Case", label),
        secondaryFor: (records) => `${records.length} closed case${records.length === 1 ? "" : "s"}`
      })
    }),
    createAnalyticsReport({
      title: "Pipeline by Stage",
      objectLabel: "Opportunities",
      description: "Opportunity pipeline grouped by stage with amount rollups.",
      rowHeader: "Stage",
      valueHeader: "Amount",
      valueKind: "currency",
      emptyMessage: "No opportunities have been created yet.",
      metrics: [
        { label: "Open Pipeline", value: formatKanbanSummary(sumReportAmount(openOpportunities, "amount")), tone: openOpportunities.length > 0 ? "success" : "default" },
        { label: "Open Opportunities", value: String(openOpportunities.length) },
        { label: "Closed Won", value: formatKanbanSummary(sumReportAmount(closedWonOpportunities, "amount")), tone: closedWonOpportunities.length > 0 ? "success" : "default" },
        { label: "Closing This Month", value: String(data.opportunities.filter((record) => sameReportMonth(parseReportDate(record.closeDate), now)).length) }
      ],
      rows: groupReportRows(data.opportunities, (record) => formatCell(record.stage) || "No Stage", {
        amountFor: (record) => numberFromRecord(record.amount),
        hrefFor: (label) => listSearchHref("Opportunity", label),
        secondaryFor: (records) => opportunityProbabilitySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "Leads by Status",
      objectLabel: "Leads",
      description: "Lead generation volume grouped by status.",
      rowHeader: "Lead Status",
      valueHeader: "Leads",
      valueKind: "count",
      emptyMessage: "No leads have been created yet.",
      metrics: [
        { label: "Total Leads", value: String(data.leads.length) },
        { label: "Qualified", value: String(data.leads.filter((record) => String(record.status ?? "") === "Qualified").length), tone: data.leads.some((record) => String(record.status ?? "") === "Qualified") ? "success" : "default" },
        { label: "New Leads", value: String(data.leads.filter((record) => String(record.status ?? "") === "New").length) },
        { label: "With Email", value: String(data.leads.filter((record) => Boolean(record.email)).length) }
      ],
      rows: groupReportRows(data.leads, (record) => formatCell(record.status) || "No Status", {
        hrefFor: (label) => listSearchHref("Lead", label),
        secondaryFor: (records) => leadQualitySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "Contacts by Account",
      objectLabel: "Contacts",
      description: "Contact coverage grouped by related account.",
      rowHeader: "Account",
      valueHeader: "Contacts",
      valueKind: "count",
      emptyMessage: "No contacts have been added yet.",
      metrics: [
        { label: "Total Contacts", value: String(data.contacts.length) },
        { label: "Accounts Covered", value: String(new Set(data.contacts.map((record) => String(record.accountId ?? "")).filter(Boolean)).size) },
        { label: "With Email", value: String(data.contacts.filter((record) => Boolean(record.email)).length) },
        { label: "Unassigned Account", value: String(data.contacts.filter((record) => !record.accountId).length), tone: data.contacts.some((record) => !record.accountId) ? "warning" : "default" }
      ],
      rows: groupReportRows(data.contacts, (record) => String(record.accountName || "No Account"), {
        hrefFor: (label) => listSearchHref("Contact", label),
        secondaryFor: (records) => `${records.filter((record) => Boolean(record.email)).length} with email`
      })
    }),
    createAnalyticsReport({
      title: "Accounts by Type",
      objectLabel: "Accounts",
      description: "Account mix grouped by account type.",
      rowHeader: "Account Type",
      valueHeader: "Accounts",
      valueKind: "count",
      emptyMessage: "No accounts have been created yet.",
      metrics: [
        { label: "Total Accounts", value: String(data.accounts.length) },
        { label: "Customers", value: String(data.accounts.filter((record) => String(record.type ?? "") === "Customer").length), tone: data.accounts.some((record) => String(record.type ?? "") === "Customer") ? "success" : "default" },
        { label: "Prospects", value: String(data.accounts.filter((record) => String(record.type ?? "") === "Prospect").length) },
        { label: "Partners", value: String(data.accounts.filter((record) => String(record.type ?? "") === "Partner").length) }
      ],
      rows: groupReportRows(data.accounts, (record) => formatCell(record.type) || "No Type", {
        hrefFor: (label) => listSearchHref("Account", label),
        secondaryFor: (records) => `${records.filter((record) => String(record.ownerId ?? data.user.id) === data.user.id).length} owned by ${data.user.alias}`
      })
    })
  ];
  return [
    ...standardReports,
    ...data.customReports.map((report) => customAnalyticsReport(data, report))
  ];
}

function createAnalyticsReport(report: Omit<AnalyticsReportDefinition, "id" | "href">): AnalyticsReportDefinition {
  return {
    ...report,
    id: reportIdFromTitle(report.title),
    href: reportHref(report.title)
  };
}

function customAnalyticsReport(data: BootstrapData, report: RecordData): AnalyticsReportDefinition {
  const object = isCrmObject(String(report.object ?? "")) ? String(report.object) as CrmObject : "Lead";
  const records = data[dataKeyForObject(object)] as RecordData[];
  const groupField = String(report.groupField ?? OBJECT_DEFINITIONS[object].columns[0]?.key ?? "name");
  const columns = Array.isArray(report.columns) ? report.columns.map(String) : [];
  const amountField = object === "Opportunity" && columns.includes("amount") ? "amount" : undefined;
  const rowHeader = reportBuilderFieldLabel(object, groupField);
  const valueKind = amountField ? "currency" : "count";
  const title = String(report.name ?? `${OBJECT_DEFINITIONS[object].plural} by ${rowHeader}`);
  const rows = groupReportRows(records, (record) => formatCell(record[groupField]) || "Blank", {
    amountFor: amountField ? (record) => numberFromRecord(record[amountField]) : undefined,
    hrefFor: (label) => listSearchHref(object, label),
    secondaryFor: (groupRecords) => `${groupRecords.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()}`
  });

  return {
    id: `custom-report-${String(report.id ?? reportIdFromTitle(title))}`,
    title,
    objectLabel: OBJECT_DEFINITIONS[object].plural,
    description: `Saved custom report grouped by ${rowHeader.toLowerCase()}.`,
    rowHeader,
    valueHeader: valueKind === "currency" ? "Amount" : "Records",
    valueKind,
    emptyMessage: `No ${OBJECT_DEFINITIONS[object].plural.toLowerCase()} match this report yet.`,
    metrics: [
      { label: "Records", value: String(records.length) },
      { label: "Groups", value: String(rows.length) },
      { label: "Columns", value: String(columns.length) },
      { label: "Saved", value: report.updatedAt ? formatDate(String(report.updatedAt)) : "Now" }
    ],
    rows,
    href: reportHref(title)
  };
}

function dashboardReportComponents(dashboard: RecordData, reports: AnalyticsReportDefinition[]) {
  const ids = Array.isArray(dashboard.reportIds) ? dashboard.reportIds.map(String) : [];
  const selected = ids.map((id) => reports.find((report) => report.id === id)).filter((report): report is AnalyticsReportDefinition => Boolean(report));
  return selected.length > 0 ? selected : reports.slice(0, 2);
}

function selectAnalyticsReport(reports: AnalyticsReportDefinition[], reportName: string) {
  const normalizedName = normalizeSearchText(reportName);
  return reports.find((report) => normalizeSearchText(report.title) === normalizedName || report.id === reportIdFromTitle(reportName)) ?? reports[0];
}

function groupReportRows(
  records: RecordData[],
  labelFor: (record: RecordData) => string,
  options: {
    amountFor?: (record: RecordData) => number;
    hrefFor?: (label: string) => string;
    secondaryFor?: (records: RecordData[], label: string) => string;
  } = {}
): ReportRow[] {
  const groups = records.reduce<Map<string, { records: RecordData[]; amount: number }>>((accumulator, record) => {
    const label = labelFor(record) || "Blank";
    const current = accumulator.get(label) ?? { records: [], amount: 0 };
    current.records.push(record);
    current.amount += options.amountFor ? options.amountFor(record) : 0;
    accumulator.set(label, current);
    return accumulator;
  }, new Map());

  return Array.from(groups.entries())
    .map(([label, group]) => ({
      label,
      count: group.records.length,
      amount: options.amountFor ? group.amount : undefined,
      href: options.hrefFor?.(label),
      secondary: options.secondaryFor?.(group.records, label)
    }))
    .sort((left, right) => reportRowValueForSort(right) - reportRowValueForSort(left) || left.label.localeCompare(right.label));
}

function reportRowValue(report: AnalyticsReportDefinition, row: ReportRow) {
  return report.valueKind === "currency" ? row.amount ?? 0 : row.count;
}

function reportRowValueForSort(row: ReportRow) {
  return row.amount ?? row.count;
}

function formatReportValue(report: AnalyticsReportDefinition, row: ReportRow) {
  if (report.valueKind === "currency") return formatKanbanSummary(row.amount ?? 0);
  return String(row.count);
}

function analyticsReportCsv(report: AnalyticsReportDefinition) {
  const header = [report.rowHeader, "Records", report.valueHeader, "Notes"];
  const rows = report.rows.map((row) => [row.label, String(row.count), formatReportValue(report, row), row.secondary ?? ""]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function fileSafeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function isClosedCase(record: RecordData) {
  return String(record.status ?? "") === "Closed" || Boolean(record.closedAt);
}

function isHighPriorityCase(record: RecordData) {
  return String(record.priority ?? "") === "High";
}

function caseClosedDate(record: RecordData) {
  return parseReportDate(record.closedAt) ?? parseReportDate(record.updatedAt) ?? parseReportDate(record.createdAt);
}

function isClosedOpportunity(record: RecordData) {
  return ["Closed Won", "Closed Lost"].includes(String(record.stage ?? ""));
}

function parseReportDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameReportMonth(date: Date | null, reference: Date) {
  if (!date) return false;
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

function latestReportDate(dates: Array<Date | null>) {
  const latest = dates.filter(Boolean).sort((left, right) => right!.getTime() - left!.getTime())[0];
  return latest ? formatDate(latest) : "";
}

function sumReportAmount(records: RecordData[], field: string) {
  return records.reduce((sum, record) => sum + numberFromRecord(record[field]), 0);
}

function casePrioritySummary(records: RecordData[]) {
  const highPriority = records.filter(isHighPriorityCase).length;
  if (highPriority > 0) return `${highPriority} high priority`;
  return `${records.length} total case${records.length === 1 ? "" : "s"}`;
}

function opportunityProbabilitySummary(records: RecordData[]) {
  const probabilities = records.map((record) => numberFromRecord(record.probability)).filter((value) => value > 0);
  if (probabilities.length === 0) return `${records.length} opportunit${records.length === 1 ? "y" : "ies"}`;
  const average = Math.round(probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length);
  return `${average}% average probability`;
}

function leadQualitySummary(records: RecordData[]) {
  const hot = records.filter((record) => String(record.rating ?? "") === "Hot").length;
  if (hot > 0) return `${hot} hot lead${hot === 1 ? "" : "s"}`;
  return `${records.filter((record) => Boolean(record.email)).length} with email`;
}

function reportBuilderTypeFrom(reportType?: string): ReportBuilderType {
  if (isReportBuilderType(reportType)) return reportType;
  if (reportType === "Report") return "Leads";
  return "Opportunities";
}

function isReportBuilderType(value?: string): value is ReportBuilderType {
  return reportBuilderTypes.includes(value as ReportBuilderType);
}

function reportBuilderRecords(data: BootstrapData, type: ReportBuilderType) {
  const object = reportBuilderConfigs[type].object;
  return data[dataKeyForObject(object)] as RecordData[];
}

function reportBuilderPreviewReport(data: BootstrapData, type: ReportBuilderType, groupField: string): AnalyticsReportDefinition {
  const config = reportBuilderConfigs[type];
  const records = reportBuilderRecords(data, type);
  const groupLabel = reportBuilderFieldLabel(config.object, groupField);
  const valueKind = config.amountField ? "currency" : "count";
  const rows = groupReportRows(records, (record) => formatCell(record[groupField]) || "Blank", {
    amountFor: config.amountField ? (record) => numberFromRecord(record[config.amountField!]) : undefined,
    hrefFor: (label) => listSearchHref(config.object, label),
    secondaryFor: (groupRecords) => `${groupRecords.length} ${OBJECT_DEFINITIONS[config.object].plural.toLowerCase()}`
  });

  return {
    id: "builder-preview",
    title: `${type} by ${groupLabel}`,
    objectLabel: type,
    description: `Preview of ${OBJECT_DEFINITIONS[config.object].plural.toLowerCase()} grouped by ${groupLabel.toLowerCase()}.`,
    rowHeader: groupLabel,
    valueHeader: valueKind === "currency" ? "Amount" : "Records",
    valueKind,
    emptyMessage: `No ${OBJECT_DEFINITIONS[config.object].plural.toLowerCase()} match this report type yet.`,
    metrics: [
      { label: "Records", value: String(records.length) },
      { label: "Groups", value: String(rows.length) },
      { label: valueKind === "currency" ? "Total Amount" : "Selected Columns", value: valueKind === "currency" ? formatKanbanSummary(sumReportAmount(records, config.amountField ?? "amount")) : String(config.columns.length) },
      { label: "Report Type", value: type }
    ],
    rows,
    href: "#"
  };
}

function reportBuilderFieldLabel(object: CrmObject, field: string) {
  return OBJECT_DEFINITIONS[object].columns.find((column) => column.key === field)?.label ?? field.replace(/([A-Z])/g, " $1").replace(/^./, (match) => match.toUpperCase());
}

function buildHomeRecentRecords(data: BootstrapData) {
  const records = [
    ...data.accounts.slice(0, 2).map((record) => ({ id: `home-account-${requiredId(record)}`, label: recordTitle("Account", record), context: "Account", href: routeForRecord("Account", requiredId(record)) })),
    ...data.contacts.slice(0, 2).map((record) => ({ id: `home-contact-${requiredId(record)}`, label: recordTitle("Contact", record), context: "Contact", href: routeForRecord("Contact", requiredId(record)) })),
    ...data.leads.slice(0, 1).map((record) => ({ id: `home-lead-${requiredId(record)}`, label: recordTitle("Lead", record), context: "Lead", href: listSearchHref("Lead", recordTitle("Lead", record)) })),
    ...data.opportunities.slice(0, 1).map((record) => ({ id: `home-opportunity-${requiredId(record)}`, label: recordTitle("Opportunity", record), context: "Opportunity", href: listSearchHref("Opportunity", recordTitle("Opportunity", record)) })),
    { id: "home-report-open-cases", label: "Open Cases for Accounts I Own", context: "Report", href: reportHref("Open Cases for Accounts I Own") }
  ];

  return records.slice(0, 5);
}

function buildHelpArticleStateMap(states: RecordData[] = []) {
  return states.reduce<Record<string, RecordData>>((accumulator, state) => {
    const articleId = String(state.articleId ?? "");
    if (articleId) accumulator[articleId] = state;
    return accumulator;
  }, {});
}

function helpArticleMatchesQuery(article: HelpArticle, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeSearchText([article.title, article.summary, article.category, ...article.tags].join(" "));
  return normalizedQuery.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

function buildSetupShortcutStateMap(states: RecordData[] = []) {
  return states.reduce<Record<string, RecordData>>((accumulator, state) => {
    const shortcutId = String(state.shortcutId ?? "");
    if (shortcutId) accumulator[shortcutId] = state;
    return accumulator;
  }, {});
}

function setupShortcutMatchesQuery(shortcut: SetupShortcut, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeSearchText([shortcut.title, shortcut.summary, shortcut.category, ...shortcut.tags].join(" "));
  return normalizedQuery.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

function agentforceMetadata(message: RecordData): AgentforceMessageMetadata {
  const metadata = message.metadata;
  if (!isRecordData(metadata)) return {};
  const actions = Array.isArray(metadata.actions)
    ? metadata.actions.filter(isRecordData).map((action) => ({ label: String(action.label ?? ""), href: String(action.href ?? "") })).filter((action) => action.label && action.href)
    : [];
  const facts = Array.isArray(metadata.facts)
    ? metadata.facts.filter(isRecordData).map((fact) => ({ label: String(fact.label ?? ""), value: String(fact.value ?? "") })).filter((fact) => fact.label)
    : [];
  const draft = isRecordData(metadata.draft)
    ? {
        subject: metadata.draft.subject ? String(metadata.draft.subject) : undefined,
        body: metadata.draft.body ? String(metadata.draft.body) : undefined,
        to: metadata.draft.to ? String(metadata.draft.to) : undefined
      }
    : undefined;
  return {
    kind: metadata.kind ? String(metadata.kind) : undefined,
    actions,
    facts,
    draft
  };
}

function HeaderUtility({
  icon: Icon,
  label,
  kind,
  data,
  onNavigate,
  onDataChange,
  onToast
}: {
  icon: ElementType;
  label: string;
  kind: UtilityKind;
  data: BootstrapData;
  onNavigate: (href: string) => void;
  onDataChange: BootstrapDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<Array<RecordData>>(() =>
    data.agentforceMessages.length > 0
      ? data.agentforceMessages
      : [{ id: "local-agent-welcome", role: "assistant", text: "I can summarize CRM records, draft follow-up email copy, or suggest next actions from the current workspace." }]
  );
  const [helpQuery, setHelpQuery] = useState("");
  const [helpView, setHelpView] = useState<"All" | "Saved" | "Recent">("All");
  const [helpArticleStates, setHelpArticleStates] = useState<Array<RecordData>>(() => data.helpArticleStates);
  const [settingsQuery, setSettingsQuery] = useState("");
  const [settingsView, setSettingsView] = useState<"All" | "Pinned" | "Recent">("All");
  const [setupShortcutStates, setSetupShortcutStates] = useState<Array<RecordData>>(() => data.setupShortcutStates);
  const initialPreferences = data.userPreferences[0] ?? { displayDensity: "Comfy", guidanceEnabled: true, consoleTabsEnabled: true, timezone: "Asia/Dubai", locale: "en-US" };
  const [density, setDensity] = useState(String(initialPreferences.displayDensity ?? "Comfy"));
  const [guidanceEnabled, setGuidanceEnabled] = useState(Boolean(initialPreferences.guidanceEnabled ?? true));
  const [consoleTabsEnabled, setConsoleTabsEnabled] = useState(Boolean(initialPreferences.consoleTabsEnabled ?? true));
  const [timezone, setTimezone] = useState(String(initialPreferences.timezone ?? "Asia/Dubai"));
  const [locale, setLocale] = useState(String(initialPreferences.locale ?? "en-US"));
  const [profileName, setProfileName] = useState(data.user.name);
  const [profileAlias, setProfileAlias] = useState(data.user.alias);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(String(data.user.avatarUrl ?? ""));
  const [profileEditing, setProfileEditing] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread">("all");
  const [notificationCategory, setNotificationCategory] = useState("All Categories");
  const [notifications, setNotifications] = useState<Array<RecordData>>(() => data.notifications);
  const [notificationPreferences, setNotificationPreferences] = useState<Record<string, boolean>>(() => buildNotificationPreferences(data.notificationPreferences));
  const [guidanceItems, setGuidanceItems] = useState<Array<RecordData>>(() => buildGuidanceItems(data));

  useEffect(() => {
    setNotifications(data.notifications);
  }, [data.notifications]);

  useEffect(() => {
    setNotificationPreferences(buildNotificationPreferences(data.notificationPreferences));
  }, [data.notificationPreferences]);

  useEffect(() => {
    setHelpArticleStates(data.helpArticleStates);
  }, [data.helpArticleStates]);

  useEffect(() => {
    setSetupShortcutStates(data.setupShortcutStates);
  }, [data.setupShortcutStates]);

  useEffect(() => {
    setGuidanceItems(buildGuidanceItems(data));
  }, [data]);

  useEffect(() => {
    setProfileName(data.user.name);
    setProfileAlias(data.user.alias);
    setProfileAvatarUrl(String(data.user.avatarUrl ?? ""));
  }, [data.user]);

  async function sendAssistantMessage() {
    if (!assistantInput.trim()) return;
    const text = assistantInput.trim();
    setAssistantInput("");
    const optimisticUser = { id: `pending-user-${Date.now()}`, role: "user", text };
    setAssistantMessages((messages) => [...messages, optimisticUser]);
    const response = await postUtility("sendAgentforceMessage", undefined, { text });
    if (Array.isArray(response?.messages)) {
      const nextMessages = response.messages as RecordData[];
      setAssistantMessages((messages) => [...messages.filter((message) => message.id !== optimisticUser.id), ...nextMessages]);
      onDataChange((previous) => ({
        ...previous,
        agentforceMessages: [...previous.agentforceMessages, ...nextMessages]
      }));
    } else {
      setAssistantMessages((messages) => messages.filter((message) => message.id !== optimisticUser.id));
      onToast({ tone: "error", message: "Agentforce couldn't answer that request." });
    }
  }

  async function clearAssistantMessages() {
    const response = await postUtility("clearAgentforceMessages");
    if (Array.isArray(response?.messages)) {
      const messages = response.messages as RecordData[];
      setAssistantMessages(messages);
      onDataChange((previous) => ({ ...previous, agentforceMessages: messages }));
      onToast({ tone: "success", message: "Agentforce conversation cleared." });
    }
  }

  const unreadCount = notifications.filter((item) => !item.read).length;
  const availableNotificationCategories = Array.from(new Set(["All Categories", ...notificationCategories, ...notifications.map((item) => String(item.category ?? "General"))]));
  const visibleNotifications = notifications.filter((item) => {
    if (notificationFilter === "unread" && item.read) return false;
    if (notificationCategory !== "All Categories" && String(item.category ?? "General") !== notificationCategory) return false;
    return true;
  });
  const effectiveBadge = kind === "notifications" && unreadCount > 0 ? String(unreadCount) : undefined;
  const helpStateByArticleId = buildHelpArticleStateMap(helpArticleStates);
  const visibleHelpArticles = helpArticleCatalog.filter((article) => {
    const state = helpStateByArticleId[article.id];
    if (helpView === "Saved" && state?.saved !== true) return false;
    if (helpView === "Recent" && !state?.viewedAt) return false;
    return helpArticleMatchesQuery(article, helpQuery);
  });
  const setupStateByShortcutId = buildSetupShortcutStateMap(setupShortcutStates);
  const visibleSetupShortcuts = setupShortcutCatalog.filter((shortcut) => {
    const state = setupStateByShortcutId[shortcut.id];
    if (settingsView === "Pinned" && state?.pinned !== true) return false;
    if (settingsView === "Recent" && !state?.lastOpenedAt) return false;
    return setupShortcutMatchesQuery(shortcut, settingsQuery);
  });

  async function markNotificationRead(id: string) {
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    const response = await postUtility("markNotificationRead", id);
    const notification = response?.notification as RecordData | undefined;
    if (notification?.id) {
      onDataChange((previous) => ({
        ...previous,
        notifications: previous.notifications.map((item) => (item.id === notification.id ? notification : item))
      }));
    }
  }

  async function markAllNotificationsRead() {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    const response = await postUtility("markAllNotificationsRead");
    if (Array.isArray(response?.notifications)) {
      const nextNotifications = response.notifications as RecordData[];
      setNotifications(nextNotifications);
      onDataChange((previous) => ({ ...previous, notifications: nextNotifications }));
    }
    onToast({ tone: "success", message: "All notifications marked as read." });
  }

  async function openNotification(item: RecordData) {
    await markNotificationRead(String(item.id));
    if (item.href) onNavigate(String(item.href));
  }

  async function deleteNotification(id: string) {
    const previousNotifications = notifications;
    const nextNotifications = notifications.filter((item) => item.id !== id);
    setNotifications(nextNotifications);
    onDataChange((previous) => ({ ...previous, notifications: previous.notifications.filter((item) => item.id !== id) }));
    const response = await postUtility("deleteNotification", id);
    if (!response?.ok) setNotifications(previousNotifications);
    else onToast({ tone: "success", message: "Notification deleted." });
  }

  async function clearReadNotifications() {
    const response = await postUtility("clearReadNotifications");
    if (Array.isArray(response?.notifications)) {
      const nextNotifications = response.notifications as RecordData[];
      setNotifications(nextNotifications);
      onDataChange((previous) => ({ ...previous, notifications: nextNotifications }));
      onToast({ tone: "success", message: "Read notifications cleared." });
    }
  }

  async function clearAllNotifications() {
    const response = await postUtility("clearAllNotifications");
    if (Array.isArray(response?.notifications)) {
      setNotifications([]);
      onDataChange((previous) => ({ ...previous, notifications: [] }));
      onToast({ tone: "success", message: "Notifications cleared." });
    }
  }

  async function updateNotificationPreference(category: string, enabled: boolean) {
    setNotificationPreferences((current) => ({ ...current, [category]: enabled }));
    const response = await postUtility("updateNotificationPreference", undefined, { category, enabled });
    if (Array.isArray(response?.notificationPreferences)) {
      const nextPreferences = response.notificationPreferences as RecordData[];
      setNotificationPreferences(buildNotificationPreferences(nextPreferences));
      onDataChange((previous) => ({ ...previous, notificationPreferences: nextPreferences }));
    }
  }

  async function updateGuidanceItem(id: string, status: string, snoozedUntil?: string | null) {
    setGuidanceItems((items) => items.map((item) => (item.id === id ? { ...item, state: status, snoozedUntil } : item)));
    const response = await postUtility("updateGuidance", id, { status, snoozedUntil });
    const state = response?.state as RecordData | undefined;
    if (state?.id) {
      onDataChange((previous) => ({
        ...previous,
        guidanceStates: previous.guidanceStates.some((item) => item.id === state.id)
          ? previous.guidanceStates.map((item) => (item.id === state.id ? state : item))
          : [state, ...previous.guidanceStates]
      }));
    }
  }

  async function updateHelpArticleState(article: HelpArticle, values: RecordData) {
    const optimisticState = {
      ...(helpStateByArticleId[article.id] ?? {}),
      articleId: article.id,
      ...values
    };
    setHelpArticleStates((states) => [
      optimisticState,
      ...states.filter((state) => String(state.articleId) !== article.id)
    ]);
    const response = await postUtility("updateHelpArticleState", article.id, { articleId: article.id, ...values });
    if (Array.isArray(response?.helpArticleStates)) {
      const nextStates = response.helpArticleStates as RecordData[];
      setHelpArticleStates(nextStates);
      onDataChange((previous) => ({ ...previous, helpArticleStates: nextStates }));
    }
  }

  async function openHelpArticle(article: HelpArticle) {
    await updateHelpArticleState(article, { viewedAt: new Date().toISOString() });
    onNavigate(article.href);
  }

  async function clearHelpHistory() {
    const response = await postUtility("clearHelpArticleHistory");
    if (Array.isArray(response?.helpArticleStates)) {
      const nextStates = response.helpArticleStates as RecordData[];
      setHelpArticleStates(nextStates);
      onDataChange((previous) => ({ ...previous, helpArticleStates: nextStates }));
      onToast({ tone: "success", message: "Help history cleared." });
    }
  }

  async function updateSetupShortcutState(shortcut: SetupShortcut, values: RecordData) {
    const optimisticState = {
      ...(setupStateByShortcutId[shortcut.id] ?? {}),
      shortcutId: shortcut.id,
      ...values
    };
    setSetupShortcutStates((states) => [
      optimisticState,
      ...states.filter((state) => String(state.shortcutId) !== shortcut.id)
    ]);
    const response = await postUtility("updateSetupShortcutState", shortcut.id, { shortcutId: shortcut.id, ...values });
    if (Array.isArray(response?.setupShortcutStates)) {
      const nextStates = response.setupShortcutStates as RecordData[];
      setSetupShortcutStates(nextStates);
      onDataChange((previous) => ({ ...previous, setupShortcutStates: nextStates }));
    }
  }

  async function openSetupShortcut(shortcut: SetupShortcut) {
    await updateSetupShortcutState(shortcut, { lastOpenedAt: new Date().toISOString() });
    onNavigate(shortcut.href);
  }

  async function clearSetupShortcutHistory() {
    const response = await postUtility("clearSetupShortcutHistory");
    if (Array.isArray(response?.setupShortcutStates)) {
      const nextStates = response.setupShortcutStates as RecordData[];
      setSetupShortcutStates(nextStates);
      onDataChange((previous) => ({ ...previous, setupShortcutStates: nextStates }));
      onToast({ tone: "success", message: "Setup history cleared." });
    }
  }

  async function savePreferences(next: RecordData) {
    const values = {
      displayDensity: next.displayDensity ?? density,
      guidanceEnabled: next.guidanceEnabled ?? guidanceEnabled,
      consoleTabsEnabled: next.consoleTabsEnabled ?? consoleTabsEnabled,
      timezone: next.timezone ?? timezone,
      locale: next.locale ?? locale
    };
    const response = await postUtility("updatePreferences", undefined, values);
    const preferences = response?.preferences as RecordData | undefined;
    if (preferences?.id) {
      onDataChange((previous) => ({
        ...previous,
        userPreferences: [preferences, ...previous.userPreferences.filter((item) => item.id !== preferences.id && item.userId !== preferences.userId)]
      }));
    }
  }

  async function saveProfile() {
    if (!profileName.trim() || !profileAlias.trim()) {
      onToast({ tone: "error", message: "Name and alias are required." });
      return;
    }
    const response = await postUtility("updateProfile", undefined, { name: profileName.trim(), alias: profileAlias.trim(), avatarUrl: profileAvatarUrl.trim() || null });
    const user = response?.user as RecordData | undefined;
    if (user?.id) {
      onDataChange((previous) => ({ ...previous, user: user as BootstrapData["user"] }));
      setProfileEditing(false);
      onToast({ tone: "success", message: "Profile updated." });
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={label} className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#444] hover:bg-[#f2f4f7] hover:text-brand-700 focus-visible:bg-[#f2f4f7] focus-visible:text-brand-700 active:scale-90 active:bg-[#e8ebef] data-[state=open]:bg-brand-50 data-[state=open]:text-brand-700">
          <Icon size={17} />
          {effectiveBadge && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ba0517] px-1 text-[10px] text-white">{effectiveBadge}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" className={cn("z-50 rounded border border-[#d8dde6] bg-white shadow-popover", kind === "help" || kind === "settings" ? "w-[460px]" : "w-[360px]")}>
          <div className="flex items-center justify-between border-b border-[#d8dde6] px-3 py-2">
            <div className="font-semibold">{label}</div>
            <Popover.Close asChild>
              <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label={`Close ${label}`}>
                <X size={14} />
              </button>
            </Popover.Close>
          </div>
          {kind === "agentforce" && (
            <div className="p-3">
              <div className="max-h-64 space-y-2 overflow-auto rounded border border-[#d8dde6] bg-[#f8f8f8] p-2">
                {assistantMessages.map((message, index) => {
                  const metadata = agentforceMetadata(message);
                  return (
                    <div key={String(message.id ?? index)} className={cn("rounded px-2 py-1 text-sm", message.role === "assistant" ? "bg-white" : "ml-8 bg-brand-50 text-brand-900")}>
                      <div className="text-[11px] font-semibold uppercase text-[#706e6b]">{message.role === "assistant" ? "Agentforce" : "You"}</div>
                      <div className="whitespace-pre-wrap">{String(message.text ?? "")}</div>
                      {message.role === "assistant" && metadata.facts && metadata.facts.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {metadata.facts.map((fact) => (
                            <div key={`${fact.label}-${fact.value}`} className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-1.5">
                              <div className="text-[10px] uppercase text-[#706e6b]">{fact.label}</div>
                              <div className="font-semibold">{fact.value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {message.role === "assistant" && metadata.draft && (
                        <div className="mt-2 rounded border border-[#d8dde6] bg-[#f8f8f8] p-2">
                          <div className="text-[10px] font-semibold uppercase text-[#706e6b]">Draft Email</div>
                          {metadata.draft.to && <div className="mt-1 text-xs text-[#706e6b]">To: {metadata.draft.to}</div>}
                          <div className="mt-1 font-semibold">{metadata.draft.subject ?? "Follow up"}</div>
                          <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-[#444]">{metadata.draft.body ?? ""}</pre>
                        </div>
                      )}
                      {message.role === "assistant" && metadata.actions && metadata.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {metadata.actions.map((action) => (
                            <button key={`${action.label}-${action.href}`} className="rounded border border-[#c9c9c9] bg-white px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50" onClick={() => onNavigate(action.href)}>
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <input className={inputClass} value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} placeholder="Ask about this CRM..." onKeyDown={(event) => event.key === "Enter" && sendAssistantMessage()} />
                <Button variant="primary" onClick={sendAssistantMessage}>Send</Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button onClick={() => setAssistantInput("Summarize my open pipeline")}>Summarize pipeline</Button>
                <Button onClick={() => setAssistantInput("Draft a follow-up email for Robert")}>Draft follow-up</Button>
                <Button onClick={() => setAssistantInput("What support cases need attention?")}>Support cases</Button>
                <Button onClick={() => void clearAssistantMessages()}>Clear chat</Button>
              </div>
            </div>
          )}
          {kind === "guidance" && (
            <div className="p-3">
              <div className="mb-2 text-sm text-[#706e6b]">Contextual setup cards and walkthroughs for the current CRM workspace.</div>
              <div className="space-y-2">
                {guidanceItems.map((item) => {
                  const state = String(item.state ?? "ACTIVE");
                  const snoozedUntil = String(item.snoozedUntil ?? "");
                  const isSnoozed = state === "SNOOZED" && guidanceSnoozedUntil(item) > Date.now();
                  return (
                  <div key={item.id} className="rounded border border-[#d8dde6] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={cn("font-semibold", state === "DONE" && "line-through", state === "DISMISSED" && "text-[#706e6b]")}>{String(item.title)}</div>
                        <div className="text-xs text-[#706e6b]">{String(item.body)}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <span className={cn("rounded px-1.5 py-0.5", guidanceStateBadgeClass(state))}>{guidanceStateLabel(item)}</span>
                          {isSnoozed && <span className="rounded bg-[#f3f3f3] px-1.5 py-0.5 text-[#514f4d]">Until {formatDateTime(snoozedUntil)}</span>}
                        </div>
                      </div>
                      <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs" onClick={() => void updateGuidanceItem(String(item.id), state === "DONE" ? "ACTIVE" : "DONE", null)}>
                        {state === "DONE" ? "Restore" : "Done"}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Boolean(item.href) && <Button onClick={() => onNavigate(String(item.href))}>Open</Button>}
                      <Button onClick={() => void updateGuidanceItem(String(item.id), "SNOOZED", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}>Snooze</Button>
                      {state === "DISMISSED" ? (
                        <Button onClick={() => void updateGuidanceItem(String(item.id), "ACTIVE", null)}>Restore</Button>
                      ) : (
                        <Button onClick={() => void updateGuidanceItem(String(item.id), "DISMISSED", null)}>Dismiss</Button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
          {kind === "help" && (
            <div className="p-3">
              <div className="mb-3 flex items-center gap-2 rounded border border-[#d8dde6] bg-[#f8f8f8] p-2">
                <BookOpen size={16} className="text-brand-600" />
                <div>
                  <div className="text-sm font-semibold">Salesforce Help</div>
                  <div className="text-xs text-[#706e6b]">Saved articles and viewed history are persisted for this user.</div>
                </div>
              </div>
              <input className={inputClass} value={helpQuery} onChange={(event) => setHelpQuery(event.target.value)} placeholder="Search help, objects, settings..." />
              <div className="mt-2 inline-flex rounded border border-[#c9c9c9] bg-white p-0.5 text-xs">
                {(["All", "Saved", "Recent"] as const).map((view) => (
                  <button key={view} className={cn("rounded px-2 py-1", helpView === view && "bg-brand-600 text-white")} onClick={() => setHelpView(view)}>
                    {view}
                  </button>
                ))}
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-auto">
                {visibleHelpArticles.map((article) => {
                  const state = helpStateByArticleId[article.id];
                  const saved = state?.saved === true;
                  const helpful = state?.helpful === true;
                  return (
                    <div key={article.id} className={cn("rounded border border-[#d8dde6] p-2 text-sm", saved && "border-brand-500 bg-brand-50")}>
                      <div className="flex items-start justify-between gap-2">
                        <button className="min-w-0 flex-1 text-left" onClick={() => void openHelpArticle(article)}>
                          <span className="flex items-center gap-2 font-semibold">
                            {saved && <Bookmark size={13} className="shrink-0 fill-brand-600 text-brand-600" />}
                            <span className="truncate">{article.title}</span>
                          </span>
                          <span className="mt-1 block text-xs text-[#706e6b]">{article.summary}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] uppercase text-[#706e6b]">
                            <span>{article.category}</span>
                            {Boolean(state?.viewedAt) && <span className="inline-flex items-center gap-1 normal-case"><History size={11} /> {formatDateTime(String(state.viewedAt))}</span>}
                          </span>
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button onClick={() => void openHelpArticle(article)}>Open</Button>
                        <Button onClick={() => void updateHelpArticleState(article, { saved: !saved })}>{saved ? "Unsave" : "Save"}</Button>
                        <Button onClick={() => void updateHelpArticleState(article, { helpful: !helpful })}>
                          <ThumbsUp size={13} /> {helpful ? "Useful" : "Helpful"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {visibleHelpArticles.length === 0 && <div className="rounded border border-dashed border-[#d8dde6] p-4 text-center text-sm text-[#706e6b]">No help articles match this view.</div>}
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-[#d8dde6] pt-3">
                <Button onClick={() => void clearHelpHistory()}>Clear history</Button>
                <Button onClick={() => onNavigate("/lightning/page/analytics?report=Pipeline%20by%20Stage")}>Open Analytics Help</Button>
              </div>
            </div>
          )}
          {kind === "settings" && (
            <div className="p-3">
              <div className="mb-3 rounded border border-[#d8dde6] bg-[#f8f8f8] p-3">
                <div className="text-sm font-semibold">Quick Settings</div>
                <div className="mt-1 text-xs text-[#706e6b]">Preferences, pinned setup shortcuts, and recent setup launches are saved for {data.user.alias}.</div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <FieldShell label="Density">
                    <NativeSelect options={["Comfy", "Compact"]} value={density} onChange={(value) => { setDensity(value); void savePreferences({ displayDensity: value }); }} />
                  </FieldShell>
                  <FieldShell label="Timezone">
                    <NativeSelect options={["Asia/Dubai", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London"]} value={timezone} onChange={(value) => { setTimezone(value); void savePreferences({ timezone: value }); }} />
                  </FieldShell>
                  <FieldShell label="Locale">
                    <NativeSelect options={["en-US", "en-GB", "ar-AE", "fr-FR", "de-DE"]} value={locale} onChange={(value) => { setLocale(value); void savePreferences({ locale: value }); }} />
                  </FieldShell>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-lg border border-[#e4e7ec] bg-white shadow-card p-2 text-sm">
                    Guidance cards
                    <input type="checkbox" checked={guidanceEnabled} onChange={(event) => { setGuidanceEnabled(event.target.checked); void savePreferences({ guidanceEnabled: event.target.checked }); }}  className={checkboxClass} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-[#e4e7ec] bg-white shadow-card p-2 text-sm">
                    Console tabs
                    <input type="checkbox" checked={consoleTabsEnabled} onChange={(event) => { setConsoleTabsEnabled(event.target.checked); void savePreferences({ consoleTabsEnabled: event.target.checked }); }}  className={checkboxClass} />
                  </label>
                </div>
              </div>
              <div className="mb-2 flex gap-2">
                <input className={inputClass} value={settingsQuery} onChange={(event) => setSettingsQuery(event.target.value)} placeholder="Search setup, objects, reports..." />
                <Button onClick={() => void clearSetupShortcutHistory()}>Clear recent</Button>
              </div>
              <div className="mb-3 inline-flex rounded border border-[#c9c9c9] bg-white p-0.5 text-xs">
                {(["All", "Pinned", "Recent"] as const).map((view) => (
                  <button key={view} className={cn("rounded px-2 py-1", settingsView === view && "bg-brand-600 text-white")} onClick={() => setSettingsView(view)}>
                    {view}
                  </button>
                ))}
              </div>
              <div className="max-h-80 space-y-2 overflow-auto">
                {visibleSetupShortcuts.map((shortcut) => {
                  const state = setupStateByShortcutId[shortcut.id];
                  const pinned = state?.pinned === true;
                  return (
                    <div key={shortcut.id} className={cn("rounded border border-[#d8dde6] p-2 text-sm", pinned && "border-brand-500 bg-brand-50")}>
                      <div className="flex items-start justify-between gap-2">
                        <button className="min-w-0 flex-1 text-left" onClick={() => void openSetupShortcut(shortcut)}>
                          <span className="flex items-center gap-2 font-semibold">
                            {pinned && <Pin size={13} className="shrink-0 fill-brand-600 text-brand-600" />}
                            <span className="truncate">{shortcut.title}</span>
                          </span>
                          <span className="mt-1 block text-xs text-[#706e6b]">{shortcut.summary}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] uppercase text-[#706e6b]">
                            <span>{shortcut.category}</span>
                            {Boolean(state?.lastOpenedAt) && <span className="inline-flex items-center gap-1 normal-case"><History size={11} /> {formatDateTime(String(state.lastOpenedAt))}</span>}
                          </span>
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button onClick={() => void openSetupShortcut(shortcut)}>Open</Button>
                        <Button onClick={() => void updateSetupShortcutState(shortcut, { pinned: !pinned })}>{pinned ? "Unpin" : "Pin"}</Button>
                      </div>
                    </div>
                  );
                })}
                {visibleSetupShortcuts.length === 0 && <div className="rounded border border-dashed border-[#d8dde6] p-4 text-center text-sm text-[#706e6b]">No setup shortcuts match this view.</div>}
              </div>
            </div>
          )}
          {kind === "notifications" && (
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="inline-flex rounded border border-[#c9c9c9] bg-white p-0.5 text-xs">
                  {(["all", "unread"] as const).map((filter) => (
                    <button key={filter} className={cn("rounded px-2 py-1 capitalize", notificationFilter === filter && "bg-brand-600 text-white")} onClick={() => setNotificationFilter(filter)}>
                      {filter}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-[#706e6b]">{unreadCount} unread</span>
              </div>
              <FieldShell label="Category">
                <NativeSelect options={availableNotificationCategories} value={notificationCategory} onChange={setNotificationCategory} />
              </FieldShell>
              <div className="mb-2 flex flex-wrap gap-2">
                <Button onClick={() => void markAllNotificationsRead()}>Mark all read</Button>
                <Button onClick={() => void clearReadNotifications()}>Clear read</Button>
                <Button onClick={() => void clearAllNotifications()}>Clear all</Button>
              </div>
              <div className="mb-3 rounded border border-[#d8dde6] p-2">
                <div className="mb-1 text-xs font-semibold uppercase text-[#706e6b]">Notification Settings</div>
                <div className="grid grid-cols-2 gap-1">
                  {notificationCategories.map((category) => (
                    <label key={category} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-[#f8f8f8]">
                      <span>{category}</span>
                      <input type="checkbox" checked={notificationPreferences[category] !== false} onChange={(event) => void updateNotificationPreference(category, event.target.checked)}  className={checkboxClass} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="max-h-80 space-y-2 overflow-auto">
                {visibleNotifications.map((item) => (
                  <div key={String(item.id)} className={cn("rounded border border-[#d8dde6] p-2 text-sm", !item.read && "border-brand-500 bg-brand-50")}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => void openNotification(item)} className="min-w-0 flex-1 text-left">
                        <span className="flex items-center gap-2 font-semibold">
                          {!item.read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                          <span className="truncate">{String(item.title)}</span>
                        </span>
                        <span className="mt-1 block text-xs text-[#706e6b]">{String(item.body)}</span>
                        <span className="mt-1 block text-[11px] uppercase text-[#706e6b]">{String(item.category ?? "General")} {item.createdAt ? `- ${formatDateTime(String(item.createdAt))}` : ""}</span>
                      </button>
                      <button className="rounded p-1 text-[#706e6b] hover:bg-white hover:text-[#ba0517]" aria-label="Delete notification" onClick={() => void deleteNotification(String(item.id))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {visibleNotifications.length === 0 && <div className="rounded border border-dashed border-[#d8dde6] p-4 text-center text-sm text-[#706e6b]">No notifications to show.</div>}
              </div>
            </div>
          )}
          {kind === "profile" && (
            <div className="p-3">
              <div className="flex items-center gap-3 rounded border border-[#d8dde6] bg-[#f8f8f8] p-3">
                {data.user.avatarUrl ? (
                  <AvatarImage src={String(data.user.avatarUrl)} className="h-14 w-14 rounded-full ring-2 ring-white" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">{data.user.alias.slice(0, 2)}</div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{data.user.name}</div>
                  <div className="text-xs text-[#706e6b]">{data.user.alias}</div>
                  <div className="mt-1 text-xs text-[#706e6b]">{locale} - {timezone} - {density}</div>
                </div>
              </div>
              {profileEditing ? (
                <div className="mt-3 grid gap-3">
                  <FieldShell label="Full Name">
                    <input className={inputClass} value={profileName} onChange={(event) => setProfileName(event.target.value)} />
                  </FieldShell>
                  <FieldShell label="Alias">
                    <input className={inputClass} value={profileAlias} maxLength={8} onChange={(event) => setProfileAlias(event.target.value)} />
                  </FieldShell>
                  <FieldShell label="Avatar URL">
                    <input className={inputClass} value={profileAvatarUrl} onChange={(event) => setProfileAvatarUrl(event.target.value)} placeholder="https://..." />
                  </FieldShell>
                  {profileAvatarUrl && (
                    <div className="flex items-center gap-2 rounded border border-[#d8dde6] p-2 text-sm">
                      <AvatarImage src={profileAvatarUrl} className="h-9 w-9 rounded-full" />
                      <span className="text-[#706e6b]">Avatar preview</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => { setProfileName(data.user.name); setProfileAlias(data.user.alias); setProfileAvatarUrl(String(data.user.avatarUrl ?? "")); setProfileEditing(false); }}>Cancel</Button>
                    <Button variant="primary" onClick={() => void saveProfile()}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => setProfileEditing(true)}>Edit Profile</Button>
                    <Button onClick={() => onNavigate("/lightning/app/your-account")}>View Account</Button>
                  </div>
                  <div className="rounded border border-[#d8dde6] p-2">
                    <div className="mb-2 text-xs font-semibold uppercase text-[#706e6b]">Personal Settings</div>
                    <div className="grid gap-2">
                      <FieldShell label="Display Density">
                        <NativeSelect options={["Comfy", "Compact"]} value={density} onChange={(value) => { setDensity(value); void savePreferences({ displayDensity: value }); }} />
                      </FieldShell>
                      <FieldShell label="Timezone">
                        <NativeSelect options={["Asia/Dubai", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London"]} value={timezone} onChange={(value) => { setTimezone(value); void savePreferences({ timezone: value }); }} />
                      </FieldShell>
                      <FieldShell label="Locale">
                        <NativeSelect options={["en-US", "en-GB", "ar-AE", "fr-FR", "de-DE"]} value={locale} onChange={(value) => { setLocale(value); void savePreferences({ locale: value }); }} />
                      </FieldShell>
                      <label className="flex items-center justify-between rounded border border-[#d8dde6] p-2 text-sm">
                        Guidance cards
                        <input type="checkbox" checked={guidanceEnabled} onChange={(event) => { setGuidanceEnabled(event.target.checked); void savePreferences({ guidanceEnabled: event.target.checked }); }}  className={checkboxClass} />
                      </label>
                      <label className="flex items-center justify-between rounded border border-[#d8dde6] p-2 text-sm">
                        Console tabs
                        <input type="checkbox" checked={consoleTabsEnabled} onChange={(event) => { setConsoleTabsEnabled(event.target.checked); void savePreferences({ consoleTabsEnabled: event.target.checked }); }}  className={checkboxClass} />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => onNavigate("/lightning/page/home")}>Switch to Home</Button>
                    <Button onClick={() => onToast({ tone: "warning", message: "You are signed in as the seeded local user. Authentication/session switching is outside this local org." })}>Session Info</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AppNavBar({ data, activeApp, pathname, onEditNav }: { data: BootstrapData; activeApp: AppKey; pathname: string; onEditNav: () => void }) {
  const app = appRail.find((item) => item.key === activeApp)!;
  const AppIcon = app.icon;
  const items = navItemsForApp(activeApp, data);
  const visible = items.slice(0, 7);
  const overflow = items.slice(7);
  return (
    <div className="relative z-10 flex h-11 shrink-0 items-center gap-4 border-b border-[#e4e7ec] bg-white px-3 shadow-header">
      <div className="flex min-w-32 items-center gap-2 font-semibold text-[#181818]">
        <AppIcon size={18} className="text-brand-600" />
        <span>{app.label}</span>
      </div>
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label={`${app.label} navigation`}>
        {visible.map((item) => {
          const active = pathMatches(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-[#181818] transition-colors duration-150 hover:border-brand-500 hover:bg-brand-50/60 hover:text-brand-700",
                "focus-visible:border-brand-500 focus-visible:bg-brand-50/60 focus-visible:text-brand-700",
                active && "border-brand-500 bg-brand-50/40 font-semibold text-brand-700"
              )}
            >
              {item.label}
            </Link>
          );
        })}
        {overflow.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1 rounded px-3 py-2 text-sm transition-colors duration-150 hover:bg-[#f3f3f3] hover:text-brand-700 focus-visible:bg-[#f3f3f3]">
                More <ChevronDown size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-44 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
                {overflow.map((item) => (
                  <DropdownMenu.Item key={item.href} asChild>
                    <Link href={item.href} className="block rounded px-3 py-2 text-sm hover:bg-brand-50">
                      {item.label}
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </nav>
      <button onClick={onEditNav} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-brand-700 transition-colors duration-150 hover:bg-brand-50 focus-visible:bg-brand-50 active:bg-brand-100">
        <Edit3 size={14} />
        Edit nav items
      </button>
    </div>
  );
}

function ConsoleTabs({ tabs, activeHref, onClose }: { tabs: ConsoleTab[]; activeHref: string; onClose: (href: string) => void }) {
  const maxVisibleTabs = 6;
  const activeTab = tabs.find((tab) => tab.href === activeHref);
  const baseVisibleTabs = tabs.length > maxVisibleTabs && activeTab && tabs.indexOf(activeTab) >= maxVisibleTabs
    ? [...tabs.slice(0, maxVisibleTabs - 1), activeTab]
    : tabs.slice(0, maxVisibleTabs);
  const visibleHrefs = new Set(baseVisibleTabs.map((tab) => tab.href));
  const overflowTabs = tabs.filter((tab) => !visibleHrefs.has(tab.href));

  return (
    <div className="flex h-9 shrink-0 items-end gap-1 overflow-hidden border-b border-[#d8dde6] bg-[#f3f3f3] px-2 pt-1">
      {baseVisibleTabs.map((tab) => (
        <div key={tab.href} role="tab" aria-selected={activeHref === tab.href} className={cn("flex h-8 max-w-56 items-center rounded-t border border-[#d8dde6] bg-white text-xs", activeHref === tab.href && "border-b-white font-semibold")}>
          <Link href={tab.href} className="truncate px-3">
            * {tab.label}
          </Link>
          <Link href={consoleTabListHref(tab.href)} className="mr-1 flex h-5 w-5 items-center justify-center rounded text-[#706e6b] hover:bg-[#f3f3f3] hover:text-brand-700" aria-label={`List ${tab.label}`}>
            <List size={12} />
          </Link>
          <button className="mr-1 flex h-5 w-5 items-center justify-center rounded hover:bg-[#f3f3f3]" aria-label={`Close tab ${tab.label}`} onClick={() => onClose(tab.href)}>
            <X size={12} />
          </button>
        </div>
      ))}
      {overflowTabs.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex h-8 items-center gap-1 rounded-t border border-[#d8dde6] bg-white px-3 text-xs hover:bg-[#f8f8f8]" aria-label={`More console tabs, ${overflowTabs.length} hidden`}>
              More <ChevronDown size={12} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 min-w-64 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
              {overflowTabs.map((tab) => (
                <DropdownMenu.Item key={tab.href} asChild>
                  <div className="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-brand-50">
                    <Link href={tab.href} className="min-w-0 flex-1 truncate">
                      * {tab.label}
                    </Link>
                    <Link href={consoleTabListHref(tab.href)} className="flex h-6 w-6 items-center justify-center rounded text-[#706e6b] hover:bg-white hover:text-brand-700" aria-label={`List ${tab.label}`}>
                      <List size={13} />
                    </Link>
                    <button className="flex h-6 w-6 items-center justify-center rounded text-[#706e6b] hover:bg-white hover:text-[#ba0517]" aria-label={`Close tab ${tab.label}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose(tab.href); }}>
                      <X size={13} />
                    </button>
                  </div>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

function ListViewPage({
  object,
  data,
  records,
  recordLabels,
  campaignMembers,
  initialQuery,
  onCreate,
  onEdit,
  onDelete,
  onToast,
  onListAction,
  onSaveRecord,
  onDataChange
}: {
  object: CrmObject;
  data: BootstrapData;
  records: RecordData[];
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  initialQuery: string;
  onCreate: (object: CrmObject) => void;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onToast: (toast: ToastState) => void;
  onListAction: (action: string, object: CrmObject, records: RecordData[], selectedIds: string[]) => void;
  onSaveRecord: SaveRecordHandler;
  onDataChange: BootstrapDataUpdater;
}) {
  const definition = OBJECT_DEFINITIONS[object];
  const objectPreferences = useMemo(() => data.listViewPreferences.filter((item) => item.object === object), [data.listViewPreferences, object]);
  const pinnedPreference = objectPreferences.find((item) => item.pinned);
  const [listView, setListView] = useState(String(pinnedPreference?.viewName ?? definition.defaultList));
  const [display, setDisplay] = useState<"Table" | "Kanban">("Table");
  const [query, setQuery] = useState(initialQuery);
  const [disabledMessage, setDisabledMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sortState, setSortState] = useState<ListSortState>(null);
  const [controlDialog, setControlDialog] = useState<string | null>(null);
  const listViews = useMemo(() => Array.from(new Set([...definition.listViews, ...objectPreferences.map((item) => String(item.viewName))])), [definition.listViews, objectPreferences]);
  const activePreference = objectPreferences.find((item) => item.viewName === listView);
  const activeColumns = columnsForListView(definition, activePreference);
  const activeColumnWidths = columnWidthsForListView(activePreference);
  const activeFilters = filtersForListView(definition, activePreference);
  const chartType = String(activePreference?.chartType ?? "Bar");
  const chartField = String(activePreference?.chartField ?? activeColumns[0]?.key ?? definition.columns[0]?.key ?? "name");
  const activeDefinition = { ...definition, columns: activeColumns };
  const kanbanConfig = kanbanConfigForObject(object);
  const contextualGuidance = guidanceItemForObject(object, data);
  const showContextualGuidance = data.userPreferences[0]?.guidanceEnabled !== false && contextualGuidance && isContextualGuidanceVisible(contextualGuidance);
  const isCustomListView = Boolean(activePreference?.isCustom);
  const isPinned = Boolean(activePreference?.pinned);

  useEffect(() => {
    setListView(String(pinnedPreference?.viewName ?? definition.defaultList));
    setQuery(initialQuery);
    setSelected([]);
    setSortState(null);
    setControlDialog(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, initialQuery]);

  const visibleRecords = useMemo(() => {
    const filteredBySavedFilters = records.filter((record) => activeFilters.every((filter) => recordMatchesListFilter(record, filter)));
    const filtered = filteredBySavedFilters.filter((record) => Object.values(record).join(" ").toLowerCase().includes(query.toLowerCase()));
    if (!sortState) return filtered;
    return [...filtered].sort((a, b) => {
      const comparison = compareRecordValues(a[sortState.key], b[sortState.key]);
      return sortState.direction === "asc" ? comparison : -comparison;
    });
  }, [activeFilters, query, records, sortState]);

  const sortedColumn = sortState ? activeColumns.find((column) => column.key === sortState.key) ?? definition.columns.find((column) => column.key === sortState.key) : activeColumns[0];
  const status = `${visibleRecords.length} ${visibleRecords.length === 1 ? "item" : "items"} - Sorted by ${sortedColumn?.label ?? "Name"}${sortState ? ` ${sortState.direction === "asc" ? "Ascending" : "Descending"}` : ""}${activeFilters.length ? ` - Filtered by ${activeFilters.map((filter) => fieldLabel(String(filter.field))).join(", ")}` : ""} - Updated a few seconds ago`;

  function applyListViewPreferences(nextPreferences: RecordData[]) {
    onDataChange((previous) => ({
      ...previous,
      listViewPreferences: [
        ...previous.listViewPreferences.filter((item) => item.object !== object),
        ...nextPreferences
      ]
    }));
  }

  function handleAction(action: string) {
    if (action === "New" || action === "New Quick Text" || action === "New Event") onCreate(object);
    else if (action === "Send Email") onCreate("ListEmail");
    else if (action === "Refresh") onToast({ tone: "success", message: "List refreshed." });
    else if (action === "Edit List") setControlDialog("Select Fields to Display");
    else if (action === "Charts" || action === "Filters" || action === "List View Controls") setControlDialog(action);
    else onListAction(action, object, visibleRecords, selected);
  }

  function sortColumn(column: string, direction?: "asc" | "desc") {
    if (visibleRecords.length < 1 || definition.columns.length < 2) {
      setDisabledMessage("Column sort is disabled. To sort columns, a list view needs at least one row and two columns.");
      return;
    }
    setDisabledMessage("");
    setSortState((current) => {
      if (direction) return { key: column, direction };
      if (!current || current.key !== column) return { key: column, direction: "asc" };
      if (current.direction === "asc") return { key: column, direction: "desc" };
      return null;
    });
  }

  async function saveListViewPreference(values: { viewName: string; columns: string[]; columnWidths?: Record<string, string>; filters?: RecordData[]; chartType?: string; chartField?: string; pinned?: boolean; isCustom?: boolean; previousViewName?: string }) {
    const response = await postUtility("saveListViewPreference", undefined, {
      object,
      ...values,
      columnWidths: values.columnWidths ?? activeColumnWidths,
      filters: values.filters ?? activeFilters,
      chartType: values.chartType ?? chartType,
      chartField: values.chartField ?? chartField,
      pinned: values.pinned ?? (values.viewName === listView && isPinned)
    });
    if (!Array.isArray(response?.listViewPreferences)) {
      onToast({ tone: "error", message: "List view couldn't be saved." });
      return false;
    }
    applyListViewPreferences(response.listViewPreferences as RecordData[]);
    setListView(values.viewName);
    setControlDialog(null);
    onToast({ tone: "success", message: `List view "${values.viewName}" saved.` });
    return true;
  }

  async function pinListView() {
    const response = await postUtility("pinListViewPreference", undefined, {
      object,
      viewName: listView,
      columns: activeColumns.map((column) => column.key),
      columnWidths: activeColumnWidths,
      filters: activeFilters,
      chartType,
      chartField,
      isCustom: isCustomListView
    });
    if (!Array.isArray(response?.listViewPreferences)) {
      onToast({ tone: "error", message: "List view couldn't be pinned." });
      return;
    }
    applyListViewPreferences(response.listViewPreferences as RecordData[]);
    onToast({ tone: "success", message: `"${listView}" is now pinned.` });
  }

  async function deleteListViewPreference() {
    const response = await postUtility("deleteListViewPreference", undefined, { object, viewName: listView });
    if (!Array.isArray(response?.listViewPreferences)) {
      onToast({ tone: "error", message: "List view couldn't be deleted." });
      return false;
    }
    applyListViewPreferences(response.listViewPreferences as RecordData[]);
    setListView(definition.defaultList);
    setControlDialog(null);
    onToast({ tone: "success", message: `List view "${listView}" deleted.` });
    return true;
  }

  function handleListViewControl(action: string) {
    if (action === "Reset Column Sorting") {
      setSortState(null);
      onToast({ tone: "success", message: "Column sorting reset." });
      return;
    }
    if (action === "Reset Column Widths") {
      void saveListViewPreference({ viewName: listView, columns: activeColumns.map((column) => column.key), columnWidths: {}, isCustom: isCustomListView }).then((saved) => {
        if (saved) onToast({ tone: "success", message: "Column widths reset." });
      });
      return;
    }
    setControlDialog(action);
  }

  async function hideColumn(columnKey: string) {
    if (activeColumns.length <= 1) {
      onToast({ tone: "warning", message: "At least one column must remain visible." });
      return;
    }
    const columns = activeColumns.map((column) => column.key).filter((key) => key !== columnKey);
    const saved = await saveListViewPreference({ viewName: listView, columns, columnWidths: activeColumnWidths, isCustom: isCustomListView });
    if (saved) onToast({ tone: "success", message: "Column hidden." });
  }

  async function resizeColumn(columnKey: string, width: number) {
    const nextWidths = { ...activeColumnWidths, [columnKey]: `${Math.max(110, Math.min(520, Math.round(width)))}px` };
    await saveListViewPreference({ viewName: listView, columns: activeColumns.map((column) => column.key), columnWidths: nextWidths, isCustom: isCustomListView });
  }

  async function resetColumnWidth(columnKey: string) {
    const nextWidths = { ...activeColumnWidths };
    delete nextWidths[columnKey];
    const saved = await saveListViewPreference({ viewName: listView, columns: activeColumns.map((column) => column.key), columnWidths: nextWidths, isCustom: isCustomListView });
    if (saved) onToast({ tone: "success", message: "Column width reset." });
  }

  async function moveKanbanRecord(record: RecordData, value: string) {
    const id = requiredId(record);
    if (!kanbanConfig || !id || String(record[kanbanConfig.field] ?? "") === value) return false;
    return onSaveRecord(object, { [kanbanConfig.field]: value }, { id, stayOpen: true });
  }

  async function updateContextualGuidance(status: string, snoozedUntil?: string | null) {
    if (!contextualGuidance?.id) return false;
    const response = await postUtility("updateGuidance", String(contextualGuidance.id), { status, snoozedUntil });
    const state = response?.state as RecordData | undefined;
    if (!state?.id) {
      onToast({ tone: "error", message: "Guidance state couldn't be saved." });
      return false;
    }
    onDataChange((previous) => ({
      ...previous,
      guidanceStates: previous.guidanceStates.some((item) => item.id === state.id)
        ? previous.guidanceStates.map((item) => (item.id === state.id ? state : item))
        : [state, ...previous.guidanceStates]
    }));
    return true;
  }

  async function addSampleLeadFromGuidance() {
    if (object !== "Lead") return;
    const suffix = Date.now().toString().slice(-5);
    const saved = await onSaveRecord(
      "Lead",
      {
        firstName: "Avery",
        lastName: `Sample ${suffix}`,
        company: "Sample Lead Co",
        title: "Operations Buyer",
        status: "New",
        rating: "Warm",
        phone: "+1 555 0142",
        email: `avery.sample.${suffix}@example.test`,
        leadSource: "Web",
        ownerId: data.user.id
      },
      { stayOpen: true }
    );
    if (saved) {
      await updateContextualGuidance("DONE", null);
      onToast({ tone: "success", message: "Sample lead added and guidance completed." });
    }
  }

  if (object === "QuickText") return <QuickTextPage data={data} onCreate={() => onCreate("QuickText")} onCreateFolder={() => onListAction("New Folder", object, visibleRecords, selected)} onDelete={(record) => onDelete("QuickText", record)} />;

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dde6] p-3">
          <div className="flex items-start gap-3">
            <ObjectIcon definition={definition} />
            <div>
              <div className="text-xs text-[#706e6b]">{definition.plural}</div>
              <div className="flex items-center gap-2">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="flex items-center gap-1 text-xl font-semibold text-[#181818]" aria-label={`Select a List View: ${definition.plural}`}>
                      {listView} <ChevronDown size={16} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="z-50 w-72 rounded border border-[#d8dde6] bg-white p-2 shadow-popover">
                      <input className={cn(inputClass, "mb-2")} placeholder="Search lists..." />
                      <div className="px-2 py-1 text-xs font-semibold uppercase text-[#706e6b]">Recent List Views</div>
                      {listViews.slice(0, 2).map((view) => (
                        <DropdownMenu.Item key={view} onSelect={() => setListView(view)} className="cursor-pointer rounded px-2 py-2 text-sm hover:bg-brand-50">
                          {view}
                        </DropdownMenu.Item>
                      ))}
                      <div className="px-2 py-1 text-xs font-semibold uppercase text-[#706e6b]">All Other Lists</div>
                      {listViews.slice(2).map((view) => (
                        <DropdownMenu.Item key={view} onSelect={() => setListView(view)} className="cursor-pointer rounded px-2 py-2 text-sm hover:bg-brand-50">
                          {view}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <button className="flex h-7 w-7 items-center justify-center rounded text-brand-700 hover:bg-brand-50" aria-label={isPinned ? "This list is pinned." : "Pin this list view."} onClick={() => void pinListView()}>
                  <Pin size={15} fill={isPinned ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {definition.actions.map((action) => (
              <Button key={action} variant={action === "New" || action === "New Quick Text" || action === "Send Email" ? "primary" : "secondary"} onClick={() => handleAction(action)}>
                {action === "New" && <Plus size={14} />}
                {action}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="text-xs text-[#706e6b]">{status}</div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 items-center rounded border border-[#c9c9c9] bg-white px-2">
              <Search size={14} className="text-[#706e6b]" />
              <input name={definition.searchInputName} value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputBareClass, "w-56")} placeholder="Search this list..." />
            </div>
            <ListViewControlsMenu object={object} listView={listView} isCustom={isCustomListView} onAction={handleListViewControl} />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex h-8 items-center gap-1 rounded border border-[#c9c9c9] px-2 text-xs hover:bg-[#f3f3f3]" aria-label="Select list display">
                  <Columns3 size={14} />
                  {display}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
                  {["Table", "Kanban"].map((mode) => (
                    <DropdownMenu.Item key={mode} onSelect={() => setDisplay(mode as "Table" | "Kanban")} className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-brand-50">
                      {mode}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <ToolbarButton label="Refresh" icon={RefreshCw} onClick={() => onToast({ tone: "success", message: "List refreshed." })} />
            <ToolbarButton
              label="Column sort"
              icon={ChevronsUpDown}
              disabled={visibleRecords.length < 1 || activeColumns.length < 2}
              disabledReason="Column sort is disabled. To sort columns, a list view needs at least one row and two columns."
              onClick={() => sortColumn(activeColumns[0]?.key ?? "name")}
            />
            <ToolbarButton label="Edit List" icon={Edit3} onClick={() => setControlDialog("Select Fields to Display")} />
            <ToolbarButton label="Charts" icon={LayoutDashboard} onClick={() => setControlDialog("Charts")} />
            <ToolbarButton label="Filters" icon={Filter} onClick={() => setControlDialog("Filters")} />
          </div>
        </div>
        {disabledMessage && <div className="mx-3 mb-2 rounded border border-[#f1c40f] bg-[#fff7d6] px-3 py-2 text-xs text-[#5f4b00]">{disabledMessage}</div>}
        {definition.disabledInlineEditMessage && <div className="mx-3 mb-2 rounded border border-[#d8dde6] bg-[#f8f8f8] px-3 py-2 text-xs text-[#706e6b]">{definition.disabledInlineEditMessage}</div>}
        {display === "Kanban" && kanbanConfig ? (
          <KanbanBoard
            definition={activeDefinition}
            records={visibleRecords}
            config={kanbanConfig}
            onMove={moveKanbanRecord}
            onEdit={onEdit}
            onDelete={onDelete}
            onChangeOwner={(record) => onListAction("Change Owner", object, [record], [requiredId(record)])}
          />
        ) : display === "Kanban" ? (
          <KanbanUnavailable definition={definition} records={visibleRecords} />
        ) : (
          <DataGrid
            definition={activeDefinition}
            records={visibleRecords}
            selected={selected}
            recordLabels={recordLabels}
            campaignMembers={campaignMembers}
            onSelect={setSelected}
            sortState={sortState}
            onSort={sortColumn}
            onHideColumn={(columnKey) => void hideColumn(columnKey)}
            onResizeColumn={(columnKey, width) => void resizeColumn(columnKey, width)}
            onResetColumnWidth={(columnKey) => void resetColumnWidth(columnKey)}
            onEdit={onEdit}
            onDelete={onDelete}
            onChangeOwner={(record) => onListAction("Change Owner", object, [record], [requiredId(record)])}
          />
        )}
      </div>
      {visibleRecords.length === 0 && <EmptyState definition={definition} onCreate={() => onCreate(object)} />}
      {showContextualGuidance && (
        <GuidanceCard
          title={String(contextualGuidance?.title ?? "Add a lead")}
          body={String(contextualGuidance?.body ?? "First enter and save a few details about the lead. You can add a sample lead, snooze this guidance, drag it, or dismiss it.")}
          onSnooze={() => void updateContextualGuidance("SNOOZED", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}
          onDismiss={() => void updateContextualGuidance("DISMISSED", null)}
          onComplete={object === "Lead" ? () => void addSampleLeadFromGuidance() : undefined}
        />
      )}
      {controlDialog && (
        <ListViewPreferenceModal
          action={controlDialog}
          definition={definition}
          listView={listView}
          activeColumns={activeColumns.map((column) => column.key)}
          columnWidths={activeColumnWidths}
          activeFilters={activeFilters}
          records={visibleRecords}
          chartType={chartType}
          chartField={chartField}
          isCustom={isCustomListView}
          onClose={() => setControlDialog(null)}
          onSave={saveListViewPreference}
          onDelete={deleteListViewPreference}
          onControlAction={handleListViewControl}
        />
      )}
    </section>
  );
}

function ListViewPreferenceModal({
  action,
  definition,
  listView,
  activeColumns,
  columnWidths,
  activeFilters,
  records,
  chartType,
  chartField,
  isCustom,
  onClose,
  onSave,
  onDelete,
  onControlAction
}: {
  action: string;
  definition: ObjectDefinition;
  listView: string;
  activeColumns: string[];
  columnWidths: Record<string, string>;
  activeFilters: RecordData[];
  records: RecordData[];
  chartType: string;
  chartField: string;
  isCustom: boolean;
  onClose: () => void;
  onSave: (values: { viewName: string; columns: string[]; columnWidths?: Record<string, string>; filters?: RecordData[]; chartType?: string; chartField?: string; pinned?: boolean; isCustom?: boolean; previousViewName?: string }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onControlAction?: (action: string) => void;
}) {
  const defaultName = action === "New" ? `New ${definition.label} List` : action === "Clone" ? `${listView} Clone` : listView;
  const [viewName, setViewName] = useState(defaultName);
  const [columns, setColumns] = useState<string[]>(activeColumns.length ? activeColumns : definition.columns.map((column) => column.key));
  const [filters, setFilters] = useState<RecordData[]>(activeFilters.length ? activeFilters : [{ field: definition.columns[0]?.key ?? "name", operator: "contains", value: "" }]);
  const [selectedChartType, setSelectedChartType] = useState(chartType);
  const [selectedChartField, setSelectedChartField] = useState(chartField);
  const [error, setError] = useState("");
  const isFieldAction = action === "Select Fields to Display" || action === "New" || action === "Clone" || action === "Rename";
  const chartRows = chartDataForRecords(records, selectedChartField);

  function toggleColumn(column: string) {
    setColumns((current) => (current.includes(column) ? current.filter((item) => item !== column) : [...current, column]));
  }

  async function submit() {
    if ((action === "New" || action === "Clone" || action === "Rename") && !viewName.trim()) {
      setError("Complete this field.");
      return;
    }
    if (columns.length === 0) {
      setError("Select at least one field.");
      return;
    }
    const targetName = action === "Select Fields to Display" ? listView : viewName.trim();
    await onSave({
      viewName: targetName,
      columns,
      columnWidths,
      isCustom: action === "New" || action === "Clone" || (action === "Rename" ? isCustom : isCustom),
      previousViewName: action === "Rename" && isCustom && targetName !== listView ? listView : undefined
    });
  }

  async function saveFilters() {
    const cleanFilters = filters
      .map((filter) => ({ field: String(filter.field ?? ""), operator: String(filter.operator ?? "contains"), value: String(filter.value ?? "") }))
      .filter((filter) => filter.field && (filter.operator === "is-empty" || filter.value));
    await onSave({ viewName: listView, columns, columnWidths, filters: cleanFilters, isCustom });
  }

  async function saveChart() {
    await onSave({ viewName: listView, columns, columnWidths, filters: activeFilters, chartType: selectedChartType, chartField: selectedChartField, isCustom });
  }

  if (action === "Delete") {
    return (
      <BaseDialog open title={`Delete ${listView}?`} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={() => void onDelete()}>Delete</Button></>}>
        <p className="text-sm text-[#444]">This removes the custom list view for you. Records in the list are not deleted.</p>
      </BaseDialog>
    );
  }

  if (action === "Sharing Settings") {
    return (
      <BaseDialog open title="Sharing Settings" onClose={onClose} footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={onClose}>Done</Button></>}>
        <div className="space-y-3 text-sm">
          <p className="text-[#706e6b]">Choose who can see this list view.</p>
          {["Only I can see this list view", "All users can see this list view", "Share with groups of users"].map((option, index) => (
            <label key={option} className="flex items-center gap-2 rounded border border-[#d8dde6] p-2">
              <input type="radio" name="list-sharing" defaultChecked={index === 0} />
              {option}
            </label>
          ))}
        </div>
      </BaseDialog>
    );
  }

  if (action === "List View Controls") {
    const controls = listViewControlItems(definition.object, listView, isCustom);
    return (
      <BaseDialog open title="List View Controls" onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
        <div className="space-y-3">
          <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-3 text-sm">
            <div className="font-semibold">{listView}</div>
            <div className="text-xs text-[#706e6b]">{definition.plural} list view tools</div>
          </div>
          <div className="grid gap-2">
            {controls.map((item) => (
              <button
                key={item.label}
                disabled={!item.enabled}
                onClick={() => item.enabled && onControlAction?.(item.label)}
                className="flex items-center justify-between gap-3 rounded border border-[#d8dde6] p-3 text-left text-sm hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:bg-[#f8f8f8] disabled:text-[#a8a8a8] disabled:hover:border-[#d8dde6]"
              >
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-[#706e6b]">{item.description}</span>
                </span>
                <ChevronRight size={15} className="shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </BaseDialog>
    );
  }

  if (action === "Filters") {
    return (
      <BaseDialog open title="Filters" onClose={onClose} wide footer={<><Button onClick={onClose}>Cancel</Button><Button onClick={() => setFilters([{ field: definition.columns[0]?.key ?? "name", operator: "contains", value: "" }])}>Reset</Button><Button variant="primary" onClick={() => void saveFilters()}>Save Filters</Button></>}>
        <div className="space-y-3">
          {filters.map((filter, index) => (
            <div key={index} className="grid gap-2 rounded border border-[#d8dde6] p-3 md:grid-cols-[1fr_160px_1fr_auto]">
              <NativeSelect
                options={definition.columns.map((column) => ({ value: column.key, label: column.label }))}
                value={String(filter.field ?? "")}
                onChange={(next) => setFilters((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, field: next } : item)))}
              />
              <NativeSelect
                options={[
                  { value: "contains", label: "Contains" },
                  { value: "equals", label: "Equals" },
                  { value: "not-equals", label: "Not equal to" },
                  { value: "starts-with", label: "Starts with" },
                  { value: "is-empty", label: "Is empty" }
                ]}
                value={String(filter.operator ?? "contains")}
                onChange={(next) => setFilters((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, operator: next } : item)))}
              />
              <input className={inputClass} value={String(filter.value ?? "")} disabled={filter.operator === "is-empty"} onChange={(event) => setFilters((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))} placeholder="Filter value" />
              <button className="rounded p-2 text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#ba0517]" aria-label="Remove filter" onClick={() => setFilters((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <Button onClick={() => setFilters((current) => [...current, { field: definition.columns[0]?.key ?? "name", operator: "contains", value: "" }])}>Add Filter</Button>
        </div>
      </BaseDialog>
    );
  }

  if (action === "Charts") {
    const maxCount = Math.max(1, ...chartRows.map((row) => row.count));
    return (
      <BaseDialog open title="Charts" onClose={onClose} wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void saveChart()}>Save Chart</Button></>}>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="grid gap-3 self-start rounded border border-[#d8dde6] p-3">
            <FieldShell label="Chart Type">
              <NativeSelect options={["Bar", "Donut", "Metric"]} value={selectedChartType} onChange={setSelectedChartType} />
            </FieldShell>
            <FieldShell label="Group By">
              <NativeSelect options={definition.columns.map((column) => column.key)} value={selectedChartField} onChange={setSelectedChartField} />
            </FieldShell>
            <div className="text-xs text-[#706e6b]">Showing {records.length} record{records.length === 1 ? "" : "s"} after search and filters.</div>
          </div>
          <div className="rounded border border-[#d8dde6] p-4">
            <div className="mb-3 font-semibold">{definition.plural} by {fieldLabel(selectedChartField)}</div>
            {selectedChartType === "Metric" ? (
              <div className="rounded bg-brand-50 p-6 text-center">
                <div className="text-4xl font-semibold text-brand-700">{records.length}</div>
                <div className="text-sm text-[#706e6b]">Total records in current result</div>
              </div>
            ) : (
              <div className="space-y-2">
                {chartRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[140px_1fr_40px] items-center gap-2 text-sm">
                    <div className="truncate text-[#514f4d]">{row.label}</div>
                    <div className="h-5 rounded bg-[#eef1f6]">
                      <div className={cn("h-5 rounded bg-brand-500", selectedChartType === "Donut" && "rounded-full")} style={{ width: `${Math.max(8, (row.count / maxCount) * 100)}%` }} />
                    </div>
                    <div className="text-right font-semibold">{row.count}</div>
                  </div>
                ))}
                {chartRows.length === 0 && <div className="rounded border border-dashed border-[#d8dde6] p-6 text-center text-sm text-[#706e6b]">No records match the current filters.</div>}
              </div>
            )}
          </div>
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog
      open
      title={action === "Select Fields to Display" ? "Select Fields to Display" : `${action} List View`}
      onClose={onClose}
      wide
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void submit()}>Save</Button></>}
    >
      <div className="grid gap-4">
        {(action === "New" || action === "Clone" || action === "Rename") && (
          <FieldShell label="List Name" required error={error}>
            <input className={inputClass} value={viewName} onChange={(event) => setViewName(event.target.value)} />
          </FieldShell>
        )}
        {isFieldAction && (
          <div>
            <div className="mb-2 text-sm font-semibold">Visible Fields</div>
            <div className="grid gap-2 md:grid-cols-2">
              {definition.columns.map((column) => (
                <label key={column.key} className="flex items-center gap-2 rounded border border-[#d8dde6] p-2 text-sm">
                  <input type="checkbox" checked={columns.includes(column.key)} onChange={() => toggleColumn(column.key)}  className={checkboxClass} />
                  {column.label}
                </label>
              ))}
            </div>
            {error && !(action === "New" || action === "Clone" || action === "Rename") && <p className="mt-2 text-xs text-[#ba0517]">{error}</p>}
          </div>
        )}
      </div>
    </BaseDialog>
  );
}

function DataGrid({
  definition,
  records,
  selected,
  sortState,
  recordLabels = {},
  campaignMembers = {},
  onSelect,
  onSort,
  onHideColumn,
  onResizeColumn,
  onResetColumnWidth,
  onEdit,
  onDelete,
  onChangeOwner
}: {
  definition: ObjectDefinition;
  records: RecordData[];
  selected: string[];
  sortState?: ListSortState;
  recordLabels?: Record<string, string[]>;
  campaignMembers?: Record<string, string[]>;
  onSelect: (selected: string[]) => void;
  onSort: (column: string, direction?: "asc" | "desc") => void;
  onHideColumn?: (column: string) => void;
  onResizeColumn?: (column: string, width: number) => void;
  onResetColumnWidth?: (column: string) => void;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onChangeOwner?: (record: RecordData) => void;
}) {
  const allSelected = records.length > 0 && selected.length === records.length;

  function startColumnResize(column: ObjectDefinition["columns"][number], event: ReactPointerEvent<HTMLButtonElement>) {
    if (!onResizeColumn) return;
    const resizeColumn: NonNullable<typeof onResizeColumn> = onResizeColumn;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = parseColumnWidth(column.width);
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    target.setPointerCapture(pointerId);

    function move(moveEvent: PointerEvent) {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      target.style.setProperty("--resize-preview-width", `${Math.max(110, Math.min(520, nextWidth))}px`);
    }

    function up(upEvent: PointerEvent) {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      resizeColumn(column.key, startWidth + upEvent.clientX - startX);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-t border-[#d8dde6] text-sm">
        <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
          <tr>
            <th className="w-10 border-r border-[#d8dde6] px-3 py-2 text-left">
              <input className={checkboxClass}
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onSelect(event.target.checked ? records.map((record) => requiredId(record)) : [])}
                aria-label={`Select all ${definition.plural}`}
              />
            </th>
            {definition.columns.map((column) => (
              <th key={column.key} className="border-r border-[#d8dde6] px-3 py-2 text-left" style={{ minWidth: column.width ?? "150px", width: column.width ?? "150px" }}>
                <div className="flex items-center justify-between gap-2">
                  <button className="flex items-center gap-1 font-semibold hover:text-brand-700" onClick={() => onSort(column.key)}>
                    {column.label}
                    <ChevronsUpDown size={12} className={cn(sortState?.key === column.key && "text-brand-700")} />
                  </button>
                  <div className="flex items-center gap-1">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button aria-label={`Show ${column.label} column actions`} className="rounded p-1 hover:bg-white">
                          <ChevronDown size={12} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
                          <DropdownMenu.Item onSelect={() => onSort(column.key, "asc")} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Sort Ascending</DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => onSort(column.key, "desc")} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Sort Descending</DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => onResetColumnWidth?.(column.key)} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Reset Column Width</DropdownMenu.Item>
                          <DropdownMenu.Item disabled={definition.columns.length <= 1} onSelect={() => onHideColumn?.(column.key)} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50 data-[disabled]:cursor-not-allowed data-[disabled]:text-[#a8a8a8]">Hide Column</DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <button
                      aria-label={`Resize ${column.label} column`}
                      className="grid-resize-handle h-5 w-1 rounded bg-[#dddbda] hover:bg-brand-500 focus:bg-brand-500 focus:outline-none"
                      onPointerDown={(event) => startColumnResize(column, event)}
                    />
                  </div>
                </div>
              </th>
            ))}
            <th className="w-16 px-3 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={requiredId(record)} className="border-t border-[#e9edf2] bg-white transition-colors duration-100 hover:bg-brand-50/50">
              <td className="border-r border-[#eef1f6] px-3 py-2">
                <input className={checkboxClass}
                  type="checkbox"
                  checked={selected.includes(requiredId(record))}
                  onChange={(event) => onSelect(event.target.checked ? [...selected, requiredId(record)] : selected.filter((id) => id !== requiredId(record)))}
                  aria-label={`Select ${recordTitle(definition.object, record)}`}
                />
              </td>
              {definition.columns.map((column, columnIndex) => {
                const value = formatCell(record[column.key]);
                const labels = recordLabels[requiredId(record)] ?? [];
                const campaigns = campaignMembers[requiredId(record)] ?? [];
                return (
                  <td key={column.key} className="border-r border-[#eef1f6] px-3 py-2" style={{ minWidth: column.width ?? "150px", width: column.width ?? "150px" }}>
                    <div>
                      <div className="flex items-center gap-2">
                        {column.link && canRouteToRecord(definition.object) ? (
                          <Link href={routeForRecord(definition.object, requiredId(record))} className="truncate text-brand-700 hover:underline">
                            {value || "-"}
                          </Link>
                        ) : (
                          <span className="truncate">{value || "-"}</span>
                        )}
                        {column.editable && (
                          <button aria-label={`Edit ${column.label}`} className="ml-auto rounded p-1 text-[#706e6b] hover:bg-white hover:text-brand-700" onClick={() => onEdit(definition.object, record)}>
                            <Edit3 size={12} />
                          </button>
                        )}
                      </div>
                      {columnIndex === 0 && (labels.length > 0 || campaigns.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {labels.map((label) => <span key={`label-${label}`} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700">{label}</span>)}
                          {campaigns.map((campaign) => <span key={`campaign-${campaign}`} className="rounded bg-[#f3f3f3] px-1.5 py-0.5 text-[11px] text-[#514f4d]">{campaign}</span>)}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="px-3 py-2">
                <RowActions object={definition.object} record={record} onEdit={onEdit} onDelete={onDelete} onChangeOwner={onChangeOwner} />
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={definition.columns.length + 2} className="h-24 text-center text-sm text-[#706e6b]">
                Nothing to see here
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ object, record, onEdit, onDelete, onChangeOwner }: { object: CrmObject; record: RecordData; onEdit: (object: CrmObject, record: RecordData) => void; onDelete: (object: CrmObject, record: RecordData) => void; onChangeOwner?: (record: RecordData) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3]" aria-label="Show Actions">
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="z-50 min-w-36 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
          {canRouteToRecord(object) && (
            <DropdownMenu.Item asChild>
              <Link href={routeForRecord(object, requiredId(record))} className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-brand-50">
                <Eye size={14} /> View
              </Link>
            </DropdownMenu.Item>
          )}
          {canEditFromRow(object) && (
            <DropdownMenu.Item onSelect={() => onEdit(object, record)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-brand-50">
              <Edit3 size={14} /> Edit
            </DropdownMenu.Item>
          )}
          {canDeleteFromRow(object) && (
            <DropdownMenu.Item onSelect={() => onDelete(object, record)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-[#ba0517] hover:bg-[#fff1f1]">
              <Trash2 size={14} /> Delete
            </DropdownMenu.Item>
          )}
          {canChangeOwnerFromRow(object) && onChangeOwner && (
            <DropdownMenu.Item onSelect={() => onChangeOwner(record)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-brand-50">Change Owner</DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function EmptyState({ definition, onCreate }: { definition: ObjectDefinition; onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <PanelLeft size={28} />
      </div>
      <h2 className="text-lg font-semibold">{definition.emptyTitle ?? "Nothing to see here"}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#706e6b]">{definition.emptyBody ?? "There's nothing in your list yet. Try adding a new record."}</p>
      {definition.supportsNew && (
        <Button className="mt-4" variant="primary" onClick={onCreate}>
          <Plus size={14} /> New
        </Button>
      )}
    </div>
  );
}

function KanbanBoard({
  definition,
  records,
  config,
  onMove,
  onEdit,
  onDelete,
  onChangeOwner
}: {
  definition: ObjectDefinition;
  records: RecordData[];
  config: KanbanConfig;
  onMove: (record: RecordData, value: string) => Promise<boolean>;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onChangeOwner?: (record: RecordData) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const titleColumn = definition.columns[0]?.key;
  const detailColumns = definition.columns.filter((column) => column.key !== titleColumn && column.key !== config.field).slice(0, 3);
  const groupedRecords = useMemo(() => groupBy(records, (record) => String(record[config.field] ?? "")), [config.field, records]);
  const ungroupedRecords = records.filter((record) => !config.values.includes(String(record[config.field] ?? "")));
  const columns = [
    ...config.values.map((value) => ({ key: value, label: value, value, records: groupedRecords[value] ?? [], acceptsDrop: true })),
    ...(ungroupedRecords.length > 0 ? [{ key: "__none__", label: `No ${config.label}`, value: "", records: ungroupedRecords, acceptsDrop: false }] : [])
  ];

  async function commitMove(record: RecordData, value: string) {
    const id = requiredId(record);
    if (!id || movingId) return;
    setMovingId(id);
    try {
      await onMove(record, value);
    } finally {
      setMovingId(null);
    }
  }

  function handleDrop(value: string, acceptsDrop: boolean) {
    if (!acceptsDrop || !draggedId) return;
    const record = records.find((item) => requiredId(item) === draggedId);
    if (record) void commitMove(record, value);
    setDraggedId(null);
  }

  if (records.length === 0) {
    return (
      <div className="border-t border-[#d8dde6] p-8 text-center text-sm text-[#706e6b]">
        No records match this list view.
      </div>
    );
  }

  return (
    <div className="slds-scrollbar flex min-h-[28rem] gap-3 overflow-x-auto border-t border-[#d8dde6] bg-[#f3f3f3] p-3">
      {columns.map((column) => {
        const summary = config.summaryField ? column.records.reduce((total, record) => total + numberFromRecord(record[config.summaryField!]), 0) : null;
        return (
          <section
            key={column.key}
            className={cn("flex w-72 shrink-0 flex-col rounded-lg border border-[#e4e7ec] bg-[#f8f9fb] shadow-card transition-shadow duration-150", draggedId && column.acceptsDrop && "ring-2 ring-brand-400/70 ring-offset-1")}
            onDragOver={(event) => {
              if (column.acceptsDrop) event.preventDefault();
            }}
            onDrop={() => handleDrop(column.value, column.acceptsDrop)}
            aria-label={`${column.label} ${config.label}`}
          >
            <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[#d8dde6] bg-white px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#181818]">{column.label}</div>
                <div className="text-xs text-[#706e6b]">
                  {column.records.length} {column.records.length === 1 ? "record" : "records"}
                </div>
              </div>
              {summary !== null && <div className="shrink-0 text-xs font-semibold text-[#2e844a]">{formatKanbanSummary(summary)}</div>}
            </div>
            <div className="slds-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2" role="list">
              {column.records.map((record) => {
                const id = requiredId(record);
                const currentValue = String(record[config.field] ?? "");
                const isMoving = movingId === id;
                return (
                  <article
                    key={id}
                    role="listitem"
                    draggable={!isMoving}
                    onDragStart={() => setDraggedId(id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={cn("cursor-grab rounded-md border border-[#e4e7ec] bg-white p-2 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover active:cursor-grabbing", draggedId === id && "rotate-1 scale-[1.02] opacity-70 shadow-card-hover", isMoving && "opacity-70")}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="mt-0.5 shrink-0 text-[#706e6b]" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-brand-700">{recordTitle(definition.object, record)}</div>
                        <div className="mt-1 space-y-1">
                          {detailColumns.map((columnDefinition) => (
                            <div key={columnDefinition.key} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-xs">
                              <span className="truncate text-[#706e6b]">{columnDefinition.label}</span>
                              <span className="truncate text-[#181818]">{formatCell(record[columnDefinition.key]) || "-"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <RowActions object={definition.object} record={record} onEdit={onEdit} onDelete={onDelete} onChangeOwner={onChangeOwner} />
                    </div>
                    <label className="mt-3 block text-xs text-[#706e6b]">
                      {config.label}
                      <NativeSelect
                        className="mt-1"
                        value={currentValue}
                        disabled={isMoving}
                        options={[
                          ...(!config.values.includes(currentValue) ? [{ value: currentValue, label: currentValue || `No ${config.label}` }] : []),
                          ...config.values
                        ]}
                        onChange={(next) => void commitMove(record, next)}
                        aria-label={`Move ${recordTitle(definition.object, record)} by ${config.label}`}
                      />
                    </label>
                  </article>
                );
              })}
              {column.records.length === 0 && (
                <div className="flex h-24 items-center justify-center rounded border border-dashed border-[#c9c9c9] bg-white/70 text-xs text-[#706e6b]">
                  Drop records here
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KanbanUnavailable({ definition, records }: { definition: ObjectDefinition; records: RecordData[] }) {
  if (records.length === 0) {
    return (
      <div className="border-t border-[#d8dde6] p-8 text-center text-sm text-[#706e6b]">
        Kanban is available from the display selector, but this list needs records before a board can be shown.
      </div>
    );
  }
  return (
    <div className="border-t border-[#d8dde6] p-8 text-center text-sm text-[#706e6b]">
      Kanban grouping is not configured for {definition.plural}.
    </div>
  );
}

function RecordPage({
  object,
  record,
  data,
  onCreate,
  onEdit,
  onDelete,
  onChangeOwner,
  onRecordEdit,
  onRecordDelete,
  onSaveActivity,
  onSaveFile,
  onOpenEvent,
  onDataChange,
  onToast,
  labels,
  campaigns
}: {
  object: "Account" | "Contact";
  record: RecordData;
  data: BootstrapData;
  onCreate: (object: CrmObject) => void;
  onEdit: () => void;
  onDelete: () => void;
  onChangeOwner: () => void;
  onRecordEdit: (object: CrmObject, record: RecordData) => void;
  onRecordDelete: (object: CrmObject, record: RecordData) => void;
  onSaveActivity: (activity: RecordData) => Promise<void>;
  onSaveFile: (file: RecordData, attachment?: boolean) => Promise<void>;
  onOpenEvent: () => void;
  onDataChange: BootstrapDataUpdater;
  onToast: (toast: ToastState) => void;
  labels: string[];
  campaigns: string[];
}) {
  const definition = OBJECT_DEFINITIONS[object];
  const title = recordTitle(object, record);
  const [dialog, setDialog] = useState<RecordPageDialog | null>(null);
  const keyFields: Array<[string, unknown]> =
    object === "Account"
      ? [
          ["Phone", record.phone],
          ["Website", record.website],
          ["Billing Address", addressValue(record, "billing")],
          ["Account Owner", record.ownerName]
        ]
      : [
          ["Account Name", record.accountName],
          ["Title", record.title],
          ["Phone", record.phone],
          ["Email", record.email]
        ];

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dde6] p-3">
            <div className="flex items-start gap-3">
              <ObjectIcon definition={definition} />
              <div>
                <div className="text-xs text-[#706e6b]">{definition.label}</div>
                <h1 className="text-xl font-semibold">
                  {definition.label} {title}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button onClick={() => setDialog({ type: "hierarchy" })}>{object === "Account" ? "View Account Hierarchy" : "View Contact Hierarchy"}</Button>
              {object === "Account" && <Button onClick={() => onCreate("Contact")}>New Contact</Button>}
              <Button onClick={() => onCreate("Opportunity")}>New Opportunity</Button>
              <Button onClick={onEdit}>Edit</Button>
              {object === "Contact" ? <Button onClick={onDelete}>Delete</Button> : (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]">
                      Show more actions <ChevronDown size={13} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="end" className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
                      <DropdownMenu.Item onSelect={() => setDialog({ type: "partner" })} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">New Partner</DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={onChangeOwner} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Change Owner</DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={() => window.print()} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Printable View</DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={onDelete} className="cursor-pointer rounded px-3 py-2 text-[#ba0517] hover:bg-[#fff1f1]">Delete Account</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}
            </div>
          </div>
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {keyFields.map(([label, value]) => (
              <div key={label} className="min-h-12">
                <div className="text-xs text-[#706e6b]">{label}</div>
                <div className="truncate text-sm">{formatCell(value) || "-"}</div>
              </div>
            ))}
          </div>
          {(labels.length > 0 || campaigns.length > 0) && (
            <div className="border-t border-[#d8dde6] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-[#706e6b]">Workspace tags</span>
                {labels.map((label) => <span key={label} className="rounded bg-brand-50 px-2 py-1 text-brand-700">{label}</span>)}
                {campaigns.map((campaign) => <span key={campaign} className="rounded bg-[#f3f3f3] px-2 py-1 text-[#514f4d]">{campaign}</span>)}
              </div>
            </div>
          )}
        </div>
        <Tabs.Root defaultValue="related" className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <Tabs.List className="flex border-b border-[#d8dde6]">
            <Tabs.Trigger value="related" className="border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-brand-500 data-[state=active]:font-semibold data-[state=active]:text-brand-700">
              Related
            </Tabs.Trigger>
            <Tabs.Trigger value="details" className="border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-brand-500 data-[state=active]:font-semibold data-[state=active]:text-brand-700">
              Details
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="related" className="space-y-3 p-3">
            <DuplicatePanel object={object} record={record} data={data} onReview={(duplicate) => onRecordEdit(object, duplicate)} onMerge={(duplicate) => setDialog({ type: "mergeDuplicate", duplicate })} />
            <RelatedLists
              object={object}
              record={record}
              data={data}
              onCreate={onCreate}
              onSaveFile={onSaveFile}
              onRecordEdit={onRecordEdit}
              onRecordDelete={onRecordDelete}
              onViewAll={(title, relatedObject, records, fields) => setDialog({ type: "relatedList", title, object: relatedObject, records, fields })}
              onNewPartner={() => setDialog({ type: "partner" })}
            />
          </Tabs.Content>
          <Tabs.Content value="details" className="p-3">
            <DetailsSections object={object} record={record} onEdit={onEdit} onChangeOwner={onChangeOwner} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
      <ActivityPanel object={object} record={record} data={data} onSaveActivity={onSaveActivity} onOpenEvent={onOpenEvent} />
      {dialog?.type === "hierarchy" && <RecordHierarchyDialog object={object} record={record} data={data} onClose={() => setDialog(null)} />}
      {dialog?.type === "relatedList" && (
        <RelatedListDialog
          title={dialog.title}
          object={dialog.object}
          records={dialog.records}
          fields={dialog.fields}
          onClose={() => setDialog(null)}
          onEdit={(relatedObject, relatedRecord) => {
            setDialog(null);
            if (relatedObject !== "Partner") onRecordEdit(relatedObject, relatedRecord);
          }}
          onDelete={(relatedObject, relatedRecord) => {
            setDialog(null);
            if (relatedObject !== "Partner") onRecordDelete(relatedObject, relatedRecord);
          }}
        />
      )}
      {dialog?.type === "partner" && (
        <PartnerModal
          account={object === "Account" ? record : data.accounts.find((account) => account.id === record.accountId)}
          onClose={() => setDialog(null)}
          onSave={(partner) => {
            onDataChange((previous) => ({ ...previous, partners: [partner, ...previous.partners] }));
            onToast({ tone: "success", message: `Partner "${partner.name}" created.` });
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "mergeDuplicate" && (
        <BaseDialog open title={`Merge duplicate ${definition.label}?`} onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={() => { const duplicate = dialog.duplicate; setDialog(null); onRecordDelete(object, duplicate); }}>Review Merge</Button></>}>
          <div className="space-y-2 text-sm">
            <p className="text-[#706e6b]">Review the duplicate before merging. The duplicate record will be selected for deletion after confirmation.</p>
            <div className="rounded border border-[#d8dde6] p-3">
              <div className="font-semibold">{recordTitle(object, dialog.duplicate)}</div>
              <div className="text-xs text-[#706e6b]">{duplicateReason(object, record, dialog.duplicate)}</div>
            </div>
          </div>
        </BaseDialog>
      )}
    </section>
  );
}

function RelatedLists({
  object,
  record,
  data,
  onCreate,
  onSaveFile,
  onRecordEdit,
  onRecordDelete,
  onViewAll,
  onNewPartner
}: {
  object: "Account" | "Contact";
  record: RecordData;
  data: BootstrapData;
  onCreate: (object: CrmObject) => void;
  onSaveFile: (file: RecordData, attachment?: boolean) => Promise<void>;
  onRecordEdit: (object: CrmObject, record: RecordData) => void;
  onRecordDelete: (object: CrmObject, record: RecordData) => void;
  onViewAll: (title: string, object: RelatedListObject, records: RecordData[], fields: string[]) => void;
  onNewPartner: () => void;
}) {
  const contacts = object === "Account" ? data.contacts.filter((contact) => contact.accountId === record.id) : [];
  const opportunities = data.opportunities.filter((opportunity) => opportunity.accountId === record.id || opportunity.contactId === record.id);
  const cases = data.cases.filter((caseRecord) => caseRecord.accountId === record.id || caseRecord.contactId === record.id);
  const partners = object === "Account" ? data.partners.filter((partner) => partner.accountId === record.id) : [];
  const files = data.files.filter((file) => file.relatedObjectType === object && file.relatedRecordId === record.id);
  const attachments = data.attachments.filter((file) => file.relatedObjectType === object && file.relatedRecordId === record.id);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {object === "Account" && <RelatedListCard title={`Contacts (${contacts.length})`} action="New" onAction={() => onCreate("Contact")} records={contacts} fields={["title", "email", "phone"]} viewAll="View All Contacts" object="Contact" onViewAll={onViewAll} onEdit={onRecordEdit} onDelete={onRecordDelete} />}
      <RelatedListCard title={`Opportunities (${opportunities.length})`} action="New" onAction={() => onCreate("Opportunity")} records={opportunities} fields={["stage", "amount", "closeDate"]} object="Opportunity" onViewAll={onViewAll} onEdit={onRecordEdit} onDelete={onRecordDelete} />
      <RelatedListCard title={`Cases (${cases.length})`} action="New" onAction={() => onCreate("Case")} records={cases} fields={["status", "priority", "subject"]} object="Case" onViewAll={onViewAll} onEdit={onRecordEdit} onDelete={onRecordDelete} />
      {object === "Account" && <RelatedListCard title={`Partners (${partners.length})`} action="New" onAction={onNewPartner} records={partners} fields={["role"]} viewAll={partners.length > 0 ? "View All Partners" : undefined} object="Partner" onViewAll={onViewAll} />}
      <FileDropzone title={`Files (${files.length})`} action="Add Files" records={files} onUpload={(file) => onSaveFile({ ...file, relatedObjectType: object, relatedRecordId: requiredId(record) })} />
      <FileDropzone title={`Notes & Attachments (${attachments.length})`} action="Upload Files" records={attachments} onUpload={(file) => onSaveFile({ ...file, relatedObjectType: object, relatedRecordId: requiredId(record) }, true)} />
    </div>
  );
}

function RelatedListCard({
  title,
  action,
  onAction,
  records,
  fields,
  object,
  viewAll,
  onViewAll,
  onEdit,
  onDelete
}: {
  title: string;
  action: string;
  onAction: () => void;
  records: RecordData[];
  fields: string[];
  object: RelatedListObject;
  viewAll?: string;
  onViewAll: (title: string, object: RelatedListObject, records: RecordData[], fields: string[]) => void;
  onEdit?: (object: CrmObject, record: RecordData) => void;
  onDelete?: (object: CrmObject, record: RecordData) => void;
}) {
  const viewAllLabel = viewAll ?? (records.length > 0 ? `View All ${object === "Partner" ? "Partners" : OBJECT_DEFINITIONS[object].plural}` : undefined);
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[#d8dde6] px-3 py-2">
        <h3 className="font-semibold">{title}</h3>
        <Button onClick={onAction}>{action}</Button>
      </div>
      <div className="p-3">
        {records.length === 0 ? (
          <p className="text-sm text-[#706e6b]">No records to show.</p>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div key={requiredId(record)} className="rounded border border-[#d8dde6] p-2">
                <div className="flex items-center justify-between gap-2">
                  {object !== "Partner" && canRouteToRecord(object) ? (
                    <Link href={routeForRecord(object, requiredId(record))} className="font-medium text-brand-700 hover:underline">
                      {relatedRecordTitle(object, record)}
                    </Link>
                  ) : (
                    <button className="font-medium text-brand-700 hover:underline" onClick={() => object !== "Partner" && onEdit?.(object, record)}>
                      {relatedRecordTitle(object, record)}
                    </button>
                  )}
                  <RelatedRowActions object={object} record={record} onEdit={onEdit} onDelete={onDelete} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#706e6b]">
                  {fields.map((field) => (
                    <div key={field}>
                      <div>{fieldLabel(field)}</div>
                      <div className="truncate text-[#181818]">{formatCell(record[field]) || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {viewAllLabel && <button className="text-sm text-brand-700 hover:underline" onClick={() => onViewAll(viewAllLabel, object, records, fields)}>{viewAllLabel}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedRowActions({ object, record, onEdit, onDelete }: { object: RelatedListObject; record: RecordData; onEdit?: (object: CrmObject, record: RecordData) => void; onDelete?: (object: CrmObject, record: RecordData) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button aria-label="Show Actions" className="rounded p-1 hover:bg-[#f3f3f3]">
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
          {object !== "Partner" && canRouteToRecord(object) && (
            <DropdownMenu.Item asChild className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">
              <Link href={routeForRecord(object, requiredId(record))}>Open</Link>
            </DropdownMenu.Item>
          )}
          {object !== "Partner" && (
            <DropdownMenu.Item onSelect={() => onEdit?.(object, record)} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Edit</DropdownMenu.Item>
          )}
          {object !== "Partner" && (
            <DropdownMenu.Item onSelect={() => onDelete?.(object, record)} className="cursor-pointer rounded px-3 py-2 text-[#ba0517] hover:bg-[#fff1f1]">Delete</DropdownMenu.Item>
          )}
          {object === "Partner" && <DropdownMenu.Item disabled className="rounded px-3 py-2 data-[disabled]:text-[#a8a8a8]">Partner details are managed from the account</DropdownMenu.Item>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function DuplicatePanel({ object, record, data, onReview, onMerge }: { object: "Account" | "Contact"; record: RecordData; data: BootstrapData; onReview: (record: RecordData) => void; onMerge: (record: RecordData) => void }) {
  const duplicates = potentialDuplicates(object, record, data);
  if (duplicates.length === 0) {
    return <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-3 text-sm">We found no potential duplicates of this {OBJECT_DEFINITIONS[object].label}.</div>;
  }
  return (
    <div className="rounded border border-[#f1c40f] bg-[#fff7d6] p-3 text-sm">
      <div className="mb-2 font-semibold">Potential duplicates found</div>
      <div className="space-y-2">
        {duplicates.map((duplicate) => (
          <div key={requiredId(duplicate)} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#e5c349] bg-white p-2">
            <div>
              <div className="font-medium">{recordTitle(object, duplicate)}</div>
              <div className="text-xs text-[#706e6b]">{duplicateReason(object, record, duplicate)}</div>
            </div>
            <div className="flex gap-1">
              <Button onClick={() => onReview(duplicate)}>Review</Button>
              <Button variant="primary" onClick={() => onMerge(duplicate)}>Merge</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordHierarchyDialog({ object, record, data, onClose }: { object: "Account" | "Contact"; record: RecordData; data: BootstrapData; onClose: () => void }) {
  const rows = object === "Account" ? accountHierarchyRows(record, data) : contactHierarchyRows(record, data);
  return (
    <BaseDialog open title={object === "Account" ? "Account Hierarchy" : "Contact Hierarchy"} onClose={onClose} wide footer={<Button onClick={onClose}>Close</Button>}>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className={cn("rounded-lg border border-[#e4e7ec] bg-white shadow-card p-3", row.current && "border-brand-500 bg-brand-50")}>
            <div className="flex items-center justify-between gap-2" style={{ paddingLeft: row.depth * 24 }}>
              <div>
                <div className="font-semibold">{row.label}</div>
                <div className="text-xs text-[#706e6b]">{row.meta}</div>
              </div>
              {row.href ? <Link href={row.href} className="text-sm text-brand-700 hover:underline">Open</Link> : <span className="text-xs text-[#706e6b]">Current</span>}
            </div>
          </div>
        ))}
        {rows.length === 1 && <div className="rounded border border-dashed border-[#d8dde6] p-4 text-sm text-[#706e6b]">No parent or child records are linked yet.</div>}
      </div>
    </BaseDialog>
  );
}

function RelatedListDialog({ title, object, records, fields, onClose, onEdit, onDelete }: { title: string; object: RelatedListObject; records: RecordData[]; fields: string[]; onClose: () => void; onEdit: (object: RelatedListObject, record: RecordData) => void; onDelete: (object: RelatedListObject, record: RecordData) => void }) {
  return (
    <BaseDialog open title={title} onClose={onClose} wide footer={<Button onClick={onClose}>Close</Button>}>
      <div className="overflow-auto">
        <table className="w-full min-w-[620px] border border-[#d8dde6] text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              <th className="border border-[#d8dde6] px-2 py-2 text-left">Name</th>
              {fields.map((field) => <th key={field} className="border border-[#d8dde6] px-2 py-2 text-left">{fieldLabel(field)}</th>)}
              <th className="border border-[#d8dde6] px-2 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={requiredId(record)}>
                <td className="border border-[#d8dde6] px-2 py-2">
                  {object !== "Partner" && canRouteToRecord(object) ? <Link href={routeForRecord(object, requiredId(record))} className="text-brand-700 hover:underline">{relatedRecordTitle(object, record)}</Link> : <button className="text-brand-700 hover:underline" onClick={() => onEdit(object, record)}>{relatedRecordTitle(object, record)}</button>}
                </td>
                {fields.map((field) => <td key={field} className="border border-[#d8dde6] px-2 py-2">{formatCell(record[field]) || "-"}</td>)}
                <td className="border border-[#d8dde6] px-2 py-2"><RelatedRowActions object={object} record={record} onEdit={(relatedObject, relatedRecord) => onEdit(relatedObject, relatedRecord)} onDelete={(relatedObject, relatedRecord) => onDelete(relatedObject, relatedRecord)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseDialog>
  );
}

function PartnerModal({ account, onClose, onSave }: { account?: RecordData; onClose: () => void; onSave: (partner: RecordData) => void }) {
  const [values, setValues] = useState<RecordData>({ name: "", role: "Technology Partner" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!account?.id) {
      setError("Choose an account before creating a partner.");
      return;
    }
    if (!String(values.name ?? "").trim()) {
      setError("Complete this field.");
      return;
    }
    setSaving(true);
    const response = await postUtility("createPartner", undefined, { accountId: account.id, name: String(values.name).trim(), role: values.role });
    const partner = isRecordData(response?.partner)
      ? response.partner
      : { id: `partner-${Date.now()}`, accountId: account.id, name: String(values.name).trim(), role: values.role, createdAt: new Date().toISOString() };
    setSaving(false);
    onSave(partner);
  }

  return (
    <BaseDialog open title="New Partner" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void submit()}>{saving ? "Saving..." : "Save"}</Button></>}>
      <div className="space-y-3">
        <FieldShell label="Account"><input className={inputClass} value={String(account?.name ?? "No account selected")} readOnly /></FieldShell>
        <FieldShell label="Partner Name" required error={error}><input className={inputClass} value={String(values.name ?? "")} onChange={(event) => { setError(""); setValues({ ...values, name: event.target.value }); }} /></FieldShell>
        <FieldShell label="Role"><NativeSelect options={["Technology Partner", "Implementation Partner", "Reseller", "Referral Partner", "Strategic Partner"]} value={String(values.role ?? "Technology Partner")} onChange={(role) => setValues({ ...values, role })} /></FieldShell>
      </div>
    </BaseDialog>
  );
}

function FileDropzone({ title, action, records, onUpload }: { title: string; action: string; records: RecordData[]; onUpload: (file: RecordData) => Promise<void> }) {
  const [dragging, setDragging] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<Array<{ id: string; name: string; size: number; progress: number; status: "Uploading" | "Complete" | "Error" }>>([]);
  function uploadFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => void uploadFile(file));
  }
  async function uploadFile(file: File) {
    const id = `upload-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingUploads((current) => [{ id, name: file.name, size: file.size, progress: 0, status: "Uploading" }, ...current]);
    try {
      for (const progress of [24, 58, 88]) {
        await waitForUploadProgress();
        setPendingUploads((current) => current.map((item) => (item.id === id ? { ...item, progress } : item)));
      }
      await onUpload({ id: `pending-${file.name}-${Date.now()}`, name: file.name, size: file.size });
      setPendingUploads((current) => current.map((item) => (item.id === id ? { ...item, progress: 100, status: "Complete" } : item)));
      await waitForUploadProgress(300);
      setPendingUploads((current) => current.filter((item) => item.id !== id));
    } catch {
      setPendingUploads((current) => current.map((item) => (item.id === id ? { ...item, status: "Error" } : item)));
    }
  }
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[#d8dde6] px-3 py-2">
        <h3 className="font-semibold">{title}</h3>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs hover:bg-[#f3f3f3]">
          <Upload size={13} />
          {action}
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              uploadFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          uploadFiles(event.dataTransfer.files);
        }}
        className={cn("m-3 rounded border border-dashed border-[#c9c9c9] p-5 text-center text-sm text-[#706e6b]", dragging && "border-brand-500 bg-brand-50 text-brand-700")}
      >
        <div className="font-semibold">Drop Files</div>
        <div>Or drop files</div>
      </div>
      {(pendingUploads.length > 0 || records.length > 0) && (
        <div className="border-t border-[#d8dde6] p-3">
          {pendingUploads.map((upload) => (
            <div key={upload.id} className="mb-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>{upload.name}</span>
                <span className="text-xs text-[#706e6b]">{upload.status === "Error" ? "Upload failed" : `${upload.progress}%`}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div className={cn("h-full rounded-full", upload.status === "Error" ? "bg-[#ba0517]" : "bg-brand-600")} style={{ width: `${upload.status === "Error" ? 100 : upload.progress}%` }} />
              </div>
            </div>
          ))}
          {records.map((record) => (
            <div key={requiredId(record)} className="flex items-center justify-between py-1 text-sm">
              <span>{record.name as string}</span>
              <span className="text-xs text-[#706e6b]">{record.size ? `${Math.round(Number(record.size) / 1024)} KB` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailsSections({ object, record, onEdit, onChangeOwner }: { object: "Account" | "Contact"; record: RecordData; onEdit: () => void; onChangeOwner: () => void }) {
  const sections =
    object === "Account"
      ? [
          ["About", ["Account Name:name", "Website:website", "Type:type", "Description:description", "Parent Account:parentAccountId", "Account Owner:ownerName"]],
          ["Get in Touch", ["Phone:phone", "Billing Address:billingAddress", "Shipping Address:shippingAddress"]],
          ["History", ["Created By:createdById", "Last Modified By:updatedById"]]
        ]
      : [
          ["About", ["Name:displayName", "Account Name:accountName", "Title:title", "Reports To:reportsToContactId", "Description:description", "Contact Owner:ownerName"]],
          ["Get in Touch", ["Phone:phone", "Email:email", "Mailing Address:mailingAddress"]],
          ["History", ["Created By:createdById", "Last Modified By:updatedById"]]
        ];
  return (
    <div className="space-y-4">
      {sections.map(([section, fields]) => (
        <section key={section as string}>
          <h3 className="mb-2 border-b border-[#d8dde6] pb-1 font-semibold">{section as string}</h3>
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
            {(fields as string[]).map((item) => {
              const [label, key] = item.split(":");
              const value = key.endsWith("Address") ? addressValue(record, key.replace("Address", "")) : record[key];
              return (
                <div key={item} className="flex min-h-10 items-start justify-between gap-3 border-b border-[#f3f3f3] py-2">
                  <div>
                    <div className="text-xs text-[#706e6b]">{label}</div>
                    <div className="text-sm">{formatCell(value) || "-"}</div>
                  </div>
                  <button className="rounded p-1 text-[#706e6b] hover:bg-brand-50 hover:text-brand-700" aria-label={label.includes("Owner") ? "Change Owner" : `Edit ${label}`} onClick={label.includes("Owner") ? onChangeOwner : onEdit}>
                    <Edit3 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function ActivityPanel({ object, record, data, onSaveActivity, onOpenEvent }: { object: CrmObject; record: RecordData; data: BootstrapData; onSaveActivity: (activity: RecordData) => Promise<void>; onOpenEvent: () => void }) {
  const [mode, setMode] = useState<"email" | "call" | "task">("email");
  const [emailAction, setEmailAction] = useState<"send" | "log">("send");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState(String(record.email ?? ""));
  const [taskDueDate, setTaskDueDate] = useState(toDateInputValue(new Date()));
  const [taskStatus, setTaskStatus] = useState("Not Started");
  const [taskPriority, setTaskPriority] = useState("Normal");
  const [callResult, setCallResult] = useState("Connected");
  const [insightsOnly, setInsightsOnly] = useState(false);
  const [rangeFilter, setRangeFilter] = useState("Within 2 months");
  const [statusFilter, setStatusFilter] = useState("All activities");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(new Date());
  const related = { relatedObjectType: object, relatedRecordId: record.id };
  const relatedTypes = [object, OBJECT_DEFINITIONS[object]?.plural].filter(Boolean).map(String);
  const activities: TimelineActivity[] = [
    ...data.emailActivities.filter((item) => item.relatedObjectType === object && item.relatedRecordId === record.id).map((item) => ({ ...item, kind: "Email" as const, date: item.sentAt })),
    ...data.callActivities.filter((item) => item.relatedObjectType === object && item.relatedRecordId === record.id).map((item) => ({ ...item, kind: "Call" as const, date: item.completedAt })),
    ...data.tasks.filter((item) => item.relatedObjectType === object && item.relatedRecordId === record.id).map((item) => ({ ...item, kind: "Task" as const, date: item.dueDate ?? item.createdAt })),
    ...data.events
      .filter((item) => {
        const relatedMatch = relatedTypes.includes(String(item.relatedObjectType)) && String(item.relatedRecordId) === String(record.id);
        const nameMatch =
          (object === "Contact" || object === "Lead") &&
          String(item.nameRecordId) === String(record.id) &&
          (String(item.nameObjectType) === OBJECT_DEFINITIONS[object].plural || String(item.nameObjectType) === object);
        return relatedMatch || nameMatch;
      })
      .map((item) => ({ ...item, kind: "Event" as const, date: item.startAt }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const filteredActivities = activities.filter((activity) => {
    if (insightsOnly && !activityHasInsight(activity)) return false;
    if (typeFilter !== "All types" && activity.kind !== typeFilter) return false;
    if (!activityWithinRange(activity, rangeFilter)) return false;
    return activityMatchesStatus(activity, statusFilter);
  });
  const visibleActivities = showAllActivities ? filteredActivities : filteredActivities.slice(0, 4);
  const groupedVisibleActivities = groupTimelineActivities(visibleActivities);
  const filterSummary = `${rangeFilter} - ${statusFilter} - ${typeFilter}`;

  useEffect(() => {
    setRecipient(String(record.email ?? ""));
    setSubject("");
    setBody("");
    setExpandedIds([]);
    setShowAllActivities(false);
  }, [record.id, record.email]);

  async function submit() {
    const id = `${mode}-${Date.now()}`;
    if (mode === "email") await onSaveActivity({ id, type: "email", to: recipient, subject: subject || (emailAction === "send" ? "Email" : "Logged Email"), body, emailAction, ...related });
    if (mode === "call") await onSaveActivity({ id, type: "call", subject: subject || "Call", comments: [callResult, body].filter(Boolean).join("\n"), ...related });
    if (mode === "task") await onSaveActivity({ id, type: "task", subject: subject || "Task", dueDate: taskDueDate, status: taskStatus, priority: taskPriority, ...related });
    setSubject("");
    setBody("");
    if (mode === "email") setEmailAction("send");
    if (mode === "task") {
      setTaskStatus("Not Started");
      setTaskPriority("Normal");
      setTaskDueDate(toDateInputValue(new Date()));
    }
  }

  function chooseEmailAction(action: "send" | "log") {
    setMode("email");
    setEmailAction(action);
  }

  function makeFollowUpTask() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setMode("task");
    setSubject(`Follow up with ${recordTitle(object, record)}`);
    setTaskDueDate(toDateInputValue(tomorrow));
  }

  function toggleActivity(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function expandAll() {
    const nextExpanded = visibleActivities.map((activity) => requiredId(activity)).filter(Boolean);
    setExpandedIds((current) => (nextExpanded.every((id) => current.includes(id)) ? [] : nextExpanded));
  }

  return (
    <aside className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] px-3 py-2 font-semibold">Activity</div>
      <div className="p-3">
        <div className="mb-3 grid grid-cols-4 gap-1">
          <button className={activityTab(mode === "email")} onClick={() => setMode("email")}>Email</button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]">More Email Actions</button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
                <DropdownMenu.Item onSelect={() => chooseEmailAction("send")} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Send Email</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => chooseEmailAction("log")} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Log Email</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setBody((current) => `${current}${current ? "\n\n" : ""}Regards,\n${CURRENT_USER.name}`)} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Insert Signature</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]" onClick={onOpenEvent}>New Event</button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]">More New Event Actions</button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
                <DropdownMenu.Item onSelect={onOpenEvent} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">New Event</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={makeFollowUpTask} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Follow-Up Task</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setMode("call")} className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">Log a Call</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <div className="mb-2 grid grid-cols-2 gap-1">
          <button className={activityTab(mode === "call")} onClick={() => setMode("call")}>Log a Call</button>
          <button className={activityTab(mode === "task")} onClick={() => setMode("task")}>New Task</button>
        </div>
        <div className="space-y-2 rounded border border-[#d8dde6] p-2">
          {mode === "email" && (
            <input value={recipient} onChange={(event) => setRecipient(event.target.value)} className={inputClass} placeholder="To" />
          )}
          {mode === "call" && (
            <NativeSelect options={["Connected", "Left Voicemail", "No Answer", "Wrong Number"]} value={callResult} onChange={setCallResult} />
          )}
          {mode === "task" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className={inputClass} aria-label="Task due date" />
              <NativeSelect options={["Not Started", "In Progress", "Completed", "Deferred"]} value={taskStatus} onChange={setTaskStatus} />
              <NativeSelect options={["Low", "Normal", "High"]} value={taskPriority} onChange={setTaskPriority} />
            </div>
          )}
          <input value={subject} onChange={(event) => setSubject(event.target.value)} className={inputClass} placeholder={mode === "email" ? "Subject" : mode === "call" ? "Call subject" : "Task subject"} />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} className={cn(inputClass, "h-20")} placeholder={mode === "email" ? "Email body" : "Comments"} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#706e6b]">{mode === "email" ? (emailAction === "send" ? "Send and log on timeline" : "Log an existing email") : mode === "call" ? "Completed call activity" : "Task will appear in Upcoming & Overdue"}</span>
            <Button variant="primary" onClick={submit}>{mode === "email" ? (emailAction === "send" ? "Send" : "Log Email") : "Save"}</Button>
          </div>
        </div>
      </div>
      <div className="border-t border-[#d8dde6] p-3">
        <div className="mb-2 flex items-center gap-1 text-xs text-[#706e6b]">
          <input type="checkbox" checked={insightsOnly} onChange={(event) => setInsightsOnly(event.target.checked)}  className={checkboxClass} /> Only show activities with insights
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-[#706e6b]">
          <span>{filterSummary}</span>
          <Popover.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Popover.Trigger asChild>
              <button className="ml-auto rounded p-1 hover:bg-[#f3f3f3]" aria-label="Timeline Settings"><Settings size={13} /></button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" className="z-50 w-72 rounded border border-[#d8dde6] bg-white p-3 text-sm shadow-popover">
                <div className="mb-3 font-semibold">Timeline Settings</div>
                <div className="grid gap-3">
                  <FieldShell label="Date Range"><NativeSelect options={["Within 7 days", "Within 2 months", "All time"]} value={rangeFilter} onChange={setRangeFilter} /></FieldShell>
                  <FieldShell label="Activity Status"><NativeSelect options={["All activities", "Upcoming", "Overdue", "Completed"]} value={statusFilter} onChange={setStatusFilter} /></FieldShell>
                  <FieldShell label="Activity Type"><NativeSelect options={["All types", "Email", "Call", "Task", "Event"]} value={typeFilter} onChange={setTypeFilter} /></FieldShell>
                  <Button onClick={() => setSettingsOpen(false)}>Done</Button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label="Refresh" onClick={() => setRefreshedAt(new Date())}><RefreshCw size={13} /></button>
          <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label="Expand All" onClick={expandAll}><ChevronsUpDown size={13} /></button>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-semibold">Upcoming & Overdue</div>
          <div className="text-[11px] text-[#706e6b]">Updated {formatDateTime(refreshedAt.toISOString())}</div>
        </div>
        {filteredActivities.length === 0 ? (
          <div className="rounded border border-dashed border-[#d8dde6] p-4 text-sm text-[#706e6b]">No activities to show. Get started by sending an email, scheduling a task, and more.</div>
        ) : (
          <div className="space-y-3">
            {groupedVisibleActivities.map((group) => (
              <section key={group.label} className="space-y-2" aria-label={`${group.label} activities`}>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-[#706e6b]">
                  <span>{group.label}</span>
                  <span className="h-px flex-1 bg-[#e4e7ec]" />
                </div>
                {group.activities.map((activity) => {
                  const id = requiredId(activity);
                  const expanded = expandedIds.includes(id);
                  return (
                    <div key={id} className="rounded border border-[#d8dde6] p-2 text-sm">
                      <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => toggleActivity(id)}>
                        <span>
                          <span className="block font-medium">{activity.kind}: {String(activity.subject ?? "Activity")}</span>
                          <span className="block text-xs text-[#706e6b]">{formatDateTime(activity.date as string)} - {activityStatusLabel(activity)}</span>
                        </span>
                        <ChevronDown size={14} className={cn("mt-0.5 text-[#706e6b] transition-transform", expanded && "rotate-180")} />
                      </button>
                      {expanded && (
                        <div className="mt-2 rounded bg-[#f8f8f8] p-2 text-xs text-[#444]">
                          <div>{activityDetail(activity)}</div>
                          {activityHasInsight(activity) && <div className="mt-1 font-semibold text-brand-700">Insight: {activityInsight(activity)}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
        {filteredActivities.length > 4 && (
          <button className="mt-2 text-sm text-brand-700 hover:underline" onClick={() => setShowAllActivities((current) => !current)}>
            {showAllActivities ? "Show Fewer Activities" : "Show All Activities"}
          </button>
        )}
      </div>
    </aside>
  );
}

function HomePage({ data, onReportBuilder, onDataChange, onToast }: { data: BootstrapData; onReportBuilder: (reportType?: string) => void; onDataChange: BootstrapDataUpdater; onToast: (toast: ToastState) => void }) {
  const preferences = data.userPreferences[0];
  const preferredMode = String(preferences?.homeMode ?? "Onboarding") === "Dashboard" ? "Dashboard" : "Onboarding";
  const [homeMode, setHomeMode] = useState<"Onboarding" | "Dashboard">(preferredMode);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [allCardsOpen, setAllCardsOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(new Date());
  const [taskView, setTaskView] = useState("Due Today");
  const closedWonAmount = sumReportAmount(data.opportunities.filter((record) => String(record.stage ?? "") === "Closed Won"), "amount");
  const openHighProbabilityAmount = sumReportAmount(data.opportunities.filter((record) => !isClosedOpportunity(record) && numberFromRecord(record.probability) >= 70), "amount");
  const suggestedGoal = Math.max(100000, closedWonAmount + openHighProbabilityAmount);
  const [goalInput, setGoalInput] = useState(String(numberFromRecord(preferences?.quarterlyGoal) || suggestedGoal));
  const goalAmount = numberFromRecord(preferences?.quarterlyGoal) || numberFromRecord(goalInput) || suggestedGoal;
  const today = new Date();
  const todayEvents = data.events.filter((event) => {
    const startAt = parseReportDate(event.startAt);
    return startAt ? sameDate(startAt, today) : false;
  });
  const todayTasks = data.tasks.filter((task) => {
    const dueDate = parseReportDate(task.dueDate);
    const status = String(task.status ?? "");
    if (status === "Completed") return false;
    if (taskView === "All Open") return true;
    if (taskView === "Overdue") return Boolean(dueDate && dueDate < startOfDay(today));
    return !dueDate || sameDate(dueDate, today);
  });
  const recentRecords = buildHomeRecentRecords(data);
  const keyDeals = data.opportunities.filter((record) => !isClosedOpportunity(record)).slice(0, 3);
  const openCases = data.cases.filter((record) => !isClosedCase(record));
  const suggestionCards = [
    { id: "lead", title: "Create your first lead", body: "Convert leads into contacts, accounts, and opportunities.", href: "/lightning/o/Lead/new" },
    { id: "marketing", title: "Turn on marketing features", body: "Access tools to reach audiences and engage customers.", href: "/lightning/app/marketing", newTab: true },
    { id: "deal", title: "Create your first deal", body: "Add an opportunity and track stages as deals move forward.", href: "/lightning/o/Opportunity/new" },
    { id: "calendar", title: "Schedule today", body: "Create an event and keep your activity timeline current.", href: "/lightning/o/Event/home" },
    { id: "reports", title: "Review analytics", body: "Open reports for pipeline, service, contacts, and lead generation.", href: "/lightning/page/analytics" }
  ];
  const visibleSuggestions = suggestionCards.filter((card) => !dismissedSuggestions.includes(card.id));
  const assistantItems = [
    data.leads.length === 0 ? "Create a lead to start tracking prospecting work." : `${data.leads.length} lead${data.leads.length === 1 ? "" : "s"} in the workspace.`,
    openCases.length > 0 ? `${openCases.length} open case${openCases.length === 1 ? "" : "s"} need support follow-up.` : "",
    keyDeals.length > 0 ? `${keyDeals.length} open opportunit${keyDeals.length === 1 ? "y" : "ies"} in pipeline.` : ""
  ].filter(Boolean);

  useEffect(() => {
    setHomeMode(preferredMode);
    setGoalInput(String(numberFromRecord(preferences?.quarterlyGoal) || suggestedGoal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.id, preferences?.homeMode, preferences?.quarterlyGoal]);

  async function saveHomePreferences(values: RecordData) {
    const response = await postUtility("updatePreferences", undefined, values);
    const nextPreferences = response?.preferences as RecordData | undefined;
    if (!nextPreferences?.id) {
      onToast({ tone: "error", message: "Home preferences couldn't be saved." });
      return false;
    }
    onDataChange((previous) => ({
      ...previous,
      userPreferences: [nextPreferences, ...previous.userPreferences.filter((item) => item.id !== nextPreferences.id && item.userId !== nextPreferences.userId)]
    }));
    return true;
  }

  async function switchHomeMode(mode: "Onboarding" | "Dashboard") {
    setHomeMode(mode);
    const saved = await saveHomePreferences({ homeMode: mode });
    if (saved) onToast({ tone: "success", message: mode === "Dashboard" ? "Dashboard is now your Home." : "Onboarding cards are now your Home." });
  }

  async function saveGoal() {
    const value = Math.max(0, Math.round(numberFromRecord(goalInput)));
    const saved = await saveHomePreferences({ quarterlyGoal: value });
    if (saved) {
      setGoalDialogOpen(false);
      onToast({ tone: "success", message: "Quarterly goal saved." });
    }
  }

  function refreshDashboard() {
    setRefreshedAt(new Date());
    onToast({ tone: "success", message: "Home dashboard refreshed." });
  }

  if (homeMode === "Dashboard") {
    return (
      <div className="grid gap-3 lg:grid-cols-3">
        <DashboardPanel title="Quarterly Performance">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-[#706e6b]">As of {formatDateTime(refreshedAt.toISOString())}</div>
            <div className="flex gap-1">
              <Button onClick={refreshDashboard}><RefreshCw size={13} /> Refresh Chart</Button>
              <Button onClick={() => setGoalDialogOpen(true)}>Edit Goal</Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Closed", formatKanbanSummary(closedWonAmount)],
              ["Open (>70%)", formatKanbanSummary(openHighProbabilityAmount)],
              ["Goal", formatKanbanSummary(goalAmount)]
            ].map(([metric, value]) => <div key={metric} className="rounded border border-[#d8dde6] p-3"><div className="text-xs text-[#706e6b]">{metric}</div><div className="text-lg font-semibold">{value}</div></div>)}
          </div>
          <p className="mt-4 text-sm text-[#706e6b]">{data.opportunities.length === 0 ? "Add opportunities and return to view performance." : `${data.opportunities.length} opportunit${data.opportunities.length === 1 ? "y" : "ies"} included in performance.`}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/lightning/o/Opportunity/list" className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]">Open Opportunities</Link>
            <Link href={reportHref("Pipeline by Stage")} className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]">View Report</Link>
          </div>
        </DashboardPanel>
        <DashboardPanel title="Today's Events" action="View Calendar" actionHref="/lightning/o/Event/home">
          {todayEvents.length === 0 ? (
            <p className="text-sm text-[#706e6b]">You&apos;re free and clear for the day.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {todayEvents.slice(0, 4).map((event) => (
                <li key={requiredId(event)} className="rounded border border-[#d8dde6] p-2">
                  <div className="font-medium">{String(event.subject ?? "Event")}</div>
                  <div className="text-xs text-[#706e6b]">{formatDateTime(String(event.startAt))}</div>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
        <DashboardPanel title="Recent Records" action="View All" actionHref="/lightning/page/analytics">
          <ul className="space-y-2 text-sm">
            {recentRecords.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="text-brand-700 hover:underline">{item.label}</Link>
                <span className="text-[#706e6b]"> - {item.context}</span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
        <DashboardPanel title="Today's Tasks">
          <div className="mb-3 max-w-xs">
            <NativeSelect options={["Due Today", "Overdue", "All Open"]} value={taskView} onChange={setTaskView} />
          </div>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-[#706e6b]">Nothing due today.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {todayTasks.slice(0, 4).map((task) => (
                <li key={requiredId(task)} className="rounded border border-[#d8dde6] p-2">
                  <div className="font-medium">{String(task.subject ?? "Task")}</div>
                  <div className="text-xs text-[#706e6b]">{task.dueDate ? formatDate(String(task.dueDate)) : "No due date"} - {String(task.priority ?? "Normal")}</div>
                </li>
              ))}
            </ul>
          )}
          <button className="mt-3 text-sm text-brand-700 hover:underline" onClick={() => setTaskView("All Open")}>View All</button>
        </DashboardPanel>
        <DashboardPanel title="Key Deals - Recent Opportunities" action="View Deals" actionHref="/lightning/o/Opportunity/list">
          {keyDeals.length === 0 ? (
            <p className="text-sm text-[#706e6b]">No deals match this view.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {keyDeals.map((deal) => (
                <li key={requiredId(deal)} className="rounded border border-[#d8dde6] p-2">
                  <div className="font-medium">{String(deal.name ?? "Opportunity")}</div>
                  <div className="text-xs text-[#706e6b]">{String(deal.stage ?? "Stage")} - {formatKanbanSummary(numberFromRecord(deal.amount))}</div>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
        <DashboardPanel title="Assistant">
          {assistantItems.length === 0 ? (
            <p className="text-sm text-[#706e6b]">Nothing needs your attention.</p>
          ) : (
            <ul className="space-y-2 text-sm text-[#706e6b]">
              {assistantItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </DashboardPanel>
        <DashboardPanel title="Home Settings">
          <p className="mb-3 text-sm text-[#706e6b]">Dashboard is your default Home page. You can switch back to onboarding cards any time.</p>
          <Button onClick={() => void switchHomeMode("Onboarding")}>Show Onboarding Home</Button>
        </DashboardPanel>
        {goalDialogOpen && (
          <BaseDialog open title="Edit Quarterly Goal" onClose={() => setGoalDialogOpen(false)} footer={<><Button onClick={() => setGoalDialogOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => void saveGoal()}>Save Goal</Button></>}>
            <FieldShell label="Quarterly Goal">
              <input className={inputClass} type="number" min={0} value={goalInput} onChange={(event) => setGoalInput(event.target.value)} />
            </FieldShell>
          </BaseDialog>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Welcome, Parsa</h1>
            <p className="text-sm text-[#706e6b]">Check out these suggestions to kick off your day.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void switchHomeMode("Dashboard")}>Hide suggestions</Button>
            <Button onClick={() => setAllCardsOpen(true)}>View All Cards</Button>
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {visibleSuggestions.slice(0, 3).map((card) => (
          <div key={card.id} className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{card.title}</h2>
              <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label="Dismiss this suggestion" onClick={() => setDismissedSuggestions((current) => [...current, card.id])}><X size={14} /></button>
            </div>
            <p className="mt-2 text-sm text-[#706e6b]">{card.body}</p>
            <Link href={card.href} target={card.newTab ? "_blank" : undefined} className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline">Open</Link>
          </div>
        ))}
        {visibleSuggestions.length === 0 && <EmptyPanel title="All suggestions hidden" body="You can still view every onboarding card from View All Cards." action="View All Cards" onAction={() => setAllCardsOpen(true)} />}
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {homeReportCards.map((item) => (
          <DashboardPanel key={item.objectLabel} title={`${item.objectLabel} report`}>
            <NativeSelect className="mb-3" options={[item.reportTitle]} value={item.reportTitle} onChange={() => undefined} />
            <div className="flex justify-between">
              <Button onClick={() => onReportBuilder(item.objectLabel)}>New</Button>
              <Link href={reportHref(item.reportTitle)} className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]">
                View Report
              </Link>
            </div>
          </DashboardPanel>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardPanel title="Recent Records" action="View All" actionHref="/lightning/page/analytics">
          <ul className="space-y-2 text-sm">
            {recentRecords.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="text-brand-700 hover:underline">{item.label}</Link>
                <span className="text-[#706e6b]"> - {item.context}</span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
        <DashboardPanel title="Make It Your Home">
          <p className="mb-3 text-sm text-[#706e6b]">Use this onboarding workspace as your default Home page, or switch to the dashboard view once setup is complete.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void switchHomeMode("Onboarding")}>Make It Your Home</Button>
            <Button onClick={() => void switchHomeMode("Dashboard")}>Use Dashboard Home</Button>
          </div>
        </DashboardPanel>
      </div>
      {allCardsOpen && (
        <BaseDialog open title="All Suggested Cards" onClose={() => setAllCardsOpen(false)} wide footer={<Button onClick={() => setAllCardsOpen(false)}>Done</Button>}>
          <div className="grid gap-3 md:grid-cols-2">
            {suggestionCards.map((card) => (
              <div key={card.id} className="rounded border border-[#d8dde6] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{card.title}</div>
                    <p className="mt-1 text-sm text-[#706e6b]">{card.body}</p>
                  </div>
                  <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label="Dismiss this suggestion" onClick={() => setDismissedSuggestions((current) => Array.from(new Set([...current, card.id])))}><X size={14} /></button>
                </div>
                <Link href={card.href} target={card.newTab ? "_blank" : undefined} className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline">Open</Link>
              </div>
            ))}
          </div>
        </BaseDialog>
      )}
    </div>
  );
}

function MarketingPage({ data, onCreate, onActivate }: { data: BootstrapData; onCreate: (object: CrmObject) => void; onActivate: () => void }) {
  const latestActivation = data.marketingActivations[0];
  const growthEngines = [
    {
      title: "Email Campaigns",
      body: "Compose, preview, save, schedule, or send list emails to leads and contacts.",
      action: "Send Email",
      onClick: () => onCreate("ListEmail")
    },
    {
      title: "Custom Landing Pages with Forms",
      body: "Use marketing activation settings as the launch point for branded forms and capture pages.",
      action: latestActivation ? "Edit Activation" : "Activate",
      onClick: onActivate
    },
    {
      title: "Audience Building",
      body: "Open lead lists and build targeted recipient groups from the CRM data.",
      action: "Open Leads",
      href: "/lightning/o/Lead/list?filterName=AllOpenLeads"
    },
    {
      title: "Pre-Built Analytics",
      body: "Review campaign, pipeline, lead, and service reports from the analytics workspace.",
      action: "Open Analytics",
      href: "/lightning/page/analytics"
    }
  ];
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-6">
        <h1 className="text-2xl font-semibold">{latestActivation ? "Marketing tools are active" : "Activate powerful marketing tools and boost sales"}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#706e6b]">
          {latestActivation ? `Default sender: ${latestActivation.senderName ?? "Configured sender"} (${latestActivation.senderEmail ?? "email configured"}).` : "Accelerate lead generation with campaigns, analytics, and list email tools."}
        </p>
        {latestActivation && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-[#e4f6e6] px-2 py-1 font-semibold text-[#194f25]">Active</span>
            <span className="rounded bg-[#f3f3f3] px-2 py-1 text-[#514f4d]">{latestActivation.tracking === false ? "Tracking disabled" : "Tracking enabled"}</span>
            <span className="rounded bg-[#f3f3f3] px-2 py-1 text-[#514f4d]">Activated {latestActivation.activatedAt ? formatDateTime(String(latestActivation.activatedAt)) : "recently"}</span>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={onActivate}>{latestActivation ? "Edit Activation" : "Activate Marketing"}</Button>
          <Button onClick={() => onCreate("ListEmail")}>Send Email</Button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardPanel title="Send emails with ease" action="Send Email" onAction={() => onCreate("ListEmail")}>
          <div className="space-y-3 text-sm">
            <p className="text-[#706e6b]">Access Sales List Emails for leads and contacts, choose a layout, then send now or schedule delivery.</p>
            <div className="grid gap-2">
              <div className="flex items-center justify-between border-b border-[#eef1f6] pb-2">
                <span>Layout picker</span>
                <span className="text-xs text-[#706e6b]">{LIST_EMAIL_LAYOUTS.length} templates</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#eef1f6] pb-2">
                <span>Recipient targeting</span>
                <span className="text-xs text-[#706e6b]">{data.leads.length + data.contacts.length} lead/contact record{data.leads.length + data.contacts.length === 1 ? "" : "s"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Saved emails</span>
                <span className="text-xs text-[#706e6b]">{data.listEmails.length} draft/sent item{data.listEmails.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
        </DashboardPanel>
        <DashboardPanel title="Activate Your Growth Engines">
          <div className="divide-y divide-[#eef1f6] text-sm">
            {growthEngines.map((engine) => {
              const action = (
                <span className="shrink-0 rounded border border-[#c9c9c9] bg-white px-2 py-1 text-xs font-semibold text-brand-700">{engine.action}</span>
              );
              const body = (
                <>
                  <span className="block font-semibold">{engine.title}</span>
                  <span className="mt-1 block text-xs text-[#706e6b]">{engine.body}</span>
                </>
              );
              const className = "flex w-full items-center justify-between gap-3 py-3 text-left hover:text-brand-700";
              if (engine.href) {
                return (
                  <Link key={engine.title} href={engine.href} className={className}>
                    <span className="min-w-0">{body}</span>
                    {action}
                  </Link>
                );
              }
              return (
                <button key={engine.title} className={className} onClick={engine.onClick}>
                  <span className="min-w-0">{body}</span>
                  {action}
                </button>
              );
            })}
          </div>
        </DashboardPanel>
      </div>
    </section>
  );
}

function CommercePage({ stores, onCreateStore }: { stores: RecordData[]; onCreateStore: () => void }) {
  if (stores.length === 0) {
    return <EmptyPanel title="You don't have any stores yet!" body="A store holds product, payment, order, and promotion data." action="Create Store" onAction={onCreateStore} />;
  }

  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[#d8dde6] p-3">
        <div>
          <h1 className="text-xl font-semibold">Stores</h1>
          <div className="text-xs text-[#706e6b]">{stores.length} store{stores.length === 1 ? "" : "s"}</div>
        </div>
        <Button variant="primary" onClick={onCreateStore}>Create Store</Button>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        {stores.map((store) => (
          <div key={requiredId(store)} className="rounded border border-[#d8dde6] p-3">
            <div className="font-semibold">{store.name as string}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#706e6b]">
              <div>Status <div className="text-[#181818]">{formatCell(store.status) || "Draft"}</div></div>
              <div>Currency <div className="text-[#181818]">{formatCell(store.currency) || "USD"}</div></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function YourAccountPage({ user }: { user: BootstrapData["user"] }) {
  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-6">
      <div>
        <h1 className="text-2xl font-semibold">Your Account</h1>
        <p className="mt-1 text-sm text-[#706e6b]">Workspace profile and account details for this CRM clone.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-[#d8dde6] p-3"><div className="text-xs text-[#706e6b]">Name</div><div className="font-semibold">{user.name}</div></div>
        <div className="rounded border border-[#d8dde6] p-3"><div className="text-xs text-[#706e6b]">Alias</div><div className="font-semibold">{user.alias}</div></div>
      </div>
    </section>
  );
}

function AnalyticsPage({ data, reportName, onReportBuilder, onToast }: { data: BootstrapData; reportName: string; onReportBuilder: (reportType?: string) => void; onToast: (toast: ToastState) => void }) {
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const reports = useMemo(() => buildAnalyticsReports(data), [data]);
  const selectedReport = selectAnalyticsReport(reports, reportName);
  const totalRecords = selectedReport.rows.reduce((sum, row) => sum + row.count, 0);
  const savedDashboards: Array<RecordData & { reports: AnalyticsReportDefinition[] }> = data.customDashboards.map((dashboard) => ({
    ...dashboard,
    reports: dashboardReportComponents(dashboard, reports)
  }));

  function refreshReport() {
    setRefreshedAt(new Date());
    onToast({ tone: "success", message: `${selectedReport.title} refreshed.` });
  }

  function exportReport() {
    const blob = new Blob([analyticsReportCsv(selectedReport)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileSafeName(selectedReport.title)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onToast({ tone: "success", message: `${selectedReport.title} exported.` });
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#706e6b]">Analytics</div>
            <h1 className="text-2xl font-semibold">Reports & Dashboards</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#706e6b]">Review live CRM reports for sales, service, accounts, contacts, and lead generation.</p>
            <p className="mt-1 text-xs text-[#706e6b]">Updated {formatDateTime(refreshedAt.toISOString())}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onReportBuilder("Report")}><Plus size={13} /> New Report</Button>
            <Button variant="primary" onClick={() => onReportBuilder("Dashboard")}><LayoutDashboard size={13} /> New Dashboard</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="border-b border-[#d8dde6] p-3">
            <div className="font-semibold">All Reports</div>
            <div className="text-xs text-[#706e6b]">{reports.length} report definitions</div>
          </div>
          <nav className="slds-scrollbar max-h-[calc(100vh-260px)] overflow-auto p-2">
            {reports.map((report) => {
              const active = report.id === selectedReport.id;
              return (
                <Link
                  key={report.id}
                  href={report.href}
                  className={cn(
                    "mb-1 block rounded px-3 py-2 text-sm hover:bg-brand-50",
                    active && "bg-brand-50 text-brand-900 ring-1 ring-brand-200"
                  )}
                >
                  <div className="font-semibold">{report.title}</div>
                  <div className="mt-0.5 text-xs text-[#706e6b]">{report.objectLabel} - {report.rows.length} grouped row{report.rows.length === 1 ? "" : "s"}</div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dde6] p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#706e6b]">{selectedReport.objectLabel} Report</div>
              <h2 className="text-xl font-semibold">{selectedReport.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-[#706e6b]">{selectedReport.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onReportBuilder(selectedReport.objectLabel)}><Edit3 size={13} /> Edit</Button>
              <Button onClick={exportReport}><Download size={13} /> Export</Button>
              <Button onClick={refreshReport}><RefreshCw size={13} /> Refresh</Button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-[#d8dde6] p-3 sm:grid-cols-2 xl:grid-cols-4">
            {selectedReport.metrics.map((metric) => (
              <div key={metric.label} className={cn(
                "rounded border border-[#d8dde6] p-3",
                metric.tone === "success" && "border-[#91db8b] bg-[#f3fbf2]",
                metric.tone === "warning" && "border-[#f3b451] bg-[#fff7e8]"
              )}>
                <div className="text-xs text-[#706e6b]">{metric.label}</div>
                <div className="mt-1 text-xl font-semibold">{metric.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_280px]">
            <ReportBarChart report={selectedReport} />
            <div className="rounded border border-[#d8dde6] p-3">
              <div className="mb-3 font-semibold">Report Properties</div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#706e6b]">Type</dt>
                  <dd>{selectedReport.objectLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Grouped Rows</dt>
                  <dd>{selectedReport.rows.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Underlying Records</dt>
                  <dd>{totalRecords}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Display</dt>
                  <dd>{selectedReport.valueKind === "currency" ? "Summary by amount" : "Summary by count"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="border-t border-[#d8dde6] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Details</h3>
              <div className="text-xs text-[#706e6b]">Sorted by {selectedReport.valueHeader}</div>
            </div>
            {selectedReport.rows.length === 0 ? (
              <div className="rounded border border-dashed border-[#d8dde6] p-5 text-sm text-[#706e6b]">{selectedReport.emptyMessage}</div>
            ) : (
              <div className="slds-scrollbar overflow-auto rounded border border-[#d8dde6]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f3f3f3] text-xs text-[#444]">
                    <tr>
                      <th className="border-b border-[#d8dde6] px-3 py-2">{selectedReport.rowHeader}</th>
                      <th className="border-b border-[#d8dde6] px-3 py-2">Records</th>
                      <th className="border-b border-[#d8dde6] px-3 py-2">{selectedReport.valueHeader}</th>
                      <th className="border-b border-[#d8dde6] px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.rows.map((row) => (
                      <tr key={row.label} className="border-t border-[#d8dde6] hover:bg-brand-50/40">
                        <td className="px-3 py-2 font-medium">
                          {row.href ? <Link href={row.href} className="text-brand-700 hover:underline">{row.label}</Link> : row.label}
                        </td>
                        <td className="px-3 py-2">{row.count}</td>
                        <td className="px-3 py-2">{formatReportValue(selectedReport, row)}</td>
                        <td className="px-3 py-2 text-[#706e6b]">{row.secondary ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
      {savedDashboards.length > 0 && (
        <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde6] p-3">
            <div>
              <h2 className="font-semibold">Saved Dashboards</h2>
              <div className="text-xs text-[#706e6b]">{savedDashboards.length} dashboard{savedDashboards.length === 1 ? "" : "s"} created in this workspace</div>
            </div>
            <Button variant="primary" onClick={() => onReportBuilder("Dashboard")}><LayoutDashboard size={13} /> New Dashboard</Button>
          </div>
          <div className="grid gap-3 p-3 xl:grid-cols-2">
            {savedDashboards.map((dashboard) => (
              <div key={requiredId(dashboard)} className="rounded border border-[#d8dde6] p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{String(dashboard.name ?? "Dashboard")}</div>
                    <div className="text-xs text-[#706e6b]">{dashboard.reports.length} component{dashboard.reports.length === 1 ? "" : "s"} - Updated {dashboard.updatedAt ? formatDateTime(String(dashboard.updatedAt)) : "recently"}</div>
                  </div>
                  <LayoutDashboard size={18} className="text-brand-600" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {dashboard.reports.map((report) => (
                    <Link key={report.id} href={report.href} className="rounded border border-[#d8dde6] p-2 hover:border-brand-500 hover:bg-brand-50">
                      <div className="truncate font-medium text-brand-700">{report.title}</div>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-[#706e6b]">
                        {report.metrics.slice(0, 2).map((metric) => <div key={metric.label}>{metric.label}: <span className="font-semibold text-[#181818]">{metric.value}</span></div>)}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function ReportBarChart({ report }: { report: AnalyticsReportDefinition }) {
  const maxValue = Math.max(...report.rows.map((row) => reportRowValue(report, row)), 1);

  return (
    <div className="rounded border border-[#d8dde6] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">Chart</div>
          <div className="text-xs text-[#706e6b]">{report.rowHeader} by {report.valueHeader}</div>
        </div>
        <LayoutDashboard size={18} className="text-brand-600" />
      </div>
      {report.rows.length === 0 ? (
        <div className="rounded border border-dashed border-[#d8dde6] p-5 text-sm text-[#706e6b]">{report.emptyMessage}</div>
      ) : (
        <div className="space-y-3">
          {report.rows.slice(0, 8).map((row) => {
            const value = reportRowValue(report, row);
            const width = `${Math.max(6, Math.round((value / maxValue) * 100))}%`;
            return (
              <div key={row.label} className="grid gap-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold">{row.label}</span>
                  <span className="shrink-0 text-[#706e6b]">{formatReportValue(report, row)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded bg-[#eef1f6]">
                  <div className="h-full rounded bg-brand-500" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CALENDAR_SOURCE_COLORS = [
  { label: "Blue", value: "#0176d3" },
  { label: "Green", value: "#2e844a" },
  { label: "Red", value: "#ba0517" },
  { label: "Gold", value: "#f3b451" },
  { label: "Gray", value: "#706e6b" }
];

type CalendarSourceDialogState = { type: "new" } | { type: "edit"; source: RecordData } | null;

function CalendarPage({
  data,
  events,
  onCreate,
  onDataChange,
  onToast
}: {
  data: BootstrapData;
  events: RecordData[];
  onCreate: (startDate?: string, startTime?: string, endTime?: string) => void;
  onDataChange: BootstrapDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const [anchorDate, setAnchorDate] = useState(() => new Date("2026-07-08T12:00:00"));
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<"Week" | "Day" | "Month">("Week");
  const [miniMonth, setMiniMonth] = useState(() => new Date("2026-07-01T12:00:00"));
  const [calendarDialog, setCalendarDialog] = useState<CalendarSourceDialogState>(null);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date("2026-07-08T12:00:00"));
  const hours = Array.from({ length: 24 }, (_, hour) => hour.toString().padStart(2, "0") + ":00");
  const yearOptions = useMemo(() => Array.from({ length: 9 }, (_, index) => String(2022 + index)), []);
  const defaultCalendarSources = useMemo<RecordData[]>(
    () => [
      { id: "calendar-default-my", name: data.user.name, type: "My", color: "#0176d3", visible: true },
      { id: "calendar-default-company", name: "Company Events", type: "Other", color: "#2e844a", visible: true }
    ],
    [data.user.name]
  );
  const calendarSources = useMemo(() => {
    if (data.calendarSources.length === 0) return defaultCalendarSources;
    const hasMyCalendar = data.calendarSources.some((source) => calendarSourceType(source) === "My");
    return hasMyCalendar ? data.calendarSources : [defaultCalendarSources[0], ...data.calendarSources];
  }, [data.calendarSources, defaultCalendarSources]);
  const myCalendarVisible = calendarSources.filter((source) => calendarSourceType(source) === "My").some((source) => source.visible !== false);
  const visibleEvents = myCalendarVisible ? events : [];
  const myCalendarSources = calendarSources.filter((source) => calendarSourceType(source) === "My");
  const otherCalendarSources = calendarSources.filter((source) => calendarSourceType(source) === "Other");
  const weekStart = startOfSaturdayWeek(anchorDate);
  const visibleDays = viewMode === "Day" ? [anchorDate] : Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
  const monthDays = getMonthDays(anchorDate);
  const rangeLabel =
    viewMode === "Month"
      ? monthYearLabel(anchorDate)
      : viewMode === "Day"
        ? fullDateLabel(anchorDate)
        : `${monthDayYearLabel(visibleDays[0])}-${monthDayYearLabel(visibleDays[visibleDays.length - 1])}`;

  function movePrevious() {
    const delta = viewMode === "Month" ? -31 : viewMode === "Day" ? -1 : -7;
    setAnchorDate((date) => (viewMode === "Month" ? addCalendarMonths(date, -1) : addCalendarDays(date, delta)));
  }

  function moveNext() {
    const delta = viewMode === "Month" ? 31 : viewMode === "Day" ? 1 : 7;
    setAnchorDate((date) => (viewMode === "Month" ? addCalendarMonths(date, 1) : addCalendarDays(date, delta)));
  }

  function createAt(day: Date, hour = "09:00") {
    onCreate(toDateInputValue(day), hour, nextTimeSlot(hour));
  }

  function setMiniCalendarYear(year: string) {
    setMiniMonth((date) => new Date(Number(year), date.getMonth(), 1, 12));
  }

  function refreshCalendar() {
    setRefreshedAt(new Date());
    onToast({ tone: "success", message: "Calendar refreshed." });
  }

  async function saveCalendarSource(values: RecordData, source?: RecordData) {
    const name = String(values.name ?? "").trim();
    if (!name) {
      onToast({ tone: "error", message: "Calendar name is required." });
      return;
    }
    const now = new Date().toISOString();
    const nextSource: RecordData = {
      ...(source ?? {}),
      id: source && !isFallbackCalendarSource(source) ? requiredId(source) : `calendar-local-${Date.now()}`,
      name,
      type: calendarSourceType(values),
      color: String(values.color ?? "#0176d3"),
      visible: values.visible !== false,
      createdAt: source?.createdAt ?? now,
      updatedAt: now
    };
    const action = source && !isFallbackCalendarSource(source) && !isLocalCalendarSource(source) ? "updateCalendarSource" : "createCalendarSource";
    const response = await postUtility(action, action === "updateCalendarSource" ? requiredId(source ?? {}) : undefined, nextSource);
    if (!response) {
      onToast({ tone: "error", message: "Unable to save calendar." });
      return;
    }
    const responseSources = calendarSourceListFromResponse(response);
    onDataChange((previous) => ({
      ...previous,
      calendarSources: responseSources ?? upsertCalendarSource(previous.calendarSources, nextSource)
    }));
    setCalendarDialog(null);
    onToast({ tone: "success", message: source ? "Calendar updated." : "Calendar added." });
  }

  async function setCalendarSourceVisibility(source: RecordData, visible: boolean) {
    await saveCalendarSource({ ...source, visible }, source);
  }

  async function deleteCalendarSource(source: RecordData) {
    if (isFallbackCalendarSource(source)) {
      onToast({ tone: "warning", message: "Default calendars can be hidden but not deleted." });
      return;
    }
    if (isLocalCalendarSource(source)) {
      onDataChange((previous) => ({ ...previous, calendarSources: previous.calendarSources.filter((item) => requiredId(item) !== requiredId(source)) }));
      onToast({ tone: "success", message: "Calendar deleted." });
      return;
    }
    const response = await postUtility("deleteCalendarSource", requiredId(source));
    if (!response) {
      onToast({ tone: "error", message: "Unable to delete calendar." });
      return;
    }
    const responseSources = calendarSourceListFromResponse(response);
    onDataChange((previous) => ({
      ...previous,
      calendarSources: responseSources ?? previous.calendarSources.filter((item) => requiredId(item) !== requiredId(source))
    }));
    onToast({ tone: "success", message: "Calendar deleted." });
  }

  function renderCalendarSource(source: RecordData) {
    const visible = source.visible !== false;
    const sourceId = requiredId(source);
    return (
      <div key={sourceId} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-brand-50">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <input type="checkbox" checked={visible} onChange={(event) => void setCalendarSourceVisibility(source, event.target.checked)}  className={checkboxClass} />
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: String(source.color ?? "#0176d3") }} />
          <span className={cn("truncate", !visible && "text-[#706e6b] line-through")}>{String(source.name ?? "Calendar")}</span>
        </label>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button aria-label={`${String(source.name ?? "Calendar")} options`} className="rounded p-1 hover:bg-[#f3f3f3]">
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="z-50 min-w-36 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
              <DropdownMenu.Item onSelect={() => setCalendarDialog({ type: "edit", source })} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-brand-50">
                <Edit3 size={13} /> Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => void setCalendarSourceVisibility(source, !visible)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-brand-50">
                <Eye size={13} /> {visible ? "Hide" : "Show"}
              </DropdownMenu.Item>
              <DropdownMenu.Item disabled={isFallbackCalendarSource(source)} onSelect={() => void deleteCalendarSource(source)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-[#ba0517] outline-none hover:bg-[#fff1f1] data-[disabled]:cursor-not-allowed data-[disabled]:text-[#a8a8a8] data-[disabled]:hover:bg-white">
                <Trash2 size={13} /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  }

  return (
    <>
      <div className={cn("grid gap-3", sidebarVisible && "xl:grid-cols-[280px_minmax(0,1fr)]")}>
        {sidebarVisible && (
          <aside className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Button onClick={() => setMiniMonth((date) => addCalendarMonths(date, -1))}><ChevronLeft size={14} /></Button>
              <div className="min-w-0 flex-1 text-center font-semibold">{monthYearLabel(miniMonth)}</div>
              <Button onClick={() => setMiniMonth((date) => addCalendarMonths(date, 1))}><ChevronRight size={14} /></Button>
            </div>
            <FieldShell label="Year">
              <NativeSelect options={yearOptions} value={String(miniMonth.getFullYear())} onChange={setMiniCalendarYear} />
            </FieldShell>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <div key={`${day}-${index}`} className="font-semibold text-[#706e6b]">{day}</div>)}
              {getMonthDays(miniMonth).map((day) => {
                const active = toDateInputValue(day) === toDateInputValue(anchorDate);
                const today = toDateInputValue(day) === toDateInputValue(new Date());
                return (
                  <button key={toDateInputValue(day)} onClick={() => setAnchorDate(day)} className={cn("rounded py-1 hover:bg-brand-50", active && "bg-brand-500 text-white", !sameMonth(day, miniMonth) && "text-[#a8a8a8]", today && !active && "ring-1 ring-brand-500")}>
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 border-t border-[#d8dde6] pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-semibold">My Calendars</div>
                <button aria-label="Add calendar" className="rounded p-1 text-brand-700 hover:bg-brand-50" onClick={() => setCalendarDialog({ type: "new" })}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-1">
                {myCalendarSources.map(renderCalendarSource)}
              </div>
            </div>
            <div className="mt-4 border-t border-[#d8dde6] pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-semibold">Other Calendars</div>
                <button className="text-sm text-brand-700 hover:underline" onClick={() => setCalendarDialog({ type: "new" })}>Add calendar</button>
              </div>
              <div className="space-y-1">
                {otherCalendarSources.length > 0 ? otherCalendarSources.map(renderCalendarSource) : <div className="text-sm text-[#706e6b]">No other calendars</div>}
              </div>
            </div>
          </aside>
        )}
        <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde6] p-3">
            <div>
              <h1 className="text-xl font-semibold">Calendar</h1>
              <div className="text-xs text-[#706e6b]">{rangeLabel} | GMT +4 | Updated {formatDateTime(refreshedAt.toISOString())}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button onClick={movePrevious}>{viewMode === "Day" ? "Previous Day" : viewMode === "Month" ? "Previous Month" : "Previous Week"}</Button>
              <Button onClick={moveNext}>{viewMode === "Day" ? "Next Day" : viewMode === "Month" ? "Next Month" : "Next Week"}</Button>
              <Button onClick={() => setAnchorDate(new Date())}>Today</Button>
              <Button onClick={refreshCalendar}><RefreshCw size={14} /> Refresh</Button>
              <NativeSelect options={["Week", "Day", "Month"]} value={viewMode} onChange={(value) => setViewMode(value as "Week" | "Day" | "Month")} />
              <Button onClick={() => setSidebarVisible((visible) => !visible)}>{sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}</Button>
              <Button variant="primary" onClick={() => createAt(anchorDate)}>New Event</Button>
            </div>
          </div>
          {viewMode === "Month" ? (
            <div className="grid grid-cols-7 border-b border-[#d8dde6] text-xs">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="border-b border-l border-[#d8dde6] bg-[#f3f3f3] p-2 text-center font-semibold">{day}</div>)}
              {monthDays.map((day) => {
                const dayEvents = visibleEvents.filter((event) => sameDate(new Date(String(event.startAt)), day));
                return (
                  <button key={toDateInputValue(day)} onClick={() => { setAnchorDate(day); setViewMode("Day"); }} className={cn("min-h-28 border-l border-t border-[#d8dde6] p-2 text-left align-top hover:bg-brand-50", !sameMonth(day, anchorDate) && "bg-[#fafafa] text-[#a8a8a8]")}>
                    <div className="mb-1 font-semibold">{day.getDate()}</div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => <CalendarEventChip key={requiredId(event)} event={event} />)}
                      {dayEvents.length > 3 && <div className="text-[11px] text-brand-700">+{dayEvents.length - 3} more</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="overflow-auto">
              <div className={cn("grid min-w-[980px] border-b border-[#d8dde6] text-xs", viewMode === "Day" ? "grid-cols-[80px_1fr]" : "grid-cols-[80px_repeat(7,1fr)]")}>
                <div className="bg-[#f3f3f3] p-2" />
                {visibleDays.map((day) => <div key={toDateInputValue(day)} className="border-l border-[#d8dde6] bg-[#f3f3f3] p-2 text-center font-semibold">{shortDayLabel(day)}</div>)}
                <div className="border-t border-[#d8dde6] p-2 text-[#706e6b]">All-Day Events</div>
                {visibleDays.map((day) => (
                  <div key={`${toDateInputValue(day)}-all`} className="min-h-10 border-l border-t border-[#d8dde6] p-1 text-xs">
                    {visibleEvents.filter((event) => event.allDay && sameDate(new Date(String(event.startAt)), day)).map((event) => <CalendarEventChip key={requiredId(event)} event={event} />)}
                  </div>
                ))}
                {hours.map((hour) => (
                  <div key={hour} className="contents">
                    <button className="border-t border-[#d8dde6] p-2 text-right text-[#706e6b] hover:bg-brand-50" onClick={() => createAt(anchorDate, hour)}>{hour}</button>
                    {visibleDays.map((day) => {
                      const cellEvents = visibleEvents.filter((event) => !event.allDay && sameDate(new Date(String(event.startAt)), day) && hourFromDate(event.startAt) === hour.slice(0, 2));
                      return (
                        <button key={`${toDateInputValue(day)}-${hour}`} onClick={() => createAt(day, hour)} className="min-h-12 border-l border-t border-[#d8dde6] p-1 text-left hover:bg-brand-50">
                          <div className="space-y-1">
                            {cellEvents.map((event) => <CalendarEventChip key={requiredId(event)} event={event} />)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      {calendarDialog && <CalendarSourceModal state={calendarDialog} onClose={() => setCalendarDialog(null)} onSave={saveCalendarSource} />}
    </>
  );
}

function CalendarSourceModal({ state, onClose, onSave }: { state: Exclude<CalendarSourceDialogState, null>; onClose: () => void; onSave: (values: RecordData, source?: RecordData) => Promise<void> }) {
  const source = state.type === "edit" ? state.source : undefined;
  const [values, setValues] = useState<RecordData>(() => ({
    name: String(source?.name ?? ""),
    type: calendarSourceType(source ?? { type: "My" }),
    color: String(source?.color ?? "#0176d3"),
    visible: source?.visible !== false
  }));
  const [error, setError] = useState("");

  function submit() {
    if (!String(values.name ?? "").trim()) {
      setError("Complete this field.");
      return;
    }
    setError("");
    void onSave(values, source);
  }

  return (
    <BaseDialog open title={source ? "Edit Calendar" : "Add Calendar"} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Save</Button></>}>
      <div className="grid gap-3">
        <FieldShell label="Calendar Name" required error={error}>
          <input className={inputClass} value={String(values.name ?? "")} onChange={(event) => setValues({ ...values, name: event.target.value })} />
        </FieldShell>
        <FieldShell label="Type">
          <NativeSelect options={["My", "Other"]} value={calendarSourceType(values)} onChange={(value) => setValues({ ...values, type: value })} />
        </FieldShell>
        <FieldShell label="Color">
          <div className="flex flex-wrap gap-2">
            {CALENDAR_SOURCE_COLORS.map((option) => {
              const selected = String(values.color ?? "#0176d3") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`Use ${option.label}`}
                  onClick={() => setValues({ ...values, color: option.value })}
                  className={cn("h-8 w-8 rounded border border-[#c9c9c9] ring-offset-2", selected && "ring-2 ring-brand-500")}
                  style={{ backgroundColor: option.value }}
                />
              );
            })}
          </div>
        </FieldShell>
        <FieldShell label="Visible">
          <RadixCheckbox checked={values.visible !== false} onCheckedChange={(checked) => setValues({ ...values, visible: Boolean(checked) })} />
        </FieldShell>
      </div>
    </BaseDialog>
  );
}

function QuickTextPage({ data, onCreate, onCreateFolder, onDelete }: { data: BootstrapData; onCreate: () => void; onCreateFolder: () => void; onDelete: (record: RecordData) => void }) {
  const [activeView, setActiveView] = useState("Recent");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [previewRecord, setPreviewRecord] = useState<RecordData | null>(null);
  const [showPreviewText, setShowPreviewText] = useState(true);
  const [showFolderColumn, setShowFolderColumn] = useState(true);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const foldersById = new Map(data.quickTextFolders.map((folder) => [String(folder.id), folder]));
  const visibleFolders = data.quickTextFolders.filter((folder) => {
    if (activeView === "Created by Me") return folder.ownerId === data.user.id;
    if (activeView === "Shared with Me") return String(folder.sharing ?? "").toLowerCase().includes("shared") || String(folder.sharing ?? "").toLowerCase().includes("public");
    return activeView === "All Folders";
  });
  const filteredRecords = data.quickTexts
    .filter((record) => {
      if (activeView === "All Favorites" && !favorites.includes(requiredId(record))) return false;
      if (["All Folders", "Created by Me", "Shared with Me"].includes(activeView)) {
        const folder = foldersById.get(String(record.folderId ?? ""));
        if (!folder) return false;
        if (activeView === "Created by Me" && folder.ownerId !== data.user.id) return false;
        if (activeView === "Shared with Me" && !String(folder.sharing ?? "").toLowerCase().match(/shared|public/)) return false;
      }
      return quickTextMatches(record, query, foldersById);
    })
    .sort((left, right) => {
      const comparison = quickTextTimestamp(right) - quickTextTimestamp(left);
      return sortDirection === "desc" ? comparison : -comparison;
    })
    .slice(activeView === "Recent" ? 0 : undefined, activeView === "Recent" ? 10 : undefined);
  const sidebarGroups = [
    { title: "QUICK TEXT", items: ["Recent", "All Quick Text"] },
    { title: "FOLDERS", items: ["All Folders", "Created by Me", "Shared with Me"] },
    { title: "FAVORITES", items: ["All Favorites"] }
  ];

  function toggleFavorite(id: string) {
    setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-3">
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">QUICK TEXT</h2>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button aria-label="Personalize your list view settings." className="rounded p-1 hover:bg-[#f3f3f3]"><Settings size={14} /></button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" className="z-50 w-72 rounded border border-[#d8dde6] bg-white p-3 text-sm shadow-popover">
                <div className="mb-3 font-semibold">List Display Settings</div>
                <label className="mb-2 flex items-center gap-2"><input type="checkbox" className={checkboxClass} checked={showPreviewText} onChange={(event) => setShowPreviewText(event.target.checked)} /> Show message preview</label>
                <label className="mb-3 flex items-center gap-2"><input type="checkbox" className={checkboxClass} checked={showFolderColumn} onChange={(event) => setShowFolderColumn(event.target.checked)} /> Show folder column</label>
                <FieldShell label="Sort">
                  <NativeSelect options={["Newest first", "Oldest first"]} value={sortDirection === "desc" ? "Newest first" : "Oldest first"} onChange={(value) => setSortDirection(value === "Newest first" ? "desc" : "asc")} />
                </FieldShell>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        {sidebarGroups.map((group, groupIndex) => (
          <div key={group.title} className={cn(groupIndex > 0 && "mt-4")}>
            {groupIndex > 0 && <h2 className="mb-1 font-semibold">{group.title}</h2>}
            {group.items.map((item) => (
              <button key={item} onClick={() => setActiveView(item)} className={cn("block w-full rounded px-2 py-2 text-left text-sm hover:bg-brand-50", activeView === item && "bg-brand-50 font-semibold text-brand-900")}>
                <span>{item}</span>
                <span className="float-right text-xs text-[#706e6b]">{quickTextViewCount(item, data, favorites)}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>
      <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde6] p-3">
          <div>
            <h1 className="text-xl font-semibold">Quick Text</h1>
            <div className="text-xs text-[#706e6b]">{filteredRecords.length} of {data.quickTexts.length} items - {activeView} - Updated a few seconds ago</div>
          </div>
          <div className="flex gap-1">
            <Button variant="primary" onClick={onCreate}>New Quick Text</Button>
            <Button onClick={onCreateFolder}>New Folder</Button>
          </div>
        </div>
        <div className="p-3">
          <div className="mb-3 flex h-8 max-w-sm items-center rounded border border-[#c9c9c9] px-2">
            <Search size={14} className="text-[#706e6b]" />
            <input className={inputBareClass} placeholder="Search recent quick text..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {visibleFolders.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleFolders.map((folder) => (
                <button key={requiredId(folder)} className="rounded border border-[#d8dde6] p-3 text-left hover:border-brand-500 hover:bg-brand-50" onClick={() => setQuery(String(folder.name ?? ""))}>
                  <div className="font-semibold">{String(folder.name ?? "Folder")}</div>
                  <div className="text-xs text-[#706e6b]">{data.quickTexts.filter((record) => record.folderId === folder.id).length} quick text item{data.quickTexts.filter((record) => record.folderId === folder.id).length === 1 ? "" : "s"} - {String(folder.sharing ?? "Private")}</div>
                </button>
              ))}
            </div>
          )}
          {filteredRecords.length === 0 ? (
            <EmptyPanel title="Nothing to see here" body="There's nothing in your list yet. Try adding new quick text." action="New Quick Text" onAction={onCreate} />
          ) : (
            <QuickTextLibraryTable
              records={filteredRecords}
              foldersById={foldersById}
              favorites={favorites}
              showPreviewText={showPreviewText}
              showFolderColumn={showFolderColumn}
              onPreview={setPreviewRecord}
              onToggleFavorite={toggleFavorite}
              onDelete={onDelete}
            />
          )}
          {previewRecord && (
            <BaseDialog open title={String(previewRecord.name ?? "Quick Text Preview")} onClose={() => setPreviewRecord(null)} footer={<Button onClick={() => setPreviewRecord(null)}>Close</Button>}>
              <div className="space-y-3 text-sm">
                <div className="rounded border border-[#d8dde6] p-3 whitespace-pre-wrap">{String(previewRecord.message ?? "")}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><div className="text-xs text-[#706e6b]">Category</div><div>{String(previewRecord.category ?? "-")}</div></div>
                  <div><div className="text-xs text-[#706e6b]">Channels</div><div>{Array.isArray(previewRecord.channels) ? previewRecord.channels.join(", ") : "-"}</div></div>
                </div>
              </div>
            </BaseDialog>
          )}
        </div>
      </section>
    </div>
  );
}

function QuickTextLibraryTable({
  records,
  foldersById,
  favorites,
  showPreviewText,
  showFolderColumn,
  onPreview,
  onToggleFavorite,
  onDelete
}: {
  records: RecordData[];
  foldersById: Map<string, RecordData>;
  favorites: string[];
  showPreviewText: boolean;
  showFolderColumn: boolean;
  onPreview: (record: RecordData) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (record: RecordData) => void;
}) {
  return (
    <div className="overflow-auto rounded border border-[#d8dde6]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
          <tr>
            <th className="border-b border-[#d8dde6] px-3 py-2">Quick Text Name</th>
            <th className="border-b border-[#d8dde6] px-3 py-2">Category</th>
            <th className="border-b border-[#d8dde6] px-3 py-2">Channel</th>
            {showFolderColumn && <th className="border-b border-[#d8dde6] px-3 py-2">Folder</th>}
            <th className="border-b border-[#d8dde6] px-3 py-2">Updated</th>
            <th className="border-b border-[#d8dde6] px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const id = requiredId(record);
            const favorite = favorites.includes(id);
            const folder = foldersById.get(String(record.folderId ?? ""));
            return (
              <tr key={id} className="border-t border-[#eef1f6] bg-white hover:bg-brand-50/40">
                <td className="px-3 py-2">
                  <button className="font-semibold text-brand-700 hover:underline" onClick={() => onPreview(record)}>{String(record.name ?? "Quick Text")}</button>
                  {showPreviewText && <div className="mt-1 max-w-xl truncate text-xs text-[#706e6b]">{String(record.message ?? "")}</div>}
                </td>
                <td className="px-3 py-2">{String(record.category ?? "-")}</td>
                <td className="px-3 py-2">{Array.isArray(record.channels) ? record.channels.join(", ") : "-"}</td>
                {showFolderColumn && <td className="px-3 py-2">{String(folder?.name ?? "Unfiled")}</td>}
                <td className="px-3 py-2">{record.updatedAt ? formatDateTime(String(record.updatedAt)) : "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button aria-label={favorite ? "Remove from favorites" : "Add to favorites"} className="rounded p-1 text-brand-700 hover:bg-white" onClick={() => onToggleFavorite(id)}>
                      <Bookmark size={14} fill={favorite ? "currentColor" : "none"} />
                    </button>
                    <button aria-label="Preview quick text" className="rounded p-1 text-[#706e6b] hover:bg-white hover:text-brand-700" onClick={() => onPreview(record)}>
                      <Eye size={14} />
                    </button>
                    <button aria-label="Delete quick text" className="rounded p-1 text-[#706e6b] hover:bg-white hover:text-[#ba0517]" onClick={() => onDelete(record)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModalHost({
  modal,
  data,
  recordLabels,
  campaignMembers,
  onClose,
  onSaveRecord,
  onSaveAppNav,
  onResetAppNav,
  onDataChange,
  onToast,
  onApplyListAction
}: {
  modal: ModalState | null;
  data: BootstrapData;
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  onClose: () => void;
  onSaveRecord: (object: CrmObject, values: RecordData, options?: { id?: string; stayOpen?: boolean }) => Promise<boolean>;
  onSaveAppNav: (app: AppKey, items: AppNavItem[]) => Promise<boolean>;
  onResetAppNav: (app: AppKey) => Promise<boolean>;
  onDataChange: BootstrapDataUpdater;
  onToast: (toast: ToastState) => void;
  onApplyListAction: (action: string, object: CrmObject, selectedIds: string[], payload: RecordData) => void;
}) {
  if (!modal) return null;
  if (modal.type === "confirm") {
    return (
      <BaseDialog open title={modal.title} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={modal.onConfirm}>Delete</Button></>}>
        <p className="text-sm text-[#444]">{modal.body}</p>
      </BaseDialog>
    );
  }
  if (modal.type === "navEdit") return <NavEditModal app={modal.app} data={data} onClose={onClose} onSave={onSaveAppNav} onReset={onResetAppNav} />;
  if (modal.type === "product") return <ProductWizardModal data={data} onClose={onClose} onSave={(values) => onSaveRecord("Product2", values)} />;
  if (modal.type === "event") return <EventModal data={data} relatedObjectType={modal.relatedObjectType} relatedRecordId={modal.relatedRecordId} startDate={modal.startDate} startTime={modal.startTime} endDate={modal.endDate} endTime={modal.endTime} onClose={onClose} onSave={(values) => onSaveRecord("Event", values)} />;
  if (modal.type === "quickText") return <QuickTextModal data={data} onClose={onClose} onSave={(values) => onSaveRecord("QuickText", values)} />;
  if (modal.type === "knowledge") return <KnowledgeModal onClose={onClose} onSave={(values) => onSaveRecord("Knowledge__kav", values)} />;
  if (modal.type === "listEmail") return <ListEmailWizard data={data} onClose={onClose} onSave={(values) => onSaveRecord("ListEmail", values)} />;
  if (modal.type === "listAction") return <ListActionModal modal={modal} data={data} recordLabels={recordLabels} campaignMembers={campaignMembers} onClose={onClose} onSaveRecord={onSaveRecord} onApply={onApplyListAction} />;
  if (modal.type === "quickTextFolder") return <QuickTextFolderModal onClose={onClose} onSave={(values) => onApplyListAction("New Folder", "QuickText", [], values)} />;
  if (modal.type === "marketingActivation") return <MarketingActivationModal onClose={onClose} onSave={(values) => onApplyListAction("Activate Marketing", "ListEmail", [], values)} />;
  if (modal.type === "store") return <StoreModal onClose={onClose} onSave={(values) => onApplyListAction("Create Store", "ListEmail", [], values)} />;
  if (modal.type === "reportBuilder") return <ReportBuilderModal reportType={modal.reportType} data={data} onClose={onClose} onDataChange={onDataChange} onToast={onToast} />;
  return <GenericRecordModal mode={modal.mode} object={modal.object} data={data} record={modal.record} onClose={onClose} onSave={(values, stayOpen) => onSaveRecord(modal.object, values, { id: modal.record?.id, stayOpen })} />;
}

function ListActionModal({
  modal,
  data,
  recordLabels,
  campaignMembers,
  onClose,
  onSaveRecord,
  onApply
}: {
  modal: Extract<ModalState, { type: "listAction" }>;
  data: BootstrapData;
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  onClose: () => void;
  onSaveRecord: (object: CrmObject, values: RecordData, options?: { id?: string; stayOpen?: boolean }) => Promise<boolean>;
  onApply: (action: string, object: CrmObject, selectedIds: string[], payload: RecordData) => void;
}) {
  const [values, setValues] = useState<RecordData>({
    campaign: "Starter Outreach",
    label: "Important",
    ownerName: data.user.name,
    articleAction: modal.action
  });
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    action: "Delete Article" | "Delete Draft";
    title: string;
    body: string;
    confirmLabel: string;
  } | null>(null);
  const selectedRecords = modal.selectedIds.length > 0 ? modal.records.filter((record) => modal.selectedIds.includes(requiredId(record))) : modal.records;
  const effectiveSelectedIds = modal.selectedIds.length > 0 ? modal.selectedIds : selectedRecords.map(requiredId).filter(Boolean);
  const targetCount = selectedRecords.length;
  const title = `${modal.action} ${OBJECT_DEFINITIONS[modal.object].plural}`;

  function openKnowledgeDeleteConfirmation(action: "Delete Article" | "Delete Draft") {
    const targetLabel = selectedRecords.length === 1
      ? `"${recordTitle("Knowledge__kav", selectedRecords[0])}"`
      : `${selectedRecords.length} knowledge article${selectedRecords.length === 1 ? "" : "s"}`;
    setConfirmAction({
      action,
      title: action === "Delete Draft" ? `Delete draft ${targetLabel}?` : `Delete ${targetLabel}?`,
      body:
        action === "Delete Draft"
          ? "Only selected draft articles will be deleted. Published and archived articles remain untouched."
          : "This permanently deletes the selected knowledge article records. This action can't be undone.",
      confirmLabel: action
    });
  }

  if (confirmAction) {
    return (
      <BaseDialog
        open
        title={confirmAction.title}
        onClose={onClose}
        footer={
          <>
            <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => onApply(confirmAction.action, modal.object, effectiveSelectedIds, values)}>
              {confirmAction.confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#444]">{confirmAction.body}</p>
      </BaseDialog>
    );
  }

  async function runImport() {
    setImporting(true);
    const rows = importText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const row of rows) {
      const payload = importPayloadForObject(modal.object, row, data);
      if (payload) await onSaveRecord(modal.object, payload, { stayOpen: true });
    }
    setImporting(false);
    onClose();
  }

  if (modal.action === "Import") {
    const sample = importSampleForObject(modal.object);
    const rows = importText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return (
      <BaseDialog
        open
        title={title}
        onClose={onClose}
        wide
        footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void runImport()}>{importing ? "Importing..." : "Import"}</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-[#706e6b]">Paste one record per line. This importer maps common Salesforce Starter fields for {OBJECT_DEFINITIONS[modal.object].plural}.</p>
          <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-2 text-xs text-[#706e6b]">Example: {sample}</div>
          <textarea className={cn(inputClass, "h-36")} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={sample} />
          <div className="rounded border border-[#d8dde6] p-3">
            <div className="mb-2 font-semibold">Preview ({rows.length})</div>
            {rows.length === 0 ? <p className="text-sm text-[#706e6b]">No rows ready to import.</p> : rows.slice(0, 5).map((row, index) => <div key={`${row}-${index}`} className="text-sm">{index + 1}. {row}</div>)}
          </div>
        </div>
      </BaseDialog>
    );
  }

  if (modal.action === "Printable View") {
    return (
      <BaseDialog open title="Printable View" onClose={onClose} wide footer={<><Button onClick={() => window.print()}>Print</Button><Button onClick={onClose}>Close</Button></>}>
        <div className="mb-3 text-sm text-[#706e6b]">{OBJECT_DEFINITIONS[modal.object].plural} - {targetCount} records</div>
        <table className="w-full border border-[#d8dde6] text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>{OBJECT_DEFINITIONS[modal.object].columns.slice(0, 5).map((column) => <th key={column.key} className="border border-[#d8dde6] px-2 py-1 text-left">{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {selectedRecords.map((record) => (
              <tr key={requiredId(record)}>{OBJECT_DEFINITIONS[modal.object].columns.slice(0, 5).map((column) => <td key={column.key} className="border border-[#d8dde6] px-2 py-1">{formatCell(record[column.key]) || "-"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </BaseDialog>
    );
  }

  if (modal.action === "Merge Cases") {
    return (
      <BaseDialog open title="Merge Cases" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onApply(modal.action, modal.object, effectiveSelectedIds, values)}>{targetCount >= 2 ? "Merge Cases" : "Done"}</Button></>}>
        {targetCount < 2 ? (
          <p className="text-sm text-[#706e6b]">Select at least two cases from the list to merge. The current list has {targetCount} selected case{targetCount === 1 ? "" : "s"}.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[#706e6b]">Choose a primary case. Related activities and files remain associated with the surviving case.</p>
            <NativeSelect options={selectedRecords.map((record) => String(record.caseNumber ?? record.subject ?? record.id))} value={String(values.primaryCase ?? selectedRecords[0]?.caseNumber ?? "")} onChange={(value) => setValues({ ...values, primaryCase: value })} />
          </div>
        )}
      </BaseDialog>
    );
  }

  if (modal.object === "Lead" && modal.action === "Show more actions") {
    const firstLead = selectedRecords[0] ?? {};
    const defaultAccountName = String(firstLead.company ?? "").trim() || "Converted Lead Account";
    const defaultOpportunityName = `${String(firstLead.company ?? contactName(firstLead) ?? "Converted Lead").trim() || "Converted Lead"} Opportunity`;
    const accountName = String(values.accountName ?? defaultAccountName);
    const createOpportunity = values.createOpportunity !== false;
    const closeDate = String(values.closeDate ?? defaultLeadConversionCloseDate());
    const stage = String(values.stage ?? "Qualify");
    const forecastCategory = String(values.forecastCategory ?? "Pipeline");
    const convertedStatus = String(values.convertedStatus ?? "Qualified");
    const footer = (
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() =>
            onApply("Convert Lead", "Lead", effectiveSelectedIds, {
              accountName,
              createOpportunity,
              opportunityName: String(values.opportunityName ?? defaultOpportunityName),
              closeDate,
              stage,
              forecastCategory,
              convertedStatus
            })
          }
        >
          Convert Lead
        </Button>
      </>
    );
    return (
      <BaseDialog open title="Show More Actions: Leads" onClose={onClose} wide footer={footer}>
        <div className="grid gap-4">
          <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-3 text-sm">
            <div className="font-semibold">Convert Lead</div>
            <div className="mt-1 text-xs text-[#706e6b]">
              {targetCount > 0 ? `${targetCount} lead${targetCount === 1 ? "" : "s"} will be converted.` : "Select a lead before converting."}
            </div>
          </div>
          {targetCount > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <FieldShell label="Account Name">
                <input
                  className={inputClass}
                  value={accountName}
                  disabled={targetCount > 1}
                  onChange={(event) => setValues({ ...values, accountName: event.target.value })}
                />
                {targetCount > 1 && <p className="mt-1 text-xs text-[#706e6b]">Each selected lead uses its Company value for the converted account.</p>}
              </FieldShell>
              <FieldShell label="Converted Status">
                <NativeSelect options={LEAD_STATUS.filter((status) => status !== "--None--")} value={convertedStatus} onChange={(value) => setValues({ ...values, convertedStatus: value })} />
              </FieldShell>
              <FieldShell label="Create Opportunity">
                <RadixCheckbox checked={createOpportunity} onCheckedChange={(value) => setValues({ ...values, createOpportunity: Boolean(value) })} />
              </FieldShell>
              {createOpportunity && (
                <>
                  <FieldShell label="Opportunity Name">
                    <input className={inputClass} value={String(values.opportunityName ?? defaultOpportunityName)} onChange={(event) => setValues({ ...values, opportunityName: event.target.value })} />
                  </FieldShell>
                  <FieldShell label="Close Date">
                    <input className={inputClass} type="date" value={closeDate} onChange={(event) => setValues({ ...values, closeDate: event.target.value })} />
                  </FieldShell>
                  <FieldShell label="Stage">
                    <NativeSelect options={OPPORTUNITY_STAGE.filter((item) => item !== "--None--")} value={stage} onChange={(value) => setValues({ ...values, stage: value })} />
                  </FieldShell>
                  <FieldShell label="Forecast Category">
                    <NativeSelect options={FORECAST_CATEGORY.filter((item) => item !== "--None--")} value={forecastCategory} onChange={(value) => setValues({ ...values, forecastCategory: value })} />
                  </FieldShell>
                </>
              )}
            </div>
          )}
          <div className="rounded border border-[#d8dde6]">
            <div className="border-b border-[#d8dde6] bg-[#f8f8f8] px-3 py-2 text-xs font-semibold uppercase text-[#706e6b]">Selected Leads</div>
            <div className="max-h-48 overflow-auto p-2">
              {selectedRecords.length === 0 ? (
                <div className="p-3 text-sm text-[#706e6b]">No leads selected.</div>
              ) : (
                selectedRecords.map((lead) => (
                  <div key={requiredId(lead)} className="grid gap-1 border-b border-[#f3f3f3] px-2 py-2 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_120px]">
                    <span className="font-medium">{contactName(lead) || "Unnamed Lead"}</span>
                    <span className="text-[#706e6b]">{String(lead.company ?? "No company")}</span>
                    <span className="text-[#706e6b]">{String(lead.status ?? "New")}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </BaseDialog>
    );
  }

  if (["Publish", "Assign", "Archive", "Delete Article", "Show more actions"].includes(modal.action)) {
    const targetLabel = `${targetCount || modal.records.length} article record${(targetCount || modal.records.length) === 1 ? "" : "s"}`;
    return (
      <BaseDialog
        open
        title={title}
        onClose={onClose}
        footer={
          modal.action === "Show more actions"
            ? <><Button onClick={onClose}>Close</Button></>
            : (
              <>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                  variant={modal.action === "Delete Article" ? "destructive" : "primary"}
                  onClick={() =>
                    modal.action === "Delete Article"
                      ? openKnowledgeDeleteConfirmation("Delete Article")
                      : onApply(modal.action, modal.object, effectiveSelectedIds, values)
                  }
                >
                  {modal.action}
                </Button>
              </>
            )
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#706e6b]">{targetLabel} will be affected.</p>
          {modal.action === "Assign" && <FieldShell label="Assign To"><input className={inputClass} value={String(values.assignee ?? data.user.name)} onChange={(event) => setValues({ ...values, assignee: event.target.value })} /></FieldShell>}
          {modal.action === "Archive" && <FieldShell label="Archive Reason"><textarea className={inputClass} value={String(values.reason ?? "")} onChange={(event) => setValues({ ...values, reason: event.target.value })} /></FieldShell>}
          {modal.action === "Delete Article" && <div className="rounded border border-[#ba0517] bg-[#fff1f1] p-3 text-sm text-[#8e030f]">Delete Article requires a confirmation step before any records are removed.</div>}
          {modal.action === "Show more actions" && (
            <div className="space-y-3">
              <div className="rounded border border-[#d8dde6] p-3">
                <div className="font-semibold">Delete Draft</div>
                <p className="mt-1 text-sm text-[#706e6b]">Delete selected articles that are still drafts. Published and archived articles remain untouched.</p>
                <div className="mt-2"><Button variant="destructive" onClick={() => openKnowledgeDeleteConfirmation("Delete Draft")}>Delete Draft</Button></div>
              </div>
              <div className="rounded border border-[#d8dde6] p-3">
                <div className="font-semibold">Restore</div>
                <p className="mt-1 text-sm text-[#706e6b]">Move archived selected articles back to Draft and clear archive metadata.</p>
                <div className="mt-2"><Button onClick={() => onApply("Restore", modal.object, effectiveSelectedIds, values)}>Restore</Button></div>
              </div>
              <div className="rounded border border-[#d8dde6] p-3">
                <FieldShell label="New Owner">
                  <input className={inputClass} value={String(values.ownerName ?? data.user.name)} onChange={(event) => setValues({ ...values, ownerName: event.target.value })} />
                </FieldShell>
                <div className="mt-2"><Button onClick={() => onApply("Change Owner", modal.object, effectiveSelectedIds, values)}>Change Owner</Button></div>
              </div>
            </div>
          )}
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog open title={title} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onApply(modal.action, modal.object, effectiveSelectedIds, values)}>Save</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-[#706e6b]">{targetCount} selected record{targetCount === 1 ? "" : "s"}; if none are selected, the current list result set is used.</p>
        {modal.action === "Add to Campaign" && (
          <>
            <FieldShell label="Campaign"><input className={inputClass} value={String(values.campaign ?? "")} onChange={(event) => setValues({ ...values, campaign: event.target.value })} /></FieldShell>
            <FieldShell label="Member Status"><NativeSelect options={["Sent", "Responded", "Planned"]} value={String(values.status ?? "Sent")} onChange={(value) => setValues({ ...values, status: value })} /></FieldShell>
            <div className="rounded border border-[#d8dde6] p-2 text-xs text-[#706e6b]">Existing campaign memberships: {Object.values(campaignMembers).flat().length}</div>
          </>
        )}
        {modal.action === "Assign Label" && (
          <>
            <FieldShell label="Label"><input className={inputClass} value={String(values.label ?? "")} onChange={(event) => setValues({ ...values, label: event.target.value })} /></FieldShell>
            <div className="rounded border border-[#d8dde6] p-2 text-xs text-[#706e6b]">Existing labels in this session: {Object.values(recordLabels).flat().join(", ") || "None"}</div>
          </>
        )}
        {modal.action === "Change Owner" && <FieldShell label="New Owner"><input className={inputClass} value={String(values.ownerName ?? "")} onChange={(event) => setValues({ ...values, ownerName: event.target.value })} /></FieldShell>}
        {modal.action === "Add to Category" && <FieldShell label="Category"><input className={inputClass} value={String(values.category ?? "Products")} onChange={(event) => setValues({ ...values, category: event.target.value })} /></FieldShell>}
      </div>
    </BaseDialog>
  );
}

function QuickTextFolderModal({ onClose, onSave }: { onClose: () => void; onSave: (values: RecordData) => void }) {
  const [values, setValues] = useState<RecordData>({ name: "Personal Quick Text", sharing: "Private" });
  return (
    <BaseDialog open title="New Folder" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(values)}>Save</Button></>}>
      <div className="space-y-3">
        <FieldShell label="Folder Name" required><input className={inputClass} value={String(values.name ?? "")} onChange={(event) => setValues({ ...values, name: event.target.value })} /></FieldShell>
        <FieldShell label="Sharing"><NativeSelect options={["Private", "Shared with Me", "Public"]} value={String(values.sharing ?? "Private")} onChange={(value) => setValues({ ...values, sharing: value })} /></FieldShell>
      </div>
    </BaseDialog>
  );
}

function MarketingActivationModal({ onClose, onSave }: { onClose: () => void; onSave: (values: RecordData) => void }) {
  const [values, setValues] = useState<RecordData>({ senderName: CURRENT_USER.name, senderEmail: "parsa@example.com", tracking: true });
  return (
    <BaseDialog open title="Activate Marketing" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(values)}>Activate</Button></>}>
      <div className="space-y-3">
        <FieldShell label="Default Sender Name"><input className={inputClass} value={String(values.senderName ?? "")} onChange={(event) => setValues({ ...values, senderName: event.target.value })} /></FieldShell>
        <FieldShell label="Default Sender Email"><input className={inputClass} type="email" value={String(values.senderEmail ?? "")} onChange={(event) => setValues({ ...values, senderEmail: event.target.value })} /></FieldShell>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className={checkboxClass} checked={Boolean(values.tracking)} onChange={(event) => setValues({ ...values, tracking: event.target.checked })} /> Enable email tracking and analytics</label>
      </div>
    </BaseDialog>
  );
}

function StoreModal({ onClose, onSave }: { onClose: () => void; onSave: (values: RecordData) => void }) {
  const [values, setValues] = useState<RecordData>({ name: "Starter Store", currency: "USD", status: "Draft" });
  return (
    <BaseDialog open title="Create Store" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(values)}>Create Store</Button></>}>
      <div className="space-y-3">
        <FieldShell label="Store Name" required><input className={inputClass} value={String(values.name ?? "")} onChange={(event) => setValues({ ...values, name: event.target.value })} /></FieldShell>
        <FieldShell label="Currency"><NativeSelect options={["USD", "AED", "EUR", "GBP"]} value={String(values.currency ?? "USD")} onChange={(value) => setValues({ ...values, currency: value })} /></FieldShell>
        <FieldShell label="Launch Status"><NativeSelect options={["Draft", "Preview", "Active"]} value={String(values.status ?? "Draft")} onChange={(value) => setValues({ ...values, status: value })} /></FieldShell>
      </div>
    </BaseDialog>
  );
}

function ReportBuilderModal({ reportType, data, onClose, onDataChange, onToast }: { reportType?: string; data: BootstrapData; onClose: () => void; onDataChange: BootstrapDataUpdater; onToast: (toast: ToastState) => void }) {
  const dashboardMode = reportType === "Dashboard";
  const initialType = reportBuilderTypeFrom(reportType);
  const [builderType, setBuilderType] = useState<ReportBuilderType>(initialType);
  const [groupField, setGroupField] = useState(reportBuilderConfigs[initialType].defaultGroup);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(reportBuilderConfigs[initialType].columns);
  const [reportName, setReportName] = useState(`${initialType} by ${reportBuilderFieldLabel(reportBuilderConfigs[initialType].object, reportBuilderConfigs[initialType].defaultGroup)}`);
  const [dashboardName, setDashboardName] = useState("Executive CRM Dashboard");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const analyticsReports = useMemo(() => buildAnalyticsReports(data), [data]);
  const [dashboardReportIds, setDashboardReportIds] = useState<string[]>(() => analyticsReports.slice(0, 4).map((report) => report.id));
  const config = reportBuilderConfigs[builderType];
  const records = reportBuilderRecords(data, builderType);
  const previewReport = useMemo(() => reportBuilderPreviewReport(data, builderType, groupField), [data, builderType, groupField]);
  const previewRows = records.slice(0, 5);
  const selectedDashboardReports = analyticsReports.filter((report) => dashboardReportIds.includes(report.id));

  function selectType(type: ReportBuilderType) {
    const nextConfig = reportBuilderConfigs[type];
    setBuilderType(type);
    setGroupField(nextConfig.defaultGroup);
    setSelectedColumns(nextConfig.columns);
    setReportName(`${type} by ${reportBuilderFieldLabel(nextConfig.object, nextConfig.defaultGroup)}`);
  }

  function toggleColumn(column: string) {
    setSelectedColumns((current) => {
      if (current.includes(column)) return current.length === 1 ? current : current.filter((item) => item !== column);
      return [...current, column];
    });
  }

  function toggleDashboardReport(id: string) {
    setDashboardReportIds((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      return [...current, id];
    });
  }

  async function saveReport() {
    if (!reportName.trim()) {
      setError("Complete this field.");
      return;
    }
    setSaving(true);
    const response = await postUtility("saveCustomReport", undefined, {
      name: reportName.trim(),
      object: config.object,
      groupField,
      columns: selectedColumns
    });
    setSaving(false);
    if (!Array.isArray(response?.customReports)) {
      setError("Report couldn't be saved.");
      onToast({ tone: "error", message: "Report couldn't be saved." });
      return;
    }
    onDataChange((previous) => ({ ...previous, customReports: response.customReports as RecordData[] }));
    onToast({ tone: "success", message: `Report "${reportName.trim()}" saved.` });
    onClose();
  }

  async function saveDashboard() {
    if (!dashboardName.trim()) {
      setError("Complete this field.");
      return;
    }
    if (dashboardReportIds.length === 0) {
      setError("Select at least one dashboard component.");
      return;
    }
    setSaving(true);
    const response = await postUtility("saveCustomDashboard", undefined, {
      name: dashboardName.trim(),
      reportIds: dashboardReportIds
    });
    setSaving(false);
    if (!Array.isArray(response?.customDashboards)) {
      setError("Dashboard couldn't be saved.");
      onToast({ tone: "error", message: "Dashboard couldn't be saved." });
      return;
    }
    onDataChange((previous) => ({ ...previous, customDashboards: response.customDashboards as RecordData[] }));
    onToast({ tone: "success", message: `Dashboard "${dashboardName.trim()}" saved.` });
    onClose();
  }

  if (dashboardMode) {
    return (
      <BaseDialog open title="New Dashboard" onClose={onClose} wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void saveDashboard()}>{saving ? "Saving..." : "Save Dashboard"}</Button></>}>
        <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded border border-[#d8dde6] p-3">
            <FieldShell label="Dashboard Name" error={error && !dashboardName.trim() ? error : ""}>
              <input className={inputClass} value={dashboardName} onChange={(event) => { setError(""); setDashboardName(event.target.value); }} />
            </FieldShell>
            <div className="mb-2 font-semibold">Dashboard Components</div>
            <div className="space-y-1">
              {analyticsReports.map((report) => (
                <label key={report.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm hover:bg-brand-50">
                  <input type="checkbox" checked={dashboardReportIds.includes(report.id)} onChange={() => toggleDashboardReport(report.id)} className={cn(checkboxClass, "mt-1")} />
                  <span>
                    <span className="block font-medium">{report.title}</span>
                    <span className="block text-xs text-[#706e6b]">{report.objectLabel}</span>
                  </span>
                </label>
              ))}
            </div>
          </aside>
          <div className="rounded border border-[#d8dde6] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">Dashboard Preview</div>
                <div className="text-xs text-[#706e6b]">{selectedDashboardReports.length} component{selectedDashboardReports.length === 1 ? "" : "s"}</div>
              </div>
              <Button onClick={() => onToast({ tone: "success", message: "Dashboard preview refreshed." })}><RefreshCw size={13} /> Refresh</Button>
            </div>
            {error && dashboardName.trim() && <div className="mb-3 rounded border border-[#f1c40f] bg-[#fff7d6] px-3 py-2 text-xs text-[#5f4b00]">{error}</div>}
            <div className="grid gap-3 md:grid-cols-2">
              {selectedDashboardReports.map((report) => (
                <div key={report.id} className="rounded border border-[#d8dde6] p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{report.title}</div>
                      <div className="text-xs text-[#706e6b]">{report.objectLabel}</div>
                    </div>
                    <LayoutDashboard size={16} className="text-brand-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {report.metrics.slice(0, 2).map((metric) => (
                      <div key={metric.label} className="rounded border border-[#d8dde6] p-2">
                        <div className="text-[11px] text-[#706e6b]">{metric.label}</div>
                        <div className="font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {report.rows.slice(0, 3).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{row.label}</span>
                        <span className="shrink-0 font-semibold">{formatReportValue(report, row)}</span>
                      </div>
                    ))}
                    {report.rows.length === 0 && <div className="text-xs text-[#706e6b]">{report.emptyMessage}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog open title="Report Builder" onClose={onClose} wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void saveReport()}>{saving ? "Saving..." : "Save Report"}</Button></>}>
      <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded border border-[#d8dde6] p-3">
          <div className="mb-2 font-semibold">Report Types</div>
          <div className="space-y-1">
            {reportBuilderTypes.map((type) => (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={cn("block w-full rounded px-2 py-2 text-left text-sm hover:bg-brand-50", builderType === type && "bg-brand-50 font-semibold text-brand-900")}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-[#d8dde6] pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#706e6b]">Columns</div>
            <div className="space-y-1">
              {config.columns.map((column) => (
                <label key={column} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brand-50">
                  <input type="checkbox" checked={selectedColumns.includes(column)} onChange={() => toggleColumn(column)}  className={checkboxClass} />
                  <span>{reportBuilderFieldLabel(config.object, column)}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>
        <div className="space-y-3">
          <div className="rounded border border-[#d8dde6] p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <FieldShell label="Report Name">
                <input className={inputClass} value={reportName} onChange={(event) => { setError(""); setReportName(event.target.value); }} />
              </FieldShell>
              <FieldShell label="Group Rows">
                <NativeSelect options={config.groupOptions.map((option) => option.label)} value={reportBuilderFieldLabel(config.object, groupField)} onChange={(label) => {
                  const option = config.groupOptions.find((item) => item.label === label);
                  if (option) setGroupField(option.field);
                }} />
              </FieldShell>
            </div>
          </div>
          {error && <div className="rounded border border-[#f1c40f] bg-[#fff7d6] px-3 py-2 text-xs text-[#5f4b00]">{error}</div>}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
            <ReportBarChart report={previewReport} />
            <div className="rounded border border-[#d8dde6] p-3">
              <div className="mb-3 font-semibold">Outline</div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#706e6b]">Object</dt>
                  <dd>{OBJECT_DEFINITIONS[config.object].label}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Rows</dt>
                  <dd>{records.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Groups</dt>
                  <dd>{previewReport.rows.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Columns</dt>
                  <dd>{selectedColumns.length}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded border border-[#d8dde6]">
            <div className="flex items-center justify-between border-b border-[#d8dde6] p-3">
              <div className="font-semibold">Preview</div>
              <div className="text-xs text-[#706e6b]">First {previewRows.length} row{previewRows.length === 1 ? "" : "s"}</div>
            </div>
            {previewRows.length === 0 ? (
              <div className="p-4 text-sm text-[#706e6b]">{previewReport.emptyMessage}</div>
            ) : (
              <div className="slds-scrollbar overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f3f3f3] text-xs text-[#444]">
                    <tr>
                      {selectedColumns.map((column) => <th key={column} className="border-b border-[#d8dde6] px-3 py-2">{reportBuilderFieldLabel(config.object, column)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((record) => (
                      <tr key={requiredId(record)} className="border-t border-[#d8dde6] hover:bg-brand-50/40">
                        {selectedColumns.map((column) => <td key={column} className="px-3 py-2">{formatCell(record[column]) || "-"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}

function UnsavedChangesDialog({ onKeepEditing, onDiscard }: { onKeepEditing: () => void; onDiscard: () => void }) {
  return (
    <BaseDialog
      open
      title="Discard changes?"
      onClose={onKeepEditing}
      footer={<><Button onClick={onKeepEditing}>Keep Editing</Button><Button variant="destructive" onClick={onDiscard}>Discard</Button></>}
    >
      <p className="text-sm text-[#3e3e3c]">You have unsaved changes. Discard them and close this window?</p>
    </BaseDialog>
  );
}

function useUnsavedChangesGuard(isDirty: boolean, onClose: () => void) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  function requestClose() {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }
  const discardDialog = confirmDiscard ? <UnsavedChangesDialog onKeepEditing={() => setConfirmDiscard(false)} onDiscard={onClose} /> : null;
  return { requestClose, discardDialog };
}

function GenericRecordModal({ mode, object, data, record, onClose, onSave }: { mode: "new" | "edit"; object: CrmObject; data: BootstrapData; record?: RecordData; onClose: () => void; onSave: (values: RecordData, stayOpen?: boolean) => Promise<boolean> }) {
  const definition = FORM_DEFINITIONS[object];
  const [initialValues, setInitialValues] = useState<RecordData>(() => (definition ? buildInitialValues(definition, record) : {}));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  if (!definition) return null;

  const formDefinition = definition;
  const title = mode === "edit" && record ? `Edit ${recordTitle(object, record)}` : formDefinition.title;

  async function submit(stayOpen = false) {
    const nextErrors = validateFields(formDefinition.fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const ok = await onSave(values, stayOpen);
    if (ok && stayOpen) {
      const nextInitialValues = buildInitialValues(formDefinition);
      setInitialValues(nextInitialValues);
      setValues(nextInitialValues);
      setErrors({});
    }
  }

  if (discardDialog) return discardDialog;

  return (
    <BaseDialog
      open
      title={title}
      onClose={requestClose}
      wide
      footer={<><Button onClick={requestClose}>Cancel</Button>{mode === "new" && <Button onClick={() => void submit(true)}>Save & New</Button>}<Button variant="primary" onClick={() => void submit(false)}>Save</Button></>}
    >
      <div className="mb-4 text-xs text-[#706e6b]"><span className="text-[#ba0517]">*</span> = Required Information</div>
      <FormFields
        fields={formDefinition.fields}
        values={values}
        errors={errors}
        data={data}
        onChange={(name, value) =>
          setValues((current) => {
            const next = { ...current, [name]: value };
            for (const field of formDefinition.fields) {
              if (field.dependsOn === name) {
                const options = picklistOptionsForField(field, next);
                const currentDependent = String(next[field.name] ?? "--None--");
                if (!options.includes(currentDependent)) next[field.name] = "--None--";
              }
            }
            return next;
          })
        }
      />
    </BaseDialog>
  );
}

function ProductWizardModal({ data, onClose, onSave }: { data: BootstrapData; onClose: () => void; onSave: (values: RecordData) => Promise<boolean> }) {
  const [step, setStep] = useState(1);
  const [initialValues] = useState<RecordData>(() => ({ active: false, family: "--None--", currency: "USD", createPriceBookEntry: true, priceBookId: data.priceBooks[0]?.id ?? "standard-price-book", priceBookName: data.priceBooks[0]?.name ?? "Standard Price Book", entryActive: true }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [error, setError] = useState("");
  const [entryError, setEntryError] = useState("");
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);
  async function finish() {
    if (values.createPriceBookEntry !== false && !values.listPrice) {
      setEntryError("Complete this field.");
      return;
    }
    setEntryError("");
    const ok = await onSave(values);
    if (ok) onClose();
  }
  if (discardDialog) return discardDialog;
  return (
    <BaseDialog open title="New Product" onClose={requestClose} wide footer={step === 1 ? <><Button onClick={requestClose}>Cancel</Button><Button variant="primary" onClick={() => { if (!values.name) setError("Complete this field."); else { setError(""); setStep(2); } }}>Next</Button></> : <><Button onClick={() => setStep(1)}>Back</Button><Button variant="primary" onClick={() => void finish()}>Finish</Button></>}>
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <div className={cn("rounded border p-2", step === 1 ? "border-brand-500 bg-brand-50" : "border-[#d8dde6]")}>New Product - {step === 1 ? "Current Stage" : "Complete"}</div>
        <div className={cn("rounded border p-2", step === 2 ? "border-brand-500 bg-brand-50" : "border-[#d8dde6]")}>New Price Book Entry - {step === 2 ? "Current Stage" : "Stage Not Started"}</div>
      </div>
      <div className="mb-4 text-xs text-[#706e6b]">Progress: {step === 1 ? "0%" : "50%"}</div>
      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Product Name" required error={error}><input className={inputClass} value={String(values.name ?? "")} onChange={(event) => setValues({ ...values, name: event.target.value })} /></FieldShell>
          <FieldShell label="Product Family"><NativeSelect options={PRODUCT_FAMILY} value={String(values.family ?? "--None--")} onChange={(value) => setValues({ ...values, family: value })} /></FieldShell>
          <FieldShell label="Product Code"><input className={inputClass} value={String(values.productCode ?? "")} onChange={(event) => setValues({ ...values, productCode: event.target.value })} /></FieldShell>
          <FieldShell label="Product SKU"><input className={inputClass} value={String(values.sku ?? "")} onChange={(event) => setValues({ ...values, sku: event.target.value })} /></FieldShell>
          <FieldShell label="Active"><RadixCheckbox checked={Boolean(values.active)} onCheckedChange={(value) => setValues({ ...values, active: Boolean(value) })} /></FieldShell>
          <FieldShell label="Product Description"><textarea className={inputClass} value={String(values.description ?? "")} onChange={(event) => setValues({ ...values, description: event.target.value })} /></FieldShell>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Create Price Book Entry"><RadixCheckbox checked={values.createPriceBookEntry !== false} onCheckedChange={(value) => setValues({ ...values, createPriceBookEntry: Boolean(value) })} /></FieldShell>
          <FieldShell label="Price Book">
            <NativeSelect
              options={[...(data.priceBooks.length ? data.priceBooks.map((book) => String(book.name)) : ["Standard Price Book"]), "New Standard Price Book"]}
              value={String(values.priceBookName ?? "Standard Price Book")}
              onChange={(value) => {
                const selected = data.priceBooks.find((book) => book.name === value);
                setValues({ ...values, priceBookName: value, priceBookId: selected?.id ?? "" });
              }}
            />
          </FieldShell>
          <FieldShell label="List Price" required={values.createPriceBookEntry !== false} error={entryError}><input className={inputClass} type="number" min="0" step="0.01" value={String(values.listPrice ?? "")} onChange={(event) => setValues({ ...values, listPrice: event.target.value })} /></FieldShell>
          <FieldShell label="Currency"><NativeSelect options={["USD", "AED", "EUR", "GBP"]} value={String(values.currency ?? "USD")} onChange={(value) => setValues({ ...values, currency: value })} /></FieldShell>
          <FieldShell label="Active"><RadixCheckbox checked={Boolean(values.entryActive)} onCheckedChange={(value) => setValues({ ...values, entryActive: Boolean(value) })} /></FieldShell>
          <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-3 text-sm text-[#706e6b] md:col-span-2">
            Finish creates the product and {values.createPriceBookEntry === false ? "skips price book entry creation." : "adds it to the selected price book."}
          </div>
        </div>
      )}
    </BaseDialog>
  );
}

function EventModal({
  data,
  relatedObjectType,
  relatedRecordId,
  startDate = "2026-07-08",
  startTime = "09:00",
  endDate,
  endTime,
  onClose,
  onSave
}: {
  data: BootstrapData;
  relatedObjectType?: CrmObject;
  relatedRecordId?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  onClose: () => void;
  onSave: (values: RecordData) => Promise<boolean>;
}) {
  const relatedPlural = relatedObjectType && relatedObjectType !== "Event"
    ? OBJECT_DEFINITIONS[relatedObjectType]?.plural
    : undefined;
  const relatedTypeDefault = relatedPlural && RELATED_OBJECT_TYPES.includes(relatedPlural)
    ? relatedPlural
    : relatedObjectType === "Contact" || relatedObjectType === "Lead"
      ? "Accounts"
      : "Accounts";
  const nameTypeDefault =
    relatedObjectType === "Lead" ? "Leads" : relatedObjectType === "Contact" ? "Contacts" : "Contacts";
  const nameRecordDefault =
    relatedObjectType === "Contact" || relatedObjectType === "Lead" ? relatedRecordId : undefined;
  const relatedRecordDefault =
    relatedObjectType && relatedObjectType !== "Contact" && relatedObjectType !== "Lead" && relatedObjectType !== "Event"
      ? relatedRecordId
      : relatedObjectType === "Contact"
        ? (() => {
            const contact = data.contacts.find((item) => item.id === relatedRecordId);
            return contact?.accountId ? String(contact.accountId) : undefined;
          })()
        : undefined;

  const [initialValues] = useState<RecordData>(() => ({
    subject: "--None--",
    startDate,
    startTime,
    endDate: endDate ?? startDate,
    endTime: endTime ?? nextTimeSlot(startTime),
    assignedToId: CURRENT_USER.id,
    showTimeAs: "Busy",
    attendeeIds: [CURRENT_USER.id],
    nameObjectType: nameTypeDefault,
    nameRecordId: nameRecordDefault ?? "",
    relatedObjectType: relatedTypeDefault,
    relatedRecordId: relatedRecordDefault ?? ""
  }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  const nameLookupField: FieldDefinition = {
    name: "nameRecordId",
    label: "Name",
    section: "Related Records",
    type: "lookup",
    lookupObject: String(values.nameObjectType ?? "Contacts") === "Leads" ? "Lead" : "Contact"
  };
  const relatedLookupObject = relatedPluralToCrmObject(String(values.relatedObjectType ?? "Accounts"));
  const relatedLookupField: FieldDefinition | null = relatedLookupObject
    ? {
        name: "relatedRecordId",
        label: "Related To",
        section: "Related Records",
        type: "lookup",
        lookupObject: relatedLookupObject
      }
    : null;

  async function submit(stayOpen = false) {
    const required = ["subject", "startDate", "startTime", "endDate", "endTime", "assignedToId"];
    const nextErrors = Object.fromEntries(required.filter((key) => !values[key] || values[key] === "--None--").map((key) => [key, "Complete this field."]));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const payload = {
      ...values,
      nameRecordId: values.nameRecordId || null,
      relatedRecordId: values.relatedRecordId || null,
      startAt: `${values.startDate}T${values.startTime}:00.000Z`,
      endAt: `${values.endDate}T${values.endTime}:00.000Z`
    };
    const ok = await onSave(payload);
    if (ok && stayOpen) {
      setValues(initialValues);
      setErrors({});
    }
  }
  if (discardDialog) return discardDialog;
  return (
    <BaseDialog open title="New Event" onClose={requestClose} wide footer={<><Button onClick={requestClose}>Cancel</Button><Button onClick={() => void submit(true)}>Save & New</Button><Button variant="primary" onClick={() => void submit(false)}>Save</Button></>}>
      <div className="mb-4 text-xs text-[#706e6b]"><span className="text-[#ba0517]">*</span>= Required Information</div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldShell label="Subject" required error={errors.subject}><NativeSelect options={["--None--", ...EVENT_SUBJECTS]} value={String(values.subject ?? "--None--")} onChange={(value) => setValues({ ...values, subject: value })} /></FieldShell>
        <FieldShell label="Description"><textarea className={inputClass} value={String(values.description ?? "")} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Type Control + period to insert quick text." /></FieldShell>
        <FieldShell label="Start Date" required error={errors.startDate}><input className={inputClass} type="date" value={String(values.startDate)} onChange={(event) => setValues({ ...values, startDate: event.target.value })} /></FieldShell>
        <FieldShell label="Start Time" required error={errors.startTime}><NativeSelect options={TIME_SLOTS} value={String(values.startTime)} onChange={(value) => setValues({ ...values, startTime: value })} /></FieldShell>
        <FieldShell label="End Date" required error={errors.endDate}><input className={inputClass} type="date" value={String(values.endDate)} onChange={(event) => setValues({ ...values, endDate: event.target.value })} /></FieldShell>
        <FieldShell label="End Time" required error={errors.endTime}><NativeSelect options={TIME_SLOTS} value={String(values.endTime)} onChange={(value) => setValues({ ...values, endTime: value })} /></FieldShell>
        <FieldShell label="Attendees"><input className={inputClass} placeholder="Search People..." value={data.user.name} readOnly /></FieldShell>
        <FieldShell label="Name">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <NativeSelect
              options={NAME_OBJECT_TYPES}
              value={String(values.nameObjectType ?? "Contacts")}
              onChange={(value) => setValues({ ...values, nameObjectType: value, nameRecordId: "" })}
            />
            <LookupField
              field={nameLookupField}
              value={String(values.nameRecordId ?? "")}
              data={data}
              onChange={(next) => setValues({ ...values, nameRecordId: next })}
            />
          </div>
        </FieldShell>
        <FieldShell label="Related To">
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <NativeSelect
              options={RELATED_OBJECT_TYPES}
              value={String(values.relatedObjectType ?? "Accounts")}
              onChange={(value) => setValues({ ...values, relatedObjectType: value, relatedRecordId: "" })}
            />
            {relatedLookupField ? (
              <LookupField
                field={relatedLookupField}
                value={String(values.relatedRecordId ?? "")}
                data={data}
                onChange={(next) => setValues({ ...values, relatedRecordId: next })}
              />
            ) : (
              <input
                className={cn(inputClass, "opacity-70")}
                readOnly
                placeholder="No searchable records for this type"
                value=""
                aria-label="Related To search unavailable"
              />
            )}
          </div>
        </FieldShell>
        <FieldShell label="Assigned To" required error={errors.assignedToId}><input className={inputClass} value={data.user.name} readOnly /></FieldShell>
        <FieldShell label="Location"><input className={inputClass} value={String(values.location ?? "")} onChange={(event) => setValues({ ...values, location: event.target.value })} /></FieldShell>
        <FieldShell label="Show Time As"><NativeSelect options={SHOW_TIME_AS} value={String(values.showTimeAs)} onChange={(value) => setValues({ ...values, showTimeAs: value })} /></FieldShell>
        <FieldShell label="All-Day Event"><RadixCheckbox checked={Boolean(values.allDay)} onCheckedChange={(value) => setValues({ ...values, allDay: Boolean(value) })} /></FieldShell>
        <FieldShell label="Private"><RadixCheckbox checked={Boolean(values.private)} onCheckedChange={(value) => setValues({ ...values, private: Boolean(value) })} /><p className="mt-1 text-xs text-[#706e6b]">Private details remain visible to the Salesforce admin and users with View All Data.</p></FieldShell>
      </div>
    </BaseDialog>
  );
}

function relatedPluralToCrmObject(plural: string): CrmObject | null {
  const match = (Object.keys(OBJECT_DEFINITIONS) as CrmObject[]).find((object) => OBJECT_DEFINITIONS[object].plural === plural);
  return match ?? null;
}

function QuickTextModal({ data, onClose, onSave }: { data: BootstrapData; onClose: () => void; onSave: (values: RecordData) => Promise<boolean> }) {
  const [initialValues] = useState<RecordData>(() => ({ category: "Greetings", channels: ["Email"], mergeFields: [], includeInSelectedChannels: true }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);
  const available = ["Event", "Task", "CaseComment", "Knowledge"].filter((item) => !(values.channels as string[]).includes(item));
  async function submit(stayOpen = false) {
    const nextErrors = validateRequired(values, ["name", "message"]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const ok = await onSave(values);
    if (ok && stayOpen) {
      setValues(initialValues);
      setErrors({});
      setMergeError("");
      setPreviewOpen(false);
    }
  }
  function insertMergeField() {
    const mergeObject = String(values.mergeObject ?? "Choose...");
    const mergeField = String(values.mergeField ?? "Choose...");
    if (mergeObject === "Choose..." || mergeField === "Choose...") {
      setMergeError("Choose a related object and field.");
      return;
    }
    const token = mergeField.includes(".") ? `{!${mergeField}}` : `{!${mergeObject}.${mergeField}}`;
    setMergeError("");
    setValues({
      ...values,
      message: `${values.message ?? ""}${token}`,
      mergeFields: [...(Array.isArray(values.mergeFields) ? values.mergeFields.map(String) : []), token]
    });
  }
  function moveChannel(channel: string, selected: boolean) {
    const channels = new Set(values.channels as string[]);
    if (selected) channels.add(channel);
    else channels.delete(channel);
    setValues({ ...values, channels: Array.from(channels) });
  }
  if (discardDialog) return discardDialog;
  return (
    <BaseDialog open title="New Quick Text" onClose={requestClose} wide footer={<><Button onClick={() => setPreviewOpen((open) => !open)}>Preview</Button><Button onClick={requestClose}>Cancel</Button><Button onClick={() => void submit(true)}>Save & New</Button><Button variant="primary" onClick={() => void submit(false)}>Save</Button></>}>
      <div className="mb-4 text-xs text-[#706e6b]"><span className="text-[#ba0517]">*</span>= Required Information</div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldShell label="Quick Text Name" required error={errors.name}><input className={inputClass} value={String(values.name ?? "")} onChange={(event) => setValues({ ...values, name: event.target.value })} /></FieldShell>
        <FieldShell label="Folder">
          <NativeSelect
            options={[
              { value: "", label: "Select Folder" },
              ...data.quickTextFolders.map((folder) => ({ value: String(folder.id), label: String(folder.name) }))
            ]}
            value={String(values.folderId ?? "")}
            onChange={(next) => setValues({ ...values, folderId: next || null })}
            placeholder="Select Folder"
          />
        </FieldShell>
        <FieldShell label="Message" required error={errors.message}><textarea className={cn(inputClass, "h-28")} value={String(values.message ?? "")} onChange={(event) => setValues({ ...values, message: event.target.value })} /></FieldShell>
        <div className="rounded border border-[#d8dde6] p-3">
          <div className="mb-2 font-semibold">Insert Merge Field</div>
          <p className="mb-2 text-xs text-[#706e6b]">A merge field inserts the value of a field for a specific object, for example {"{!Contact.FirstName}"}.</p>
          <div className="grid gap-2">
            <NativeSelect options={["Choose...", "Contact", "Account", "Lead"]} value={String(values.mergeObject ?? "Choose...")} onChange={(value) => setValues({ ...values, mergeObject: value })} />
            <NativeSelect options={["Choose...", "FirstName", "LastName", "Account.Name", "Owner.Name"]} value={String(values.mergeField ?? "Choose...")} onChange={(value) => setValues({ ...values, mergeField: value })} />
            <Button onClick={insertMergeField}>Insert</Button>
            {mergeError && <p className="text-xs text-[#ba0517]">{mergeError}</p>}
          </div>
        </div>
        <FieldShell label="Category"><input className={inputClass} value={String(values.category ?? "Greetings")} onChange={(event) => setValues({ ...values, category: event.target.value })} /></FieldShell>
        <div>
          <div className="mb-1 text-xs font-semibold text-[#444]">Channel</div>
          <p className="mb-2 text-xs text-[#706e6b]">Use Ctrl/Cmd plus arrow keys to move items between lists.</p>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
            <select multiple className={cn(inputClass, "h-28 p-2")}>
              {available.map((item) => <option key={item}>{item}</option>)}
            </select>
            <div className="flex flex-col justify-center gap-1">
              {available.map((item) => <button key={item} className="rounded border border-[#c9c9c9] px-2 py-1 text-xs" onClick={() => moveChannel(item, true)} aria-label="Move selection to Selected">›</button>)}
            </div>
            <select multiple className={cn(inputClass, "h-28 p-2")}>
              {(values.channels as string[]).map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className={checkboxClass} checked={Boolean(values.includeInSelectedChannels)} onChange={(event) => setValues({ ...values, includeInSelectedChannels: event.target.checked })} /> Include in selected channels</label>
        </div>
      </div>
      {previewOpen && <QuickTextPreview name={String(values.name ?? "Untitled Quick Text")} message={String(values.message ?? "")} channels={(values.channels as string[]) ?? []} category={String(values.category ?? "Greetings")} />}
    </BaseDialog>
  );
}

function QuickTextPreview({ name, message, channels, category }: { name: string; message: string; channels: string[]; category: string }) {
  return (
    <div className="mt-4 rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] bg-[#f8f8f8] px-3 py-2 text-sm font-semibold">Preview</div>
      <div className="grid gap-3 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{name}</span>
          <span className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-700">{category}</span>
          {channels.map((channel) => <span key={channel} className="rounded bg-[#f3f3f3] px-2 py-1 text-xs">{channel}</span>)}
        </div>
        <div className="min-h-16 whitespace-pre-wrap rounded border border-[#eef1f6] bg-[#f8fbff] p-3">{message || "No message entered."}</div>
      </div>
    </div>
  );
}

function stripRichTextMarkup(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|blockquote|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function richTextWordCount(value: string) {
  const plainText = stripRichTextMarkup(value);
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(Boolean).length;
}

function formatWordCount(count: number) {
  return `${count} word${count === 1 ? "" : "s"}`;
}

function KnowledgeModal({ onClose, onSave }: { onClose: () => void; onSave: (values: RecordData) => Promise<boolean> }) {
  const [initialValues] = useState<RecordData>(() => ({ visibleInInternalApp: true, visibleToCustomer: false }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [showMoreToolbar, setShowMoreToolbar] = useState(false);
  const [menuNotice, setMenuNotice] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const bodyRichText = String(values.bodyRichText ?? "");
  const wordCount = richTextWordCount(bodyRichText);
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  async function submit(stayOpen = false) {
    const nextErrors = validateRequired(values, ["title", "urlName"]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const ok = await onSave(values);
    if (ok && stayOpen) {
      setValues(initialValues);
      setErrors({});
      setUndoStack([]);
      setRedoStack([]);
      setMenuNotice("");
      setFullscreen(false);
    }
  }
  function setBodyRichText(nextBody: string, selection?: { start: number; end: number }) {
    if (nextBody === bodyRichText) return;
    setUndoStack((current) => [...current.slice(-24), bodyRichText]);
    setRedoStack([]);
    setValues((current) => ({ ...current, bodyRichText: nextBody }));
    if (selection) {
      requestAnimationFrame(() => {
        textAreaRef.current?.focus();
        textAreaRef.current?.setSelectionRange(selection.start, selection.end);
      });
    }
  }

  function replaceSelection(transform: (selected: string) => string, placeholder = "text") {
    const area = textAreaRef.current;
    const start = area?.selectionStart ?? bodyRichText.length;
    const end = area?.selectionEnd ?? bodyRichText.length;
    const selected = bodyRichText.slice(start, end) || placeholder;
    const replacement = transform(selected);
    const nextBody = `${bodyRichText.slice(0, start)}${replacement}${bodyRichText.slice(end)}`;
    setBodyRichText(nextBody, { start, end: start + replacement.length });
  }

  function insertAtSelection(text: string) {
    replaceSelection(() => text, "");
  }

  function wrapSelection(prefix: string, suffix: string, placeholder: string) {
    replaceSelection((selected) => `${prefix}${selected}${suffix}`, placeholder);
  }

  function applyBlockFormat(format: string) {
    const tags: Record<string, [string, string, string]> = {
      Paragraph: ["<p>", "</p>", "Paragraph text"],
      "Heading 1": ["<h1>", "</h1>", "Heading"],
      "Heading 2": ["<h2>", "</h2>", "Heading"],
      Quote: ["<blockquote>", "</blockquote>", "Quote"],
      Code: ["<pre><code>", "</code></pre>", "code"]
    };
    const [prefix, suffix, placeholder] = tags[format] ?? tags.Paragraph;
    wrapSelection(prefix, suffix, placeholder);
  }

  function applyAlignment(alignment: "left" | "center" | "right" | "justify") {
    replaceSelection((selected) => `<p style="text-align: ${alignment};">${selected}</p>`, "Aligned text");
  }

  function clearFormatting() {
    const area = textAreaRef.current;
    const start = area?.selectionStart ?? 0;
    const end = area?.selectionEnd ?? 0;
    if (start !== end) {
      const replacement = stripRichTextMarkup(bodyRichText.slice(start, end));
      setBodyRichText(`${bodyRichText.slice(0, start)}${replacement}${bodyRichText.slice(end)}`, { start, end: start + replacement.length });
      return;
    }
    setBodyRichText(stripRichTextMarkup(bodyRichText));
  }

  function normalizeBody() {
    setBodyRichText(bodyRichText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
    setMenuNotice("Extra spacing normalized.");
  }

  function undoEditor() {
    const previous = undoStack.at(-1);
    if (previous === undefined) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [bodyRichText, ...current].slice(0, 25));
    setValues((current) => ({ ...current, bodyRichText: previous }));
  }

  function redoEditor() {
    const next = redoStack[0];
    if (next === undefined) return;
    setRedoStack((current) => current.slice(1));
    setUndoStack((current) => [...current.slice(-24), bodyRichText]);
    setValues((current) => ({ ...current, bodyRichText: next }));
  }

  function updateBodyFromTyping(nextBody: string) {
    setUndoStack((current) => [...current.slice(-24), bodyRichText]);
    setRedoStack([]);
    setValues((current) => ({ ...current, bodyRichText: nextBody }));
  }

  const menuActions: Record<string, Array<{ label: string; action: () => void; destructive?: boolean }>> = {
    File: [
      { label: "Print Article", action: () => window.print() },
      { label: "Clear Article Body", action: () => setBodyRichText(""), destructive: true }
    ],
    Edit: [
      { label: "Undo", action: undoEditor },
      { label: "Redo", action: redoEditor },
      { label: "Clear Formatting", action: clearFormatting }
    ],
    Insert: [
      { label: "Current Date", action: () => insertAtSelection(new Date().toLocaleDateString("en-US")) },
      { label: "Horizontal Rule", action: () => insertAtSelection("\n<hr />\n") },
      { label: "2 x 2 Table", action: () => insertAtSelection("<table><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></table>") }
    ],
    View: [
      { label: fullscreen ? "Exit Fullscreen" : "Fullscreen", action: () => setFullscreen((current) => !current) },
      { label: showMoreToolbar ? "Hide More Toolbar Items" : "Show More Toolbar Items", action: () => setShowMoreToolbar((current) => !current) }
    ],
    Format: [
      { label: "Paragraph", action: () => applyBlockFormat("Paragraph") },
      { label: "Heading 1", action: () => applyBlockFormat("Heading 1") },
      { label: "Quote", action: () => applyBlockFormat("Quote") }
    ],
    Table: [
      { label: "Insert 2 x 2 Table", action: () => insertAtSelection("<table><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></table>") }
    ],
    Tools: [
      { label: "Normalize Spacing", action: normalizeBody },
      { label: "Strip Formatting", action: clearFormatting }
    ],
    Help: [
      { label: "Insert Authoring Checklist", action: () => insertAtSelection("\n<ul><li>Confirm audience.</li><li>Review visibility settings.</li><li>Save or publish when ready.</li></ul>\n") }
    ]
  };

  if (discardDialog) return discardDialog;

  return (
    <BaseDialog open title="New Knowledge" onClose={requestClose} wide footer={<><Button onClick={requestClose}>Cancel</Button><Button onClick={() => void submit(true)}>Save & New</Button><Button variant="primary" onClick={() => void submit(false)}>Save</Button></>}>
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Title" required error={errors.title}><input className={inputClass} value={String(values.title ?? "")} onChange={(event) => setValues({ ...values, title: event.target.value, urlName: slugify(event.target.value) })} /></FieldShell>
          <FieldShell label="URL Name" required error={errors.urlName}><input className={inputClass} value={String(values.urlName ?? "")} onChange={(event) => setValues({ ...values, urlName: event.target.value })} /></FieldShell>
        </div>
        <div className={cn("rounded border border-[#d8dde6] bg-white", fullscreen && "fixed inset-4 z-[90] flex flex-col shadow-modal")}>
          <div className="flex flex-wrap gap-1 border-b border-[#d8dde6] bg-[#f8f8f8] p-2 text-xs">
            {Object.entries(menuActions).map(([label, actions]) => (
              <DropdownMenu.Root key={label}>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="rounded px-2 py-1 hover:bg-white">{label}</button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="z-[100] min-w-48 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
                    {actions.map((item) => (
                      <DropdownMenu.Item
                        key={item.label}
                        onSelect={item.action}
                        className={cn("cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-brand-50", item.destructive && "text-[#ba0517] hover:bg-[#fff1f1]")}
                      >
                        {item.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b border-[#d8dde6] p-2">
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => setFullscreen((current) => !current)}>{fullscreen ? "Exit Fullscreen" : "Fullscreen"}</button>
            <button type="button" className={knowledgeToolbarButtonClass} disabled={redoStack.length === 0} onClick={redoEditor}>Redo</button>
            <button type="button" className={knowledgeToolbarButtonClass} disabled={undoStack.length === 0} onClick={undoEditor}>Undo</button>
            <NativeSelect className="h-8 w-36 text-xs" options={["Paragraph", "Heading 1", "Heading 2", "Quote", "Code"]} value="Paragraph" onChange={applyBlockFormat} />
            <button type="button" aria-label="Bold" className={cn(knowledgeToolbarButtonClass, "font-bold")} onClick={() => wrapSelection("<strong>", "</strong>", "bold text")}>B</button>
            <button type="button" aria-label="Italic" className={cn(knowledgeToolbarButtonClass, "italic")} onClick={() => wrapSelection("<em>", "</em>", "italic text")}>I</button>
            <button type="button" aria-label="Underline" className={cn(knowledgeToolbarButtonClass, "underline")} onClick={() => wrapSelection("<u>", "</u>", "underlined text")}>U</button>
            <button type="button" aria-label="Strikethrough" className={cn(knowledgeToolbarButtonClass, "line-through")} onClick={() => wrapSelection("<s>", "</s>", "struck text")}>S</button>
            <NativeSelect
              className="h-8 w-36 text-xs"
              options={[
                { value: "text", label: "Text color" },
                { value: "#0176d3", label: "Blue" },
                { value: "#2e844a", label: "Green" },
                { value: "#ba0517", label: "Red" },
                { value: "#181818", label: "Black" }
              ]}
              value="text"
              onChange={(color) => color !== "text" && wrapSelection(`<span style="color: ${color};">`, "</span>", "colored text")}
            />
            <NativeSelect
              className="h-8 w-40 text-xs"
              options={[
                { value: "background", label: "Background" },
                { value: "#fff7e8", label: "Gold" },
                { value: "#e4f6e6", label: "Green" },
                { value: "#eef4ff", label: "Blue" },
                { value: "#fff1f1", label: "Red" }
              ]}
              value="background"
              onChange={(color) => color !== "background" && wrapSelection(`<span style="background-color: ${color};">`, "</span>", "highlighted text")}
            />
            <button type="button" className={knowledgeToolbarButtonClass} onClick={clearFormatting}>Clear</button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("left")}>Left</button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("center")}>Center</button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("right")}>Right</button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("justify")}>Justify</button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => setShowMoreToolbar((current) => !current)}>{showMoreToolbar ? "Less" : "More"}</button>
            {showMoreToolbar && (
              <>
                <button type="button" className={knowledgeToolbarButtonClass} onClick={() => insertAtSelection("\n<hr />\n")}>Rule</button>
                <button type="button" className={knowledgeToolbarButtonClass} onClick={() => insertAtSelection("<table><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></table>")}>Table</button>
                <button type="button" className={knowledgeToolbarButtonClass} onClick={normalizeBody}>Normalize</button>
              </>
            )}
          </div>
          <textarea
            ref={textAreaRef}
            className={cn(inputBareClass, fullscreen ? "min-h-0 flex-1 p-3" : "h-44 p-3")}
            value={bodyRichText}
            onChange={(event) => updateBodyFromTyping(event.target.value)}
            aria-label="Article Body"
          />
          <div className="flex items-center justify-between gap-3 border-t border-[#d8dde6] px-3 py-1 text-xs text-[#706e6b]">
            <span>{formatWordCount(wordCount)}</span>
            {menuNotice && <span>{menuNotice}</span>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Visible In Internal App"><RadixCheckbox checked={Boolean(values.visibleInInternalApp)} onCheckedChange={(value) => setValues({ ...values, visibleInInternalApp: Boolean(value) })} /></FieldShell>
          <FieldShell label="Visible to Customer"><RadixCheckbox checked={Boolean(values.visibleToCustomer)} onCheckedChange={(value) => setValues({ ...values, visibleToCustomer: Boolean(value) })} /></FieldShell>
          {["Article Created Date", "Created By", "Article Archived Date", "Last Modified By", "Article Total View Count", "Archived By"].map((label) => <FieldShell key={label} label={label}><input className={inputClass} readOnly /></FieldShell>)}
        </div>
      </div>
    </BaseDialog>
  );
}

function ListEmailWizard({ data, onClose, onSave }: { data: BootstrapData; onClose: () => void; onSave: (values: RecordData) => Promise<boolean> }) {
  const [step, setStep] = useState(1);
  const [layout, setLayout] = useState("Sales");
  const [layoutQuery, setLayoutQuery] = useState("");
  const [savedQuery, setSavedQuery] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [initialValues] = useState<RecordData>(() => ({ recipientType: "Leads and Contacts", status: "Draft", recipients: [], scheduleTime: "09:00" }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const recipientOptions = [
    ...data.leads.map((lead) => ({ id: String(lead.id), label: `Lead: ${contactName(lead) || lead.company || lead.id}` })),
    ...data.contacts.map((contact) => ({ id: String(contact.id), label: `Contact: ${contactName(contact)}` })),
    ...data.accounts.map((account) => ({ id: String(account.id), label: `Account: ${account.name ?? account.id}` }))
  ];
  const fallbackRecipientOptions = [
    { id: "all-leads", label: "All Leads" },
    { id: "all-contacts", label: "All Contacts" }
  ];
  const availableRecipients = recipientOptions.length ? recipientOptions : fallbackRecipientOptions;
  const selectedRecipients = Array.isArray(values.recipients) ? values.recipients.map(String) : [];
  const visibleLayouts = LIST_EMAIL_LAYOUTS.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(layoutQuery.toLowerCase()));
  const visibleSavedEmails = data.listEmails.filter((email) => `${email.subject ?? ""} ${email.layoutType ?? ""}`.toLowerCase().includes(savedQuery.toLowerCase()));
  const selectedLayout = LIST_EMAIL_LAYOUTS.find((item) => item.name === layout) ?? LIST_EMAIL_LAYOUTS[0];
  const previewSubject = String(values.subject ?? defaultListEmailSubject(layout));
  const previewBody = String(values.body ?? defaultListEmailBody(layout));
  const isDirty = layout !== "Sales" || !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  function toggleRecipient(id: string) {
    const nextRecipients = selectedRecipients.includes(id) ? selectedRecipients.filter((item) => item !== id) : [...selectedRecipients, id];
    setValues({ ...values, recipients: nextRecipients });
  }

  function continueToCompose() {
    setStep(2);
    setPreviewOpen(false);
    setValues((current) => ({
      ...current,
      subject: current.subject ?? defaultListEmailSubject(layout),
      body: current.body ?? defaultListEmailBody(layout),
      recipients: Array.isArray(current.recipients) && current.recipients.length ? current.recipients : availableRecipients.slice(0, 2).map((item) => item.id)
    }));
  }

  function loadSavedEmail(email: RecordData) {
    setLayout(String(email.layoutType ?? layout));
    setValues({
      recipientType: email.recipientType ?? "Leads and Contacts",
      status: "Draft",
      recipients: Array.isArray(email.recipients) ? email.recipients.map(String) : [],
      subject: email.subject ?? "",
      body: email.body ?? ""
    });
    setPreviewOpen(true);
    setStep(2);
  }

  function scheduleDateTime() {
    if (!values.scheduleDate || !values.scheduleTime) return "";
    return new Date(`${values.scheduleDate}T${values.scheduleTime}:00`).toISOString();
  }

  async function submit(status: "Draft" | "Scheduled" | "Sent") {
    const nextErrors = validateRequired(values, ["subject", "body"]);
    if (!selectedRecipients.length) nextErrors.recipients = "Select at least one recipient.";
    if (status === "Scheduled" && !scheduleDateTime()) nextErrors.scheduledAt = "Choose a schedule date and time.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const ok = await onSave({
      ...values,
      layoutType: layout,
      status,
      recipients: selectedRecipients,
      scheduledAt: status === "Scheduled" ? scheduleDateTime() : null
    });
    if (ok) onClose();
  }

  if (discardDialog) return discardDialog;

  return (
    <BaseDialog
      open
      title={step === 1 ? "Select an Email Layout" : `Compose ${layout} Email`}
      onClose={requestClose}
      wide
      footer={
        step === 1 ? (
          <>
            <Button onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
            <Button variant="primary" onClick={continueToCompose}>Select & Continue</Button>
            <Button onClick={requestClose}>Cancel and close</Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
            <Button onClick={() => void submit("Draft")}>Save Draft</Button>
            <Button onClick={() => void submit("Scheduled")}>Schedule</Button>
            <Button variant="primary" onClick={() => void submit("Sent")}>Send</Button>
            <Button onClick={requestClose}>Cancel</Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <Tabs.Root defaultValue="layout">
          <Tabs.List className="mb-3 flex border-b border-[#d8dde6]">
            <Tabs.Trigger value="layout" className="border-b-2 border-transparent px-4 py-2 data-[state=active]:border-brand-500 data-[state=active]:font-semibold">Layout Options</Tabs.Trigger>
            <Tabs.Trigger value="saved" className="border-b-2 border-transparent px-4 py-2 data-[state=active]:border-brand-500 data-[state=active]:font-semibold">Saved Emails</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="layout">
            <input className={cn(inputClass, "mb-3")} placeholder="Search..." value={layoutQuery} onChange={(event) => setLayoutQuery(event.target.value)} />
            <div className="grid gap-2 md:grid-cols-2">
              {visibleLayouts.map((item) => (
                <label key={item.name} className={cn("flex cursor-pointer gap-3 rounded border border-[#d8dde6] p-3", layout === item.name && "border-brand-500 bg-brand-50")}>
                  <input type="radio" checked={layout === item.name} onChange={() => setLayout(item.name)} />
                  <span><span className="block font-semibold">{item.name}</span><span className="text-sm text-[#706e6b]">{item.description}</span></span>
                </label>
              ))}
            </div>
            {!visibleLayouts.length && <EmptyPanel title="No layouts found" body="Try a different search." />}
          </Tabs.Content>
          <Tabs.Content value="saved">
            <input className={cn(inputClass, "mb-3")} placeholder="Search..." value={savedQuery} onChange={(event) => setSavedQuery(event.target.value)} />
            {visibleSavedEmails.length ? (
              <div className="space-y-2">
                {visibleSavedEmails.map((email) => (
                  <button key={String(email.id)} className="w-full rounded border border-[#d8dde6] p-3 text-left hover:border-brand-500 hover:bg-brand-50" onClick={() => loadSavedEmail(email)}>
                    <span className="block font-semibold">{String(email.subject ?? "Untitled email")}</span>
                    <span className="text-sm text-[#706e6b]">{String(email.layoutType ?? "Saved")} - {String(email.status ?? "Draft")}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No saved emails" body="Saved email drafts appear here." />
            )}
          </Tabs.Content>
          {previewOpen && (
            <ListEmailPreview title={`${selectedLayout.name} Layout`} subject={defaultListEmailSubject(layout)} body={defaultListEmailBody(layout)} recipients={[selectedLayout.description]} />
          )}
        </Tabs.Root>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldShell label="Recipient Type">
              <NativeSelect options={["Leads and Contacts", "Leads", "Contacts", "Accounts", "Custom"]} value={String(values.recipientType ?? "Leads and Contacts")} onChange={(value) => setValues({ ...values, recipientType: value })} />
            </FieldShell>
            <FieldShell label="Schedule">
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} type="date" value={String(values.scheduleDate ?? "")} onChange={(event) => setValues({ ...values, scheduleDate: event.target.value })} />
                <NativeSelect options={TIME_SLOTS} value={String(values.scheduleTime ?? "09:00")} onChange={(value) => setValues({ ...values, scheduleTime: value })} />
              </div>
            </FieldShell>
          </div>
          <FieldShell label="Recipients" required error={errors.recipients}>
            <div className="grid max-h-36 gap-2 overflow-auto rounded-lg border border-[#e4e7ec] bg-white shadow-card p-2 md:grid-cols-2">
              {availableRecipients.map((recipient) => (
                <label key={recipient.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-brand-50">
                  <input type="checkbox" checked={selectedRecipients.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)}  className={checkboxClass} />
                  <span>{recipient.label}</span>
                </label>
              ))}
            </div>
          </FieldShell>
          <FieldShell label="Subject" required error={errors.subject}><input className={inputClass} value={String(values.subject ?? "")} onChange={(event) => setValues({ ...values, subject: event.target.value })} /></FieldShell>
          <FieldShell label="Body" required error={errors.body}><textarea className={cn(inputClass, "h-44")} value={String(values.body ?? "")} onChange={(event) => setValues({ ...values, body: event.target.value })} /></FieldShell>
          {errors.scheduledAt && <p className="text-xs text-[#ba0517]">{errors.scheduledAt}</p>}
          {previewOpen && (
            <ListEmailPreview
              title={`${layout} Email Preview`}
              subject={previewSubject}
              body={previewBody}
              recipients={availableRecipients.filter((recipient) => selectedRecipients.includes(recipient.id)).map((recipient) => recipient.label)}
            />
          )}
        </div>
      )}
    </BaseDialog>
  );
}

function ListEmailPreview({ title, subject, body, recipients }: { title: string; subject: string; body: string; recipients: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] bg-[#f8f8f8] px-3 py-2 text-sm font-semibold">{title}</div>
      <div className="grid gap-3 p-3 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase text-[#706e6b]">To</div>
          <div>{recipients.length ? recipients.join(", ") : "No recipients selected"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-[#706e6b]">Subject</div>
          <div className="font-semibold">{subject}</div>
        </div>
        <div className="whitespace-pre-wrap rounded border border-[#eef1f6] bg-[#f8fbff] p-3">{body}</div>
      </div>
    </div>
  );
}

function defaultListEmailSubject(layout: string) {
  switch (layout) {
    case "Announcement":
      return "Important update from our team";
    case "Newsletter":
      return "This month's CRM updates";
    case "Rich Text":
      return "A quick update";
    case "Create with HTML":
      return "Custom campaign update";
    case "Plain Text":
      return "Following up";
    default:
      return "A helpful sales update";
  }
}

function defaultListEmailBody(layout: string) {
  switch (layout) {
    case "Announcement":
      return "Hello,\n\nWe have an important update to share with you. Please review the details and reply with any questions.\n\nThank you.";
    case "Newsletter":
      return "Hello,\n\nHere are the latest highlights, useful resources, and upcoming milestones from our team.\n\nThanks for reading.";
    case "Rich Text":
      return "Hello,\n\nI wanted to share a quick note and keep you updated.\n\nBest regards.";
    case "Create with HTML":
      return "<h1>Hello</h1>\n<p>Add your custom campaign HTML here.</p>";
    case "Plain Text":
      return "Hello,\n\nFollowing up with a quick note.\n\nThanks.";
    default:
      return "Hello,\n\nI thought this update would be useful for your team. Let me know if you would like to discuss next steps.\n\nBest regards.";
  }
}

function NavEditModal({
  app,
  data,
  onClose,
  onSave,
  onReset
}: {
  app: AppKey;
  data: BootstrapData;
  onClose: () => void;
  onSave: (app: AppKey, items: AppNavItem[]) => Promise<boolean>;
  onReset: (app: AppKey) => Promise<boolean>;
}) {
  const appLabel = appRail.find((item) => item.key === app)?.label ?? "Current";
  const [items, setItems] = useState<AppNavItem[]>(() => navItemsForApp(app, data));
  const available = APP_NAV[app].filter((item) => !items.some((current) => current.href === item.href));

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function removeItem(href: string) {
    if (items.length <= 1) return;
    setItems((current) => current.filter((item) => item.href !== href));
  }

  function addItem(item: AppNavItem) {
    setItems((current) => [...current, item]);
  }

  return (
    <BaseDialog
      open
      title={`Edit ${appLabel} App Navigation Items`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={() => available[0] && addItem(available[0])}>Add More Items</Button>
          <Button onClick={() => void onReset(app)}>Reset Defaults</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void onSave(app, items)}>Save</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-[#706e6b]">Reorder visible navigation items with Arrow Up/Down when a row is focused, or use the buttons. Remove items to hide them from the app nav, or add them back from available items.</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-[#706e6b]">Visible Navigation Items</div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.href}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveItem(index, -1);
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveItem(index, 1);
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-[#e4e7ec] bg-white shadow-card p-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <GripVertical size={16} className="shrink-0 text-[#706e6b]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{item.label}</div>
                  <div className="truncate text-xs text-[#706e6b]">{item.href}</div>
                </div>
                <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs disabled:opacity-40" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`Move ${item.label} up`}>Up</button>
                <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs disabled:opacity-40" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Move ${item.label} down`}>Down</button>
                <button className="rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#ba0517] disabled:opacity-40" disabled={items.length <= 1} onClick={() => removeItem(item.href)} aria-label={`Remove ${item.label}`}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-[#706e6b]">Available Items</div>
          <div className="space-y-2 rounded border border-[#d8dde6] bg-[#f8f8f8] p-2">
            {available.map((item) => (
              <button key={item.href} className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#e4e7ec] bg-white shadow-card px-2 py-2 text-left text-sm hover:border-brand-500 hover:bg-brand-50" onClick={() => addItem(item)}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.label}</span>
                  <span className="block truncate text-xs text-[#706e6b]">{item.href}</span>
                </span>
                <Plus size={14} className="shrink-0 text-brand-600" />
              </button>
            ))}
            {available.length === 0 && <div className="rounded border border-dashed border-[#d8dde6] bg-white p-3 text-sm text-[#706e6b]">All available items are already in the navigation.</div>}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}

function FormFields({ fields, values, errors, data, onChange }: { fields: FieldDefinition[]; values: RecordData; errors: Record<string, string>; data: BootstrapData; onChange: (name: string, value: unknown) => void }) {
  const sections = groupBy(fields, (field) => field.section);
  return (
    <div className="space-y-5">
      {Object.entries(sections).map(([section, sectionFields]) => (
        <section key={section}>
          <h3 className="mb-3 border-b border-[#d8dde6] pb-1 font-semibold">{section}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {sectionFields.map((field) => (
              <FieldShell key={field.name} label={field.label} required={field.required} error={errors[field.name]}>
                <FieldInput field={field} values={values} data={data} error={errors[field.name]} onChange={onChange} />
              </FieldShell>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldInput({ field, values, data, error, onChange }: { field: FieldDefinition; values: RecordData; data: BootstrapData; error?: string; onChange: (name: string, value: unknown) => void }) {
  const value = values[field.name] ?? field.defaultValue ?? "";
  const controlClass = cn(inputClass, error && inputErrorClass);
  if (field.type === "textarea") return <textarea className={cn(controlClass, "h-20")} value={String(value ?? "")} onChange={(event) => onChange(field.name, event.target.value)} />;
  if (field.type === "picklist") {
    const options = picklistOptionsForField(field, values);
    const countryUnset = Boolean(field.dependsOn) && (!values[field.dependsOn!] || values[field.dependsOn!] === "--None--");
    return (
      <NativeSelect
        options={options}
        value={String(value ?? "--None--")}
        error={Boolean(error)}
        disabled={countryUnset}
        placeholder={countryUnset ? "Select a country first" : "Select..."}
        onChange={(next) => onChange(field.name, next)}
      />
    );
  }
  if (field.type === "checkbox") return <RadixCheckbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(field.name, Boolean(checked))} />;
  if (field.type === "lookup") return <LookupField field={field} value={String(value ?? "")} data={data} error={Boolean(error)} onChange={(next) => onChange(field.name, next)} />;
  if (field.type === "readonly") return <input className={controlClass} readOnly value={String(value ?? "")} />;
  return <input className={controlClass} type={field.type === "currency" || field.type === "number" ? "number" : field.type} value={String(value ?? "")} onChange={(event) => onChange(field.name, event.target.value)} />;
}

function picklistOptionsForField(field: FieldDefinition, values: RecordData) {
  if (field.dependsOn) {
    return stateOptionsForCountry(String(values[field.dependsOn] ?? ""));
  }
  return field.options ?? ["--None--"];
}

function LookupField({
  field,
  value,
  data,
  error,
  onChange,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy
}: {
  field: FieldDefinition;
  value: string;
  data: BootstrapData;
  error?: boolean;
  onChange: (value: string) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-lookup-results`;
  const options = lookupOptionsForField(field, data);
  const selected = options.find((option) => option.id === value);
  const invalid = Boolean(error || ariaInvalid);
  const placeholder = lookupPlaceholder(field);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, field.lookupObject]);

  function closeLookup() {
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  }

  function choose(optionId: string) {
    onChange(optionId);
    closeLookup();
  }

  return (
    <div className="space-y-1">
      {selected && (
        <div className="inline-flex items-center gap-1 rounded-full border border-[#c9c9c9] bg-[#f8f8f8] px-2 py-1 text-xs">
          {selected.label}
          <button type="button" aria-label="Clear selection" onClick={() => { onChange(""); closeLookup(); }}><X size={12} /></button>
        </div>
      )}
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery("");
            setHighlightedIndex(0);
          }
        }}
      >
        <Popover.Anchor asChild>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#706e6b]" />
            <input
              id={inputId}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={open && filteredOptions[highlightedIndex] ? `${listId}-${highlightedIndex}` : undefined}
              aria-autocomplete="list"
              aria-invalid={invalid || undefined}
              aria-describedby={ariaDescribedBy}
              aria-label={field.label}
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpen(true);
                  setHighlightedIndex((current) => (filteredOptions.length ? Math.min(filteredOptions.length - 1, current + 1) : 0));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlightedIndex((current) => Math.max(0, current - 1));
                }
                if (event.key === "Enter") {
                  const option = filteredOptions[highlightedIndex] ?? filteredOptions[0];
                  if (option) {
                    event.preventDefault();
                    choose(option.id);
                  }
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeLookup();
                }
                if (event.key === "Backspace" && !query && value) onChange("");
              }}
              className={cn(inputClass, "pl-8", invalid && inputErrorClass)}
              placeholder={placeholder}
            />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-[70] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded border border-[#d8dde6] bg-white shadow-popover"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div id={listId} role="listbox" aria-label={`${field.label} lookup results`} className="slds-scrollbar max-h-60 overflow-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#706e6b]">No matches</div>
              ) : (
                filteredOptions.map((option, index) => {
                  const active = index === highlightedIndex;
                  const optionSelected = option.id === value;
                  return (
                    <button
                      key={option.id}
                      id={`${listId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={optionSelected}
                      className={cn("relative flex w-full items-center rounded py-2 pl-8 pr-3 text-left text-sm outline-none hover:bg-brand-50", active && "bg-brand-50", optionSelected && "font-semibold")}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option.id)}
                    >
                      {optionSelected && <Check size={14} className="absolute left-2 text-brand-600" />}
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function lookupOptionsForField(field: FieldDefinition, data: BootstrapData) {
  if (field.lookupObject === "Account") return data.accounts.map((account) => ({ id: requiredId(account), label: String(account.name ?? "Account") }));
  if (field.lookupObject === "Contact") return data.contacts.map((contact) => ({ id: requiredId(contact), label: contactName(contact) }));
  if (field.lookupObject === "Lead") return data.leads.map((lead) => ({ id: requiredId(lead), label: contactName(lead) || String(lead.company ?? "Lead") }));
  if (field.lookupObject === "Opportunity") return data.opportunities.map((opportunity) => ({ id: requiredId(opportunity), label: String(opportunity.name ?? "Opportunity") }));
  if (field.lookupObject === "Case") return data.cases.map((caseRecord) => ({ id: requiredId(caseRecord), label: String(caseRecord.caseNumber ?? caseRecord.subject ?? "Case") }));
  if (field.lookupObject === "Product2") return data.products.map((product) => ({ id: requiredId(product), label: String(product.name ?? "Product") }));
  if (field.lookupObject === "Pricebook2") return data.priceBooks.map((book) => ({ id: requiredId(book), label: String(book.name ?? "Price Book") }));
  if (field.lookupObject === "ListEmail") return data.listEmails.map((email) => ({ id: requiredId(email), label: String(email.subject ?? email.name ?? "List Email") }));
  if (field.lookupObject === "Invoice") return data.invoices.map((invoice) => ({ id: requiredId(invoice), label: String(invoice.name ?? invoice.invoiceNumber ?? "Invoice") }));
  if (field.lookupObject === "Knowledge__kav") return data.knowledgeArticles.map((article) => ({ id: requiredId(article), label: String(article.title ?? "Article") }));
  if (field.lookupObject === "User" || field.lookupObject === "People") return [{ id: data.user.id, label: data.user.name }];
  return [];
}

function lookupPlaceholder(field: FieldDefinition) {
  if (field.lookupObject === "User" || field.lookupObject === "People") return "Search People...";
  return `Search ${OBJECT_DEFINITIONS[field.lookupObject as CrmObject]?.plural ?? "Records"}...`;
}

function BaseDialog({ open, title, children, footer, onClose, wide = false }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="crm-overlay fixed inset-0 z-50 bg-shell/45 backdrop-blur-[3px]" />
        <Dialog.Content className={cn("crm-dialog fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(96vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-modal", wide && "w-[min(96vw,920px)]")}>
          <div className="flex items-center justify-between border-b border-[#e4e7ec] px-5 py-3.5">
            <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">{title}</Dialog.Title>
            <Dialog.Close asChild><button className="rounded-md p-1.5 text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#181818] active:scale-90" aria-label="Cancel and close"><X size={18} /></button></Dialog.Close>
          </div>
          <div className="slds-scrollbar max-h-[calc(86vh-120px)] overflow-auto p-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-[#e4e7ec] bg-[#f8f9fb] px-5 py-3.5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Button({ children, onClick, variant = "secondary", className }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "destructive"; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center justify-center gap-1 rounded border px-3.5 py-1 text-xs font-semibold active:scale-[0.97]",
        variant === "primary" &&
          "border-brand-700/60 bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(3,45,96,0.24)] hover:from-brand-600 hover:to-brand-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(3,45,96,0.3)]",
        variant === "secondary" &&
          "border-[#cfd4dc] bg-white text-brand-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb]",
        variant === "destructive" &&
          "border-[#8e030f] bg-gradient-to-b from-[#d40b1f] to-[#ba0517] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(142,3,15,0.28)] hover:from-[#ba0517] hover:to-[#8e030f]",
        className
      )}
    >
      {children}
    </button>
  );
}

function ToolbarButton({ label, icon: Icon = Settings, onClick, disabled, disabledReason }: { label: string; icon?: ElementType; onClick?: () => void; disabled?: boolean; disabledReason?: string }) {
  const reason = disabled ? disabledReason || `${label} is unavailable for this list.` : undefined;
  return (
    <button
      aria-label={label}
      title={reason || label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded border border-[#cfd4dc] bg-white text-[#444] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb] hover:text-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#cfd4dc] disabled:hover:bg-white disabled:hover:text-[#444]"
    >
      <Icon size={14} />
    </button>
  );
}

function ListViewControlsMenu({ object, listView, isCustom, onAction }: { object: CrmObject; listView: string; isCustom: boolean; onAction: (action: string) => void }) {
  const items = listViewControlItems(object, listView, isCustom);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button aria-label="List View Controls" className="flex h-8 w-8 items-center justify-center rounded border border-[#cfd4dc] bg-white text-[#444] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb] hover:text-brand-700 active:scale-95 data-[state=open]:border-brand-500 data-[state=open]:text-brand-700">
          <Settings size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="z-50 min-w-56 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
          <div className="border-b border-[#d8dde6] px-3 py-2 text-xs text-[#706e6b]">{listView}</div>
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={!item.enabled}
              title={!item.enabled ? item.description : undefined}
              onSelect={() => onAction(item.label)}
              className="cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-brand-50 data-[disabled]:cursor-not-allowed data-[disabled]:text-[#a8a8a8] data-[disabled]:hover:bg-white"
            >
              <div className="font-medium">{item.label}</div>
              {!item.enabled && <div className="mt-0.5 text-xs leading-snug text-[#a8a8a8]">{item.description}</div>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type ListViewControlItem = {
  label: string;
  enabled: boolean;
  description: string;
};

function listViewControlItems(object: CrmObject, listView: string, isCustom: boolean): ListViewControlItem[] {
  const isRecentlyViewed = listView.includes("Recently Viewed");
  return [
    { label: "New", enabled: true, description: "Create a private list view with its own fields and filters." },
    { label: "Clone", enabled: !isRecentlyViewed, description: "Copy this list view into a new editable custom view." },
    { label: "Rename", enabled: isCustom, description: "Update the name of this custom list view." },
    { label: "Sharing Settings", enabled: !isRecentlyViewed, description: "Choose who can see this list view." },
    { label: "Select Fields to Display", enabled: !isRecentlyViewed, description: "Choose columns, display order, and saved widths." },
    { label: "Delete", enabled: isCustom, description: "Remove this custom list view without deleting records." },
    ...(object === "Knowledge__kav"
      ? []
      : [{ label: "Reset Column Sorting", enabled: true, description: "Clear the current column sort for this view." }]),
    { label: "Reset Column Widths", enabled: true, description: "Restore default column widths for this view." }
  ];
}

function ObjectIcon({ definition }: { definition: ObjectDefinition }) {
  const Icon = iconMap[definition.icon] ?? Box;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_3px_rgba(3,45,96,0.24)]">
      <Icon size={20} />
    </div>
  );
}

function AvatarImage({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block shrink-0 bg-cover bg-center", className)}
      style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
    />
  );
}

type NativeSelectOption = string | { value: string; label: string };

function normalizeSelectOptions(options: NativeSelectOption[]) {
  return options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
}

function NativeSelect({
  options,
  value,
  onChange,
  error,
  className,
  id,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  placeholder = "Select..."
}: {
  options: NativeSelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const listId = `${searchId}-list`;
  const normalizedOptions = normalizeSelectOptions(options);
  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? normalizedOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery) || option.value.toLowerCase().includes(normalizedQuery))
    : normalizedOptions;

  const optionsKey = normalizedOptions.map((option) => option.value).join("\u0001");
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, optionsKey]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let detach: (() => void) | undefined;
    let frame = 0;

    const scrollList = (event: Event) => {
      const panel = panelRef.current;
      const list = listRef.current;
      if (!panel || !list || !panel.contains(event.target as Node)) return;

      const maxScroll = list.scrollHeight - list.clientHeight;
      if (maxScroll <= 0) return;

      const deltaY = "deltaY" in event ? (event as WheelEvent).deltaY : 0;
      if (!deltaY && event.type !== "wheel") return;

      event.preventDefault();
      event.stopPropagation();
      if (event.type === "wheel") {
        list.scrollTop = Math.min(maxScroll, Math.max(0, list.scrollTop + deltaY));
      }
    };

    const attach = () => {
      if (cancelled) return;
      if (!panelRef.current || !listRef.current) {
        frame = requestAnimationFrame(attach);
        return;
      }
      // Capture on document so this runs before Dialog's react-remove-scroll lock.
      document.addEventListener("wheel", scrollList, { passive: false, capture: true });
      detach = () => {
        document.removeEventListener("wheel", scrollList, true);
      };
    };

    attach();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      detach?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setHighlightedIndex(0);
    } else {
      const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }

  function choose(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (filteredOptions.length ? Math.min(filteredOptions.length - 1, current + 1) : 0));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(0, current - 1));
    }
    if (event.key === "Enter") {
      const option = filteredOptions[highlightedIndex] ?? filteredOptions[0];
      if (option) {
        event.preventDefault();
        choose(option.value);
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleOpenChange(false);
    }
  }

  return (
    <Popover.Root modal open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && filteredOptions[highlightedIndex] ? `${listId}-${highlightedIndex}` : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          title={disabled ? placeholder : undefined}
          disabled={disabled}
          className={cn(inputClass, "flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60", (error || ariaInvalid) && inputErrorClass, className)}
        >
          <span className={cn("min-w-0 truncate", !selectedOption?.label && "text-[#706e6b]")}>{selectedOption?.label || placeholder}</span>
          <ChevronDown size={14} className="shrink-0 text-[#706e6b]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[70] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded border border-[#d8dde6] bg-white shadow-popover"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div ref={panelRef}>
            <div className="border-b border-[#d8dde6] p-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#706e6b]" />
                <input
                  id={searchId}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cn(inputBareClass, "h-8 w-full pl-8 pr-2 text-sm")}
                  placeholder="Search..."
                  aria-label="Search options"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  onKeyDown={onSearchKeyDown}
                />
              </div>
            </div>
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Options"
              tabIndex={-1}
              className="slds-scrollbar max-h-60 overflow-y-auto overscroll-contain p-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#706e6b]">No matches</div>
              ) : (
                filteredOptions.map((option, index) => {
                  const selected = option.value === value;
                  const active = index === highlightedIndex;
                  return (
                    <div
                      key={option.value}
                      id={`${listId}-${index}`}
                      data-option-index={index}
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      className={cn(
                        "relative flex w-full cursor-pointer items-center rounded py-2 pl-8 pr-3 text-left text-sm outline-none hover:bg-brand-50 focus-visible:bg-brand-50",
                        active && "bg-brand-50",
                        selected && "font-semibold"
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option.value)}
                    >
                      {selected && <Check size={14} className="absolute left-2 text-brand-600" />}
                      <span className="truncate">{option.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RadixCheckbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean | "indeterminate") => void }) {
  return (
    <Checkbox.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#c9c9c9] bg-white outline-none transition-all hover:border-[#a0a0a0] focus-visible:border-brand-500 focus-visible:shadow-[0_0_0_3px_rgba(1,118,211,0.16)] active:scale-90 data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=checked]:hover:border-brand-600"
    >
      <Checkbox.Indicator><Check size={12} className="text-white" strokeWidth={3} /></Checkbox.Indicator>
    </Checkbox.Root>
  );
}

function FieldShell({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const control = enhanceFieldControl(children, { id: fieldId, error, errorId });

  return (
    <label className="block text-sm" htmlFor={fieldId}>
      <span className="mb-1 block text-xs font-semibold text-[var(--control-label,#444)]">
        {required && <span className="mr-0.5 text-[#ba0517]" aria-hidden="true">*</span>}
        {label}
        {required && <span className="sr-only"> (required)</span>}
      </span>
      {control}
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-[#ba0517]">
          {error}
        </span>
      )}
    </label>
  );
}

function enhanceFieldControl(children: ReactNode, options: { id: string; error?: string; errorId: string }): ReactNode {
  if (!isValidElement(children)) return children;

  const element = children as ReactElement<{
    id?: string;
    className?: string;
    error?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
  const isNativeControl = typeof element.type === "string";

  if (!isNativeControl) {
    return cloneElement(element, {
      id: element.props.id ?? options.id,
      error: element.props.error || Boolean(options.error),
      "aria-invalid": options.error ? true : element.props["aria-invalid"],
      "aria-describedby": options.error ? options.errorId : element.props["aria-describedby"]
    });
  }

  return cloneElement(element, {
    id: element.props.id ?? options.id,
    className: cn(element.props.className, options.error && inputErrorClass),
    "aria-invalid": options.error ? true : undefined,
    "aria-describedby": options.error ? options.errorId : undefined
  });
}

function DashboardPanel({ title, action, actionHref, onAction, children }: { title: string; action?: string; actionHref?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action && actionHref && (
          <Link href={actionHref} className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]">
            {action}
          </Link>
        )}
        {action && !actionHref && <Button onClick={onAction}>{action}</Button>}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Cloud size={30} /></div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-[#706e6b]">{body}</p>
      {action && <Button className="mt-4" variant="primary" onClick={onAction}>{action}</Button>}
    </div>
  );
}

function CalendarEventChip({ event }: { event: RecordData }) {
  return (
    <div className="rounded border border-brand-500 bg-brand-50 px-1.5 py-1 text-[11px] leading-tight text-brand-900">
      <div className="truncate font-semibold">{String(event.subject ?? "Event")}</div>
      <div className="truncate text-brand-700">{calendarTimeRange(event)}</div>
    </div>
  );
}

function GuidanceCard({
  title,
  body,
  onSnooze,
  onDismiss,
  onComplete
}: {
  title: string;
  body: string;
  onSnooze: () => void;
  onDismiss: () => void;
  onComplete?: () => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    const activeDragState = dragState;
    if (!activeDragState) return;
    const { startX, startY, originX, originY } = activeDragState;

    function handlePointerMove(event: PointerEvent) {
      setOffset({
        x: originX + event.clientX - startX,
        y: originY + event.clientY - startY
      });
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  return (
    <div className="fixed bottom-5 right-5 z-30 w-80 rounded border border-brand-500 bg-white p-3 shadow-popover" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      <div className="mb-2 flex items-start justify-between">
        <div className="font-semibold">{title}</div>
        <button
          className="cursor-grab rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3] active:cursor-grabbing"
          aria-label="Drag and Drop"
          title="Drag and Drop"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragState({ startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y });
          }}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <p className="text-sm text-[#706e6b]">{body}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {onComplete && <Button variant="primary" onClick={onComplete}>Add sample lead</Button>}
        <Button onClick={onSnooze}>Snooze In-App Guidance</Button>
        <Button onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}

const toastToneStyles = {
  success: { icon: CheckCircle2, bar: "bg-[#2e844a]", iconColor: "text-[#2e844a]", label: "Success" },
  error: { icon: AlertCircle, bar: "bg-[#ba0517]", iconColor: "text-[#ba0517]", label: "Error" },
  warning: { icon: TriangleAlert, bar: "bg-[#a86403]", iconColor: "text-[#a86403]", label: "Warning" }
} as const;

function ToastHost({ toast }: { toast: ToastState }) {
  const [rendered, setRendered] = useState<NonNullable<ToastState> | null>(toast);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (toast) {
      setRendered(toast);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setRendered(null);
      setLeaving(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!rendered) return null;
  const tone = toastToneStyles[rendered.tone];
  const ToneIcon = tone.icon;
  return (
    <div
      role="status"
      className={cn(
        "fixed right-4 top-36 z-[80] flex w-auto max-w-sm items-start gap-3 overflow-hidden rounded-lg border border-[#e4e7ec] bg-white py-3 pl-4 pr-5 text-sm shadow-modal",
        leaving ? "crm-toast-exit" : "crm-toast-enter"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} aria-hidden="true" />
      <ToneIcon size={18} className={cn("mt-0.5 shrink-0", tone.iconColor)} aria-hidden="true" />
      <div className="min-w-0">
        <div className="font-semibold text-[#181818]">{tone.label}</div>
        <div className="mt-0.5 text-[#514f4d]">{rendered.message}</div>
      </div>
    </div>
  );
}

function NotFoundPanel({ title, body }: { title: string; body: string }) {
  return <EmptyPanel title={title} body={body} />;
}

const inputClass =
  "min-h-8 w-full rounded border border-[var(--control-border,#c9c9c9)] bg-[var(--control-bg,#fff)] px-2.5 py-1.5 text-sm text-[#181818] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--control-placeholder,#706e6b)] hover:border-[var(--control-border-hover,#a0a0a0)] focus:border-[var(--control-border-focus,#0176d3)] focus:shadow-[0_0_0_3px_rgba(1,118,211,0.16)] disabled:cursor-not-allowed disabled:border-[#c9c9c9] disabled:bg-[var(--control-bg-muted,#f3f3f3)] disabled:text-[#706e6b] disabled:hover:border-[#c9c9c9] disabled:focus:shadow-none read-only:border-[#c9c9c9] read-only:bg-[var(--control-bg-muted,#f3f3f3)] read-only:text-[#444] read-only:hover:border-[#c9c9c9] read-only:focus:border-[#c9c9c9] read-only:focus:shadow-none";

const inputErrorClass =
  "border-[var(--control-border-error,#ba0517)] hover:border-[var(--control-border-error,#ba0517)] focus:border-[var(--control-border-error,#ba0517)] focus:shadow-[0_0_0_3px_rgba(186,5,23,0.14)]";

const inputBareClass =
  "h-full min-h-0 w-full flex-1 border-0 bg-transparent px-2 text-sm text-[#181818] outline-none placeholder:text-[var(--control-placeholder,#706e6b)]";

const knowledgeToolbarButtonClass =
  "inline-flex h-8 items-center justify-center rounded border border-[#c9c9c9] bg-white px-2 text-xs font-semibold text-[#444] hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-45";

const checkboxClass = "h-4 w-4 shrink-0 rounded border border-[#c9c9c9] accent-brand-600";


function parseScreen(pathname: string, searchParams: SearchParamsLike): ScreenState {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[1] === "page" && segments[2] === "analytics") return { kind: "analytics", activeApp: inferActiveApp(pathname, searchParams) };
  if (segments[1] === "app") {
    const app = (segments[2] as AppKey) ?? "home";
    if (app === "contacts") return { kind: "list", activeApp: "contacts", object: "Contact" };
    if (app === "accounts") return { kind: "list", activeApp: "accounts", object: "Account" };
    if (app === "sales") return { kind: "list", activeApp: "sales", object: "Lead" };
    if (app === "service") return { kind: "list", activeApp: "service", object: "Case" };
    if (app === "marketing") return { kind: "marketing", activeApp: "marketing" };
    if (app === "commerce") return { kind: "commerce", activeApp: "commerce" };
    if (app === "your-account") return { kind: "account", activeApp: "your-account" };
  }
  if (segments[1] === "o" && isCrmObject(segments[2])) {
    if (segments[2] === "Event") return { kind: "calendar", activeApp: "sales" };
    if (segments[2] === "QuickText") return { kind: "quickText", activeApp: "service" };
    return { kind: "list", activeApp: inferActiveApp(pathname, searchParams), object: segments[2] };
  }
  if (segments[1] === "r" && (segments[2] === "Account" || segments[2] === "Contact")) {
    return { kind: "record", activeApp: segments[2] === "Account" ? "accounts" : "contacts", object: segments[2], id: segments[3] };
  }
  return { kind: "home", activeApp: "home" };
}

function inferActiveApp(pathname: string, searchParams: SearchParamsLike): AppKey {
  if (pathname.includes("/Lead") || pathname.includes("/Opportunity") || pathname.includes("/Product2") || pathname.includes("/Pricebook2") || pathname.includes("/Event") || pathname.includes("/Invoice") || pathname.includes("/VideoCall")) return "sales";
  if (pathname.includes("/Case") || pathname.includes("/QuickText") || pathname.includes("/MessagingSession") || pathname.includes("/Knowledge__kav")) return "service";
  if (pathname.includes("/ListEmail")) return "marketing";
  if (pathname.includes("/Account")) return "accounts";
  if (pathname.includes("/Contact")) return "contacts";
  if (searchParams.get("app") === "service") return "service";
  return "home";
}

function screenToTab(screen: ScreenState, pathname: string, searchParams: SearchParamsLike): ConsoleTab {
  const href = pathnameWithSearch(pathname, searchParams);
  if (screen.kind === "record") return { href, label: `${screen.id.includes("robert") ? "Robert" : screen.id} | ${screen.object}` };
  if (screen.kind === "list") return { href, label: `${OBJECT_DEFINITIONS[screen.object].defaultList} | ${OBJECT_DEFINITIONS[screen.object].plural}` };
  if (screen.kind === "calendar") return { href, label: "Calendar" };
  if (screen.kind === "quickText") return { href, label: "Quick Text" };
  if (screen.kind === "marketing") return { href, label: "Marketing" };
  if (screen.kind === "commerce") return { href, label: "Commerce" };
  if (screen.kind === "account") return { href, label: "Your Account" };
  if (screen.kind === "analytics") return { href, label: "Analytics" };
  return { href, label: "Home" };
}

function navItemsForApp(app: AppKey, data: BootstrapData): AppNavItem[] {
  const preference = data.appNavPreferences.find((item) => item.app === app);
  const items = Array.isArray(preference?.items) ? preference.items.map(toNavItem).filter((item): item is AppNavItem => Boolean(item)) : [];
  return items.length > 0 ? items : APP_NAV[app];
}

function toNavItem(value: unknown): AppNavItem | null {
  if (!isRecordData(value) || !value.label || !value.href) return null;
  const object = typeof value.object === "string" && isCrmObject(value.object) ? value.object : undefined;
  return {
    label: String(value.label),
    href: String(value.href),
    ...(object ? { object } : {})
  };
}

function cleanNavItem(item: AppNavItem): RecordData {
  return {
    label: item.label,
    href: item.href,
    ...(item.object ? { object: item.object } : {})
  };
}

function buildNotificationPreferences(preferences: RecordData[] = []) {
  return notificationCategories.reduce<Record<string, boolean>>((accumulator, category) => {
    const preference = preferences.find((item) => String(item.category) === category);
    accumulator[category] = preference?.enabled !== false;
    return accumulator;
  }, {});
}

function fallbackGuidanceItems(): RecordData[] {
  return [
    { id: "lead", title: "Add a lead", body: "First enter and save a few details about the lead. You can add a sample lead, snooze this guidance, drag it, or dismiss it.", href: "/lightning/o/Lead/list?filterName=AllOpenLeads", target: "Lead" },
    { id: "marketing", title: "Turn on marketing features", body: "Activate marketing, then send your first list email.", href: "/lightning/app/marketing", target: "Marketing" },
    { id: "deal", title: "Create your first deal", body: "Create an opportunity and update the stage as work progresses.", href: "/lightning/o/Opportunity/list", target: "Opportunity" }
  ];
}

function buildGuidanceItems(data: BootstrapData): RecordData[] {
  const stateByItem = new Map(data.guidanceStates.map((state) => [String(state.itemId), state]));
  const items = data.guidanceItems.length > 0 ? data.guidanceItems : fallbackGuidanceItems();
  return items.map((item) => {
    const state = stateByItem.get(String(item.id));
    return {
      ...item,
      state: String(state?.status ?? "ACTIVE"),
      snoozedUntil: state?.snoozedUntil ? String(state.snoozedUntil) : null
    };
  });
}

function guidanceItemForObject(object: CrmObject, data: BootstrapData) {
  const fallbackIdByObject: Partial<Record<CrmObject, string>> = {
    Lead: "lead",
    Opportunity: "deal"
  };
  const items = buildGuidanceItems(data);
  return items.find((item) => String(item.target ?? "") === object) ?? items.find((item) => String(item.id) === fallbackIdByObject[object]);
}

function guidanceSnoozedUntil(item: RecordData) {
  const timestamp = item.snoozedUntil ? new Date(String(item.snoozedUntil)).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isContextualGuidanceVisible(item: RecordData) {
  const state = String(item.state ?? "ACTIVE");
  if (state === "DISMISSED" || state === "DONE") return false;
  if (state === "SNOOZED") return guidanceSnoozedUntil(item) <= Date.now();
  return true;
}

function guidanceStateLabel(item: RecordData) {
  const state = String(item.state ?? "ACTIVE");
  if (state === "SNOOZED" && guidanceSnoozedUntil(item) <= Date.now()) return "Active";
  return state.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

function guidanceStateBadgeClass(state: string) {
  switch (state) {
    case "DONE":
      return "bg-[#e4f6e6] text-[#194f25]";
    case "SNOOZED":
      return "bg-[#fff7d6] text-[#5f4b00]";
    case "DISMISSED":
      return "bg-[#f3f3f3] text-[#706e6b]";
    default:
      return "bg-brand-50 text-brand-700";
  }
}

function columnsForListView(definition: ObjectDefinition, preference?: RecordData) {
  const keys = Array.isArray(preference?.columns) ? preference.columns.map(String) : definition.columns.map((column) => column.key);
  const columns = keys
    .map((key) => definition.columns.find((column) => column.key === key))
    .filter((column): column is ObjectDefinition["columns"][number] => Boolean(column));
  const widths = columnWidthsForListView(preference);
  return (columns.length > 0 ? columns : definition.columns).map((column) => ({
    ...column,
    width: widths[column.key] ?? column.width
  }));
}

function columnWidthsForListView(preference?: RecordData): Record<string, string> {
  const source = preference?.columnWidths;
  if (typeof source !== "object" || source === null || Array.isArray(source)) return {};
  return Object.entries(source).reduce<Record<string, string>>((accumulator, [key, value]) => {
    const width = normalizeColumnWidth(value);
    if (width) accumulator[key] = width;
    return accumulator;
  }, {});
}

function kanbanConfigForObject(object: CrmObject): KanbanConfig | null {
  switch (object) {
    case "Lead":
      return { field: "status", label: "Lead Status", values: picklistKanbanValues(LEAD_STATUS) };
    case "Opportunity":
      return { field: "stage", label: "Stage", values: picklistKanbanValues(OPPORTUNITY_STAGE), summaryField: "amount" };
    case "Case":
      return { field: "status", label: "Status", values: picklistKanbanValues(CASE_STATUS) };
    default:
      return null;
  }
}

function picklistKanbanValues(values: string[]) {
  return values.filter((value) => value && value !== "--None--");
}

function filtersForListView(definition: ObjectDefinition, preference?: RecordData) {
  const allowedFields = new Set(definition.columns.map((column) => column.key));
  if (!Array.isArray(preference?.filters)) return [];
  return preference.filters
    .map((filter) => (isRecordData(filter) ? filter : null))
    .filter((filter): filter is RecordData => {
      if (!filter) return false;
      return allowedFields.has(String(filter.field));
    });
}

function recordMatchesListFilter(record: RecordData, filter: RecordData) {
  const raw = record[String(filter.field)];
  const value = formatCell(raw).toLowerCase();
  const target = String(filter.value ?? "").toLowerCase();
  switch (filter.operator) {
    case "equals":
      return value === target;
    case "not-equals":
      return value !== target;
    case "starts-with":
      return value.startsWith(target);
    case "is-empty":
      return value.length === 0;
    default:
      return value.includes(target);
  }
}

function chartDataForRecords(records: RecordData[], field: string) {
  const counts = records.reduce<Record<string, number>>((accumulator, record) => {
    const label = formatCell(record[field]) || "Blank";
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function numberFromRecord(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareRecordValues(left: unknown, right: unknown) {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const leftNumber = numericSortValue(left);
  const rightNumber = numericSortValue(right);
  if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;

  const leftDate = dateSortValue(left);
  const rightDate = dateSortValue(right);
  if (leftDate !== null && rightDate !== null) return leftDate - rightDate;

  return formatCell(left).localeCompare(formatCell(right), undefined, { numeric: true, sensitivity: "base" });
}

function numericSortValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[$,%\s,]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateSortValue(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeColumnWidth(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim().replace(/px$/i, "")) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return `${Math.max(110, Math.min(520, Math.round(parsed)))}px`;
}

function parseColumnWidth(value: unknown) {
  const normalized = normalizeColumnWidth(value);
  return normalized ? Number(normalized.replace("px", "")) : 150;
}

function formatKanbanSummary(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function isCrmObject(value?: string): value is CrmObject {
  return objectList.includes(value as CrmObject);
}

function pathnameWithSearch(pathname: string, searchParams: SearchParamsLike) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function pathMatches(pathname: string, href: string) {
  return pathname === href.split("?")[0] || (href.includes("/o/") && pathname.includes(href.split("?")[0].replace("/list", "").replace("/home", "")));
}

function consoleTabListHref(href: string) {
  const [path] = href.split("?");
  const segments = path.split("/").filter(Boolean);
  if (segments[1] === "r" && isCrmObject(segments[2])) return defaultRouteForObject(segments[2]);
  if (segments[1] === "o" && isCrmObject(segments[2])) return defaultRouteForObject(segments[2]);
  return href;
}

function defaultRouteForObject(object: CrmObject) {
  if (object === "Event") return "/lightning/o/Event/home";
  if (object === "QuickText") return "/lightning/o/QuickText/home";
  return `/lightning/o/${object}/list`;
}

function canRouteToRecord(object: CrmObject) {
  return object === "Account" || object === "Contact";
}

function canEditFromRow(object: CrmObject) {
  return Boolean(FORM_DEFINITIONS[object]);
}

function canDeleteFromRow(object: CrmObject) {
  return ["Account", "Contact", "Lead", "Opportunity", "Product2", "Pricebook2", "Case", "QuickText", "Knowledge__kav", "ListEmail"].includes(object);
}

function canChangeOwnerFromRow(object: CrmObject) {
  return ["Account", "Contact", "Lead", "Opportunity", "Case"].includes(object);
}

function relatedRecordTitle(object: RelatedListObject, record: RecordData) {
  if (object === "Partner") return String(record.name ?? "Partner");
  return recordTitle(object, record);
}

function potentialDuplicates(object: "Account" | "Contact", record: RecordData, data: BootstrapData) {
  if (object === "Account") {
    const name = normalizedText(record.name);
    const phone = normalizedText(record.phone);
    const websiteDomain = domainFromWebsite(record.website);
    return data.accounts
      .filter((account) => account.id !== record.id)
      .filter((account) => normalizedText(account.name) === name || (phone && normalizedText(account.phone) === phone) || (websiteDomain && domainFromWebsite(account.website) === websiteDomain))
      .slice(0, 5);
  }
  const email = normalizedText(record.email);
  const name = normalizedText(contactName(record));
  return data.contacts
    .filter((contact) => contact.id !== record.id)
    .filter((contact) => (email && normalizedText(contact.email) === email) || (name && normalizedText(contactName(contact)) === name && String(contact.accountId ?? "") === String(record.accountId ?? "")))
    .slice(0, 5);
}

function duplicateReason(object: "Account" | "Contact", source: RecordData, duplicate: RecordData) {
  if (object === "Account") {
    if (normalizedText(source.name) === normalizedText(duplicate.name)) return "Same account name";
    if (normalizedText(source.phone) && normalizedText(source.phone) === normalizedText(duplicate.phone)) return "Same phone number";
    if (domainFromWebsite(source.website) && domainFromWebsite(source.website) === domainFromWebsite(duplicate.website)) return "Same website domain";
  }
  if (normalizedText(source.email) && normalizedText(source.email) === normalizedText(duplicate.email)) return "Same email address";
  return "Similar name and account";
}

function accountHierarchyRows(record: RecordData, data: BootstrapData) {
  const byId = new Map(data.accounts.map((account) => [String(account.id), account]));
  const ancestors: RecordData[] = [];
  let parentId = String(record.parentAccountId ?? "");
  while (parentId && byId.has(parentId) && ancestors.length < 8) {
    const parent = byId.get(parentId)!;
    ancestors.unshift(parent);
    parentId = String(parent.parentAccountId ?? "");
  }
  const children = data.accounts.filter((account) => account.parentAccountId === record.id);
  return [...ancestors, record, ...children].map((account, index) => {
    const depth = account.id === record.id ? ancestors.length : index < ancestors.length ? index : ancestors.length + 1;
    return {
      id: requiredId(account),
      label: String(account.name ?? "Account"),
      meta: account.id === record.id ? "Current account" : index < ancestors.length ? "Parent account" : "Child account",
      depth,
      current: account.id === record.id,
      href: account.id === record.id ? "" : routeForRecord("Account", requiredId(account))
    };
  });
}

function contactHierarchyRows(record: RecordData, data: BootstrapData) {
  const byId = new Map(data.contacts.map((contact) => [String(contact.id), contact]));
  const managers: RecordData[] = [];
  let managerId = String(record.reportsToContactId ?? "");
  while (managerId && byId.has(managerId) && managers.length < 8) {
    const manager = byId.get(managerId)!;
    managers.unshift(manager);
    managerId = String(manager.reportsToContactId ?? "");
  }
  const reports = data.contacts.filter((contact) => contact.reportsToContactId === record.id);
  return [...managers, record, ...reports].map((contact, index) => {
    const depth = contact.id === record.id ? managers.length : index < managers.length ? index : managers.length + 1;
    return {
      id: requiredId(contact),
      label: contactName(contact),
      meta: contact.id === record.id ? "Current contact" : index < managers.length ? "Reports up" : "Direct report",
      depth,
      current: contact.id === record.id,
      href: contact.id === record.id ? "" : routeForRecord("Contact", requiredId(contact))
    };
  });
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function domainFromWebsite(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function quickTextViewCount(view: string, data: BootstrapData, favorites: string[]) {
  if (view === "Recent") return Math.min(10, data.quickTexts.length);
  if (view === "All Quick Text") return data.quickTexts.length;
  if (view === "All Favorites") return favorites.length;
  if (view === "All Folders") return data.quickTextFolders.length;
  if (view === "Created by Me") return data.quickTextFolders.filter((folder) => folder.ownerId === data.user.id).length;
  if (view === "Shared with Me") return data.quickTextFolders.filter((folder) => String(folder.sharing ?? "").toLowerCase().match(/shared|public/)).length;
  return 0;
}

function quickTextMatches(record: RecordData, query: string, foldersById: Map<string, RecordData>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const folder = foldersById.get(String(record.folderId ?? ""));
  return [
    record.name,
    record.message,
    record.category,
    Array.isArray(record.channels) ? record.channels.join(" ") : "",
    folder?.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function quickTextTimestamp(record: RecordData) {
  const parsed = Date.parse(String(record.updatedAt ?? record.createdAt ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function calendarSourceType(source: RecordData) {
  return String(source.type ?? "My") === "Other" ? "Other" : "My";
}

function isFallbackCalendarSource(source: RecordData) {
  return requiredId(source).startsWith("calendar-default-");
}

function isLocalCalendarSource(source: RecordData) {
  return requiredId(source).startsWith("calendar-local-");
}

function calendarSourceListFromResponse(response: RecordData | null) {
  const sources = response?.calendarSources;
  if (!Array.isArray(sources)) return null;
  return sources.filter(isRecordData);
}

function upsertCalendarSource(sources: RecordData[], source: RecordData) {
  const sourceId = requiredId(source);
  const withoutSource = sources.filter((item) => requiredId(item) !== sourceId && !isFallbackCalendarSource(item));
  return [source, ...withoutSource];
}

function requiredId(record: RecordData) {
  return String(record.id ?? "");
}

async function postUtility(action: string, id?: string, values?: RecordData) {
  const response = await fetch("/api/utilities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, id, values })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return json as RecordData;
}

function isRecordData(value: unknown): value is RecordData {
  return typeof value === "object" && value !== null;
}

function labelsFromData(labels: RecordData[] = []) {
  return labels.reduce<Record<string, string[]>>((accumulator, label) => {
    const recordId = String(label.recordId ?? "");
    if (!recordId) return accumulator;
    accumulator[recordId] = Array.from(new Set([...(accumulator[recordId] ?? []), String(label.label ?? "")].filter(Boolean)));
    return accumulator;
  }, {});
}

function campaignMembersFromData(members: RecordData[] = [], campaigns: RecordData[] = []) {
  const campaignById = new Map(campaigns.map((campaign) => [String(campaign.id), String(campaign.name ?? "Campaign")]));
  return members.reduce<Record<string, string[]>>((accumulator, member) => {
    const recordId = String(member.recordId ?? "");
    if (!recordId) return accumulator;
    const campaignName = campaignById.get(String(member.campaignId)) ?? String(member.campaignName ?? "Campaign");
    accumulator[recordId] = Array.from(new Set([...(accumulator[recordId] ?? []), campaignName]));
    return accumulator;
  }, {});
}

function leadConversionResultFromWorkflow(result: RecordData, leads: RecordData[], data: BootstrapData, payload: RecordData) {
  const accounts = recordArray(result.accounts);
  const contacts = recordArray(result.contacts);
  const opportunities = recordArray(result.opportunities);
  const convertedLeads = recordArray(result.leads);
  if (contacts.length > 0 || convertedLeads.length > 0) return { accounts, contacts, opportunities, leads: convertedLeads };
  return fallbackLeadConversionRecords(leads, data, payload);
}

function fallbackLeadConversionRecords(leads: RecordData[], data: BootstrapData, payload: RecordData) {
  const now = new Date().toISOString();
  const status = String(payload.convertedStatus ?? "Qualified");
  const closeDate = String(payload.closeDate ?? defaultLeadConversionCloseDate());
  const stage = String(payload.stage ?? "Qualify");
  const forecastCategory = String(payload.forecastCategory ?? "Pipeline");
  const createOpportunity = payload.createOpportunity !== false;
  const singleAccountName = leads.length === 1 ? String(payload.accountName ?? "").trim() : "";
  const accounts: RecordData[] = [];
  const contacts: RecordData[] = [];
  const opportunities: RecordData[] = [];
  const convertedLeads: RecordData[] = [];

  leads.forEach((lead, index) => {
    const leadId = requiredId(lead) || `lead-${Date.now()}-${index}`;
    const accountName = singleAccountName || String(lead.company ?? contactName(lead) ?? "Converted Lead Account").trim() || "Converted Lead Account";
    const existingAccount = data.accounts.find((account) => normalizedText(account.name) === normalizedText(accountName));
    const account =
      existingAccount ??
      ({
        id: `converted-account-${leadId}`,
        name: accountName,
        website: lead.website ?? null,
        type: "Prospect",
        ownerId: lead.ownerId ?? data.user.id,
        phone: lead.phone ?? null,
        billingCountry: lead.country ?? null,
        billingStreet: lead.street ?? null,
        billingPostalCode: lead.postalCode ?? null,
        billingCity: lead.city ?? null,
        billingState: lead.state ?? null,
        createdById: data.user.id,
        updatedById: data.user.id,
        createdAt: now,
        updatedAt: now
      } satisfies RecordData);

    const contact = {
      id: `converted-contact-${leadId}`,
      salutation: lead.salutation ?? null,
      firstName: lead.firstName ?? null,
      lastName: String(lead.lastName ?? "Converted"),
      accountId: requiredId(account),
      title: lead.title ?? null,
      description: lead.description ?? null,
      ownerId: lead.ownerId ?? data.user.id,
      phone: lead.phone ?? null,
      email: lead.email ?? null,
      mailingCountry: lead.country ?? null,
      mailingStreet: lead.street ?? null,
      mailingPostalCode: lead.postalCode ?? null,
      mailingCity: lead.city ?? null,
      mailingState: lead.state ?? null,
      createdById: data.user.id,
      updatedById: data.user.id,
      createdAt: now,
      updatedAt: now
    } satisfies RecordData;

    const opportunity = createOpportunity
      ? ({
          id: `converted-opportunity-${leadId}`,
          name: leads.length === 1 ? String(payload.opportunityName ?? `${accountName} Opportunity`) : `${accountName} Opportunity`,
          accountId: requiredId(account),
          contactId: requiredId(contact),
          closeDate,
          amount: null,
          description: lead.description ?? null,
          ownerId: lead.ownerId ?? data.user.id,
          stage,
          probability: stage === "Qualify" ? 10 : null,
          forecastCategory,
          nextStep: "Follow up after lead conversion",
          createdById: data.user.id,
          updatedById: data.user.id,
          createdAt: now,
          updatedAt: now
        } satisfies RecordData)
      : null;

    accounts.push(account);
    contacts.push(contact);
    if (opportunity) opportunities.push(opportunity);
    convertedLeads.push({
      ...lead,
      status,
      convertedAccountId: requiredId(account),
      convertedContactId: requiredId(contact),
      convertedOpportunityId: opportunity ? requiredId(opportunity) : null,
      updatedById: data.user.id,
      updatedAt: now
    });
  });

  return { accounts, contacts, opportunities, leads: convertedLeads };
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecordData) : [];
}

function upsertRecordsById(existing: RecordData[], incoming: RecordData[]) {
  if (incoming.length === 0) return existing;
  const incomingById = new Map<string, RecordData>();
  incoming.forEach((record) => {
    const id = requiredId(record);
    if (id) incomingById.set(id, record);
  });
  const existingIds = new Set(existing.map(requiredId));
  const updated = existing.map((record) => {
    const next = incomingById.get(requiredId(record));
    return next ? { ...record, ...next } : record;
  });
  const created = incoming.filter((record) => {
    const id = requiredId(record);
    return id && !existingIds.has(id);
  });
  return [...created, ...updated];
}

function defaultLeadConversionCloseDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function enrichLocalRecord(object: CrmObject, record: RecordData): RecordData {
  const now = new Date().toISOString();
  const base: RecordData = { createdAt: now, updatedAt: now, createdById: CURRENT_USER.id, updatedById: CURRENT_USER.id, ownerId: CURRENT_USER.id, ...record };
  if (object === "Case" && !base.caseNumber) return { ...base, caseNumber: `0000${Math.floor(Math.random() * 9000) + 1000}`, openedAt: now };
  if (object === "Knowledge__kav" && !base.articleNumber) return { ...base, articleNumber: `KA-${Math.floor(Math.random() * 900000) + 100000}`, publicationStatus: "Draft", validationStatus: "Not Validated" };
  return base;
}

function importSampleForObject(object: CrmObject) {
  switch (object) {
    case "Account":
      return "Acme Corp, +1 555 0100, Customer";
    case "Contact":
      return "Jane, Buyer, Robert, jane@example.com";
    case "Lead":
      return "Sam, Prospect, Prospect Co, sam@example.com";
    case "Opportunity":
      return "Starter Renewal, Robert, 2026-08-31, Qualify";
    case "Case":
      return "Login issue, New, Medium, Email";
    case "Product2":
      return "Starter Product, None, SKU-100";
    case "Pricebook2":
      return "Partner Price Book, true";
    default:
      return "Name, Description";
  }
}

function importPayloadForObject(object: CrmObject, row: string, data: BootstrapData): RecordData | null {
  const [a = "", b = "", c = "", d = ""] = row.split(",").map((part) => part.trim());
  const accountId = requiredId(data.accounts.find((account) => String(account.name).toLowerCase() === c.toLowerCase()) ?? data.accounts[0] ?? {});
  const opportunityAccountId = requiredId(data.accounts.find((account) => String(account.name).toLowerCase() === b.toLowerCase()) ?? data.accounts[0] ?? {});
  const defaultAccountId = requiredId(data.accounts[0] ?? {});

  switch (object) {
    case "Account":
      return { name: a || "Imported Account", phone: b, type: c || "Customer", ownerId: data.user.id };
    case "Contact":
      return { firstName: a, lastName: b || "Imported", accountId: accountId || defaultAccountId, email: d, ownerId: data.user.id };
    case "Lead":
      return { firstName: a, lastName: b || "Imported", company: c || "Imported Company", email: d, status: "New", ownerId: data.user.id };
    case "Opportunity":
      return { name: a || "Imported Opportunity", accountId: opportunityAccountId || defaultAccountId, closeDate: c || "2026-08-31", stage: d || "Qualify", forecastCategory: "Pipeline", ownerId: data.user.id };
    case "Case":
      return { subject: a, status: b || "New", priority: c || "Medium", origin: d || "Email", ownerId: data.user.id };
    case "Product2":
      return { name: a || "Imported Product", family: b || "None", sku: c, active: false };
    case "Pricebook2":
      return { name: a || "Imported Price Book", active: b.toLowerCase() === "true" };
    default:
      return null;
  }
}

function buildInitialValues(definition: FormDefinition, record?: RecordData): RecordData {
  const values: RecordData = { ...(record ?? {}) };
  splitDateTimeField(values, "validFrom", "validFromTime");
  splitDateTimeField(values, "validTo", "validToTime");
  definition.fields.forEach((field) => {
    if (values[field.name] === undefined && field.defaultValue !== undefined) values[field.name] = field.defaultValue;
  });
  return values;
}

function splitDateTimeField(values: RecordData, dateField: string, timeField: string) {
  const raw = values[dateField];
  if (typeof raw !== "string" || !raw.includes("T")) return;
  const [datePart, timePart = "00:00"] = raw.split("T");
  values[dateField] = datePart;
  if (values[timeField] === undefined) values[timeField] = timePart.slice(0, 5);
}

function recordDataShallowEqual(left: RecordData, right: RecordData) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (normalizeDirtyValue(left[key]) !== normalizeDirtyValue(right[key])) return false;
  }
  return true;
}

function normalizeDirtyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function validateFields(fields: FieldDefinition[], values: RecordData) {
  return Object.fromEntries(fields.filter((field) => field.required && (!values[field.name] || values[field.name] === "--None--")).map((field) => [field.name, "Complete this field."]));
}

function validateRequired(values: RecordData, required: string[]) {
  return Object.fromEntries(required.filter((field) => !values[field] || values[field] === "--None--").map((field) => [field, "Complete this field."]));
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = accumulator[key] ?? [];
    accumulator[key].push(item);
    return accumulator;
  }, {});
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
}

function fieldLabel(field: string) {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function startOfSaturdayWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const offset = (copy.getDay() + 1) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addCalendarDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addCalendarMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function getMonthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const gridStart = addCalendarDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(gridStart, index));
}

function sameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthYearLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function monthDayYearLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function fullDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

function shortDayLabel(date: Date) {
  return `${new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase()} ${date.getDate()}`;
}

function hourFromDate(value: unknown) {
  const date = new Date(String(value));
  return String(date.getUTCHours()).padStart(2, "0");
}

function nextTimeSlot(time: string) {
  const [hourText = "09", minuteText = "00"] = time.split(":");
  const date = new Date(Date.UTC(2026, 0, 1, Number(hourText), Number(minuteText)));
  date.setUTCHours(date.getUTCHours() + 1);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function calendarTimeRange(event: RecordData) {
  if (event.allDay) return "All day";
  const start = new Date(String(event.startAt));
  const end = new Date(String(event.endAt));
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${fmt.format(start)}-${fmt.format(end)}`;
}

function addressValue(record: RecordData, prefix: string) {
  return [
    record[`${prefix}Street`],
    record[`${prefix}City`],
    record[`${prefix}State`],
    record[`${prefix}PostalCode`],
    record[`${prefix}Country`]
  ]
    .filter(Boolean)
    .join(", ");
}

function activityTab(active: boolean) {
  return cn("rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]", active && "border-brand-500 bg-brand-50 text-brand-700");
}

function waitForUploadProgress(delay = 160) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}

function activityDateValue(activity: TimelineActivity) {
  const parsed = Date.parse(String(activity.date ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function activityWithinRange(activity: TimelineActivity, range: string) {
  if (range === "All time") return true;
  const days = range === "Within 7 days" ? 7 : 62;
  const age = Math.abs(Date.now() - activityDateValue(activity));
  return age <= days * 24 * 60 * 60 * 1000;
}

function groupTimelineActivities(activities: TimelineActivity[]) {
  const groups: Array<{ label: string; activities: TimelineActivity[] }> = [];
  activities.forEach((activity) => {
    const label = timelineGroupLabel(activity);
    const existingGroup = groups.find((group) => group.label === label);
    if (existingGroup) existingGroup.activities.push(activity);
    else groups.push({ label, activities: [activity] });
  });
  return groups;
}

function timelineGroupLabel(activity: TimelineActivity) {
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

function activityMatchesStatus(activity: TimelineActivity, status: string) {
  if (status === "All activities") return true;
  const time = activityDateValue(activity);
  const now = Date.now();
  const taskCompleted = String(activity.status ?? "") === "Completed";
  if (status === "Completed") return activity.kind === "Email" || activity.kind === "Call" || taskCompleted || (activity.kind === "Event" && time < now);
  if (status === "Upcoming") return (activity.kind === "Task" && !taskCompleted && time >= now) || (activity.kind === "Event" && time >= now);
  if (status === "Overdue") return (activity.kind === "Task" && !taskCompleted && time < now) || (activity.kind === "Event" && time < now);
  return true;
}

function activityStatusLabel(activity: TimelineActivity) {
  if (activity.kind === "Email") return String(activity.emailAction ?? "Sent") === "log" ? "Logged" : "Sent";
  if (activity.kind === "Call") return "Completed";
  if (activity.kind === "Task") return String(activity.status ?? "Not Started");
  return activityDateValue(activity) >= Date.now() ? "Upcoming" : "Completed";
}

function activityDetail(activity: TimelineActivity) {
  if (activity.kind === "Email") return `To: ${String(activity.to ?? "recipient")} - ${String(activity.body ?? "No email body")}`;
  if (activity.kind === "Call") return String(activity.comments ?? "No call comments");
  if (activity.kind === "Task") return `Due: ${formatDate(String(activity.dueDate ?? activity.date))} - Priority: ${String(activity.priority ?? "Normal")}`;
  return `Scheduled for ${formatDateTime(String(activity.date))}`;
}

function activityHasInsight(activity: TimelineActivity) {
  return Boolean(activity.body || activity.comments || String(activity.priority ?? "") === "High" || activityMatchesStatus(activity, "Overdue"));
}

function activityInsight(activity: TimelineActivity) {
  if (activityMatchesStatus(activity, "Overdue")) return "This activity needs attention.";
  if (String(activity.priority ?? "") === "High") return "High-priority follow-up.";
  if (activity.kind === "Email") return "Recent email content is available in the timeline.";
  if (activity.kind === "Call") return "Call notes are available for follow-up.";
  return "Activity details are available.";
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
