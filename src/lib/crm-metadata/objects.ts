import { BRAND } from "@/lib/brand";
import type { CrmObject, ObjectDefinition } from "@/lib/crm-types";

export const OBJECT_DEFINITIONS: Record<CrmObject, ObjectDefinition> = {
  Contact: {
    object: "Contact",
    label: "Contact",
    plural: "Contacts",
    icon: "user",
    dataKey: "contacts",
    defaultList: "All Contacts",
    listViews: [
      "All Contacts",
      "Birthdays This Month",
      "My Contacts",
      "New This Week",
      "Recently Viewed (Pinned list)",
      "Recently Viewed Contacts"
    ],
    actions: ["Import", "Add to Campaign", "Send Email", "New", "Assign Label"],
    columns: [
      { key: "displayName", label: "Name", link: true, width: "220px" },
      { key: "accountName", label: "Account Name", editable: true, link: true, width: "180px" },
      { key: "phone", label: "Phone", editable: true, width: "150px" },
      { key: "email", label: "Email", editable: true, width: "210px" },
      { key: "ownerAlias", label: "Contact Owner Alias", width: "150px" }
    ],
    searchInputName: "Contact-search-input",
    supportsNew: true
  },
  Account: {
    object: "Account",
    label: "Account",
    plural: "Accounts",
    icon: "building",
    dataKey: "accounts",
    defaultList: "All Accounts",
    listViews: [
      "All Accounts",
      "My Accounts",
      "New This Week",
      "Recently Viewed (Pinned list)",
      "Recently Viewed Accounts"
    ],
    actions: ["Import", "Assign Label", "New"],
    columns: [
      { key: "name", label: "Account Name", editable: true, link: true, width: "240px" },
      { key: "phone", label: "Phone", editable: true, width: "160px" },
      { key: "ownerAlias", label: "Account Owner Alias", width: "170px" }
    ],
    searchInputName: "Account-search-input",
    supportsNew: true
  },
  Lead: {
    object: "Lead",
    label: "Lead",
    plural: "Leads",
    icon: "target",
    dataKey: "leads",
    defaultList: "All Open Leads",
    listViews: ["All Open Leads", "My Leads", "Recently Viewed (Pinned list)", "Today's Leads"],
    actions: ["New", "Import", "Convert Lead", "Add to Campaign", "Send Email", "Change Owner", "Show more actions"],
    columns: [
      { key: "displayName", label: "Name", link: true },
      { key: "company", label: "Company" },
      { key: "state", label: "State/Province (text only)" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "status", label: "Lead Status" },
      { key: "createdAt", label: "Created Date" },
      { key: "ownerAlias", label: "Owner Alias" }
    ],
    searchInputName: "Lead-search-input",
    statusWhenEmpty: "0 items - Sorted by Name - Filtered by Lead Status - Updated a few seconds ago",
    emptyTitle: "Focus on the right leads",
    emptyBody: `${BRAND.name} helps focus sales efforts by keeping prospecting information organized.`,
    supportsNew: true
  },
  Opportunity: {
    object: "Opportunity",
    label: "Opportunity",
    plural: "Opportunities",
    icon: "badge-dollar-sign",
    dataKey: "opportunities",
    defaultList: "All Opportunities",
    listViews: ["All Opportunities", "Closing Next Month", "My Opportunities", "Recently Viewed (Pinned list)"],
    actions: ["Import", "Assign Label", "New"],
    columns: [
      { key: "name", label: "Opportunity Name", link: true },
      { key: "accountName", label: "Account Name" },
      { key: "closeDate", label: "Close Date" },
      { key: "stage", label: "Stage" },
      { key: "amount", label: "Amount" },
      { key: "trackingStatus", label: "Tracking Status" },
      { key: "deliveryDate", label: "Delivery Date" },
      { key: "ownerAlias", label: "Owner Alias" }
    ],
    searchInputName: "Opportunity-search-input",
    supportsNew: true
  },
  Product2: {
    object: "Product2",
    label: "Product",
    plural: "Products",
    icon: "box",
    dataKey: "products",
    defaultList: "All Products",
    listViews: ["All Products", "Active Products", "Recently Viewed (Pinned list)"],
    actions: ["New", "Add to Category"],
    columns: [
      { key: "name", label: "Product Name", link: true },
      { key: "productCode", label: "Product Code" },
      { key: "family", label: "Product Family" },
      { key: "category", label: "Category" },
      { key: "priceBookName", label: "Price Book" },
      { key: "listPrice", label: "List Price" },
      { key: "currency", label: "Currency" },
      { key: "stockCount", label: "Stock" },
      { key: "syncSource", label: "Source" },
      { key: "active", label: "Active" }
    ],
    searchInputName: "Product-search-input",
    supportsNew: true
  },
  Pricebook2: {
    object: "Pricebook2",
    label: "Price Book",
    plural: "Price Books",
    icon: "book-open",
    dataKey: "priceBooks",
    defaultList: "All Price Books",
    listViews: ["All Price Books", "Active Price Books", "Recently Viewed (Pinned list)"],
    actions: ["New"],
    columns: [
      { key: "name", label: "Price Book Name", link: true },
      { key: "active", label: "Active" },
      { key: "isStandard", label: "Is Standard Price Book" },
      { key: "validFrom", label: "Valid From" },
      { key: "validTo", label: "Valid To" }
    ],
    searchInputName: "Price Book-search-input",
    supportsNew: true
  },
  Event: {
    object: "Event",
    label: "Event",
    plural: "Events",
    icon: "calendar",
    dataKey: "events",
    defaultList: "Calendar",
    listViews: ["Calendar"],
    actions: ["New Event"],
    columns: [],
    searchInputName: "Event-search-input",
    supportsNew: true
  },
  Case: {
    object: "Case",
    label: "Case",
    plural: "Cases",
    icon: "circle-help",
    dataKey: "cases",
    defaultList: "All Open Cases",
    listViews: ["All Open Cases", "My Cases", "Recently Viewed (Pinned list)"],
    actions: ["New", "Change Owner", "Merge Cases", "Printable View", "Assign Label"],
    columns: [
      { key: "caseNumber", label: "Case Number", link: true },
      { key: "contactName", label: "Contact Name" },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "openedAt", label: "Date/Time Opened" },
      { key: "ownerAlias", label: "Case Owner Alias" }
    ],
    searchInputName: "Case-search-input",
    statusWhenEmpty:
      "0 items - Sorted by Case Number - Filtered by Date/Time Opened/Closed - Updated a few seconds ago",
    emptyTitle: "Track customer support in one place",
    emptyBody: "Create cases to manage customer questions, issues, and requests from one workspace.",
    supportsNew: true
  },
  QuickText: {
    object: "QuickText",
    label: "Quick Text",
    plural: "Quick Text",
    icon: "message-square-text",
    dataKey: "quickTexts",
    defaultList: "Recent",
    listViews: ["Recent", "All Quick Text", "All Folders", "Created by Me", "Shared with Me", "All Favorites"],
    actions: ["New Quick Text", "New Folder"],
    columns: [
      { key: "name", label: "Quick Text Name", link: true },
      { key: "category", label: "Category" },
      { key: "channels", label: "Channel" }
    ],
    searchInputName: "QuickText-search-input",
    supportsNew: true
  },
  MessagingSession: {
    object: "MessagingSession",
    label: "Messaging Session",
    plural: "Messaging Sessions",
    icon: "messages-square",
    dataKey: "messagingSessions",
    defaultList: "All Messaging Sessions",
    listViews: ["All Messaging Sessions", "Open", "Waiting", "Closed", "Recently Viewed (Pinned list)"],
    actions: ["New"],
    columns: [
      { key: "name", label: "Messaging Session Name", link: true },
      { key: "channel", label: "Channel" },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "lastMessageAt", label: "Last Message" },
      { key: "ownerAlias", label: "Owner Alias" }
    ],
    searchInputName: "Messaging Session-search-input",
    emptyTitle: "Start your first messaging session",
    emptyBody: "Choose New to track participants and inbound, outbound, or externally exchanged messages.",
    supportsNew: true
  },
  Knowledge__kav: {
    object: "Knowledge__kav",
    label: "Knowledge",
    plural: "Knowledge",
    icon: "library",
    dataKey: "knowledgeArticles",
    defaultList: "All Articles",
    listViews: [
      "All Articles",
      "Archived Articles",
      "Draft Articles",
      "Published Articles",
      "Recently Viewed (Pinned list)"
    ],
    actions: ["New", "Publish", "Assign", "Archive", "Delete Article", "Show more actions"],
    columns: [
      { key: "title", label: "Article Title", link: true },
      { key: "summary", label: "Summary" },
      { key: "articleNumber", label: "Article Number" },
      { key: "publishedAt", label: "Published Date" },
      { key: "publicationStatus", label: "Publication Status" },
      { key: "validationStatus", label: "Validation Status" }
    ],
    searchInputName: "Knowledge-search-input",
    emptyTitle: "You haven't viewed any Knowledge recently.",
    emptyBody: "Try switching list views.",
    supportsNew: true
  },
  ListEmail: {
    object: "ListEmail",
    label: "List Email",
    plural: "List Emails",
    icon: "mail",
    dataKey: "listEmails",
    defaultList: "All List Emails",
    listViews: ["All List Emails", "My List Emails", "Recently Viewed (Pinned list)"],
    actions: ["Send Email"],
    columns: [
      { key: "subject", label: "Subject", link: true },
      { key: "layoutType", label: "Layout" },
      { key: "recipientType", label: "Recipients" },
      { key: "status", label: "Status" },
      { key: "sentAt", label: "Sent Date" },
      { key: "scheduledAt", label: "Scheduled Date" },
      { key: "createdAt", label: "Created Date" }
    ],
    searchInputName: "List Email-search-input"
  },
  Campaign: {
    object: "Campaign",
    label: "Campaign",
    plural: "Campaigns",
    icon: "megaphone",
    dataKey: "campaigns",
    defaultList: "All Campaigns",
    listViews: ["All Campaigns", "Planned", "In Progress", "Completed", "Archived", "Recently Viewed"],
    actions: ["New"],
    columns: [
      { key: "name", label: "Campaign Name", link: true },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "startDate", label: "Start Date" },
      { key: "endDate", label: "End Date" },
      { key: "memberCount", label: "Members" },
      { key: "responseRate", label: "Response Rate" },
      { key: "ownerAlias", label: "Owner Alias" }
    ],
    searchInputName: "Campaign-search-input",
    emptyTitle: "Create your first marketing campaign",
    emptyBody: "Choose New to plan a campaign, add Leads or Contacts, and measure response.",
    supportsNew: true
  },
  Invoice: {
    object: "Invoice",
    label: "Invoice",
    plural: "Invoices",
    icon: "receipt",
    dataKey: "invoices",
    defaultList: "All Invoices",
    listViews: ["All Invoices", "Draft", "Outstanding", "Overdue", "Paid", "Recently Viewed"],
    actions: ["New"],
    columns: [
      { key: "invoiceNumber", label: "Invoice Number", link: true },
      { key: "accountName", label: "Account" },
      { key: "opportunityName", label: "Opportunity" },
      { key: "status", label: "Status" },
      { key: "issueDate", label: "Issue Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "total", label: "Total" },
      { key: "amountPaid", label: "Amount Paid" },
      { key: "balanceDue", label: "Balance Due" }
    ],
    searchInputName: "Invoice-search-input",
    emptyTitle: "Create your first sales invoice",
    emptyBody:
      "Choose New Invoice to create a draft for an Account, add line items, and track externally received payments.",
    supportsNew: true
  },
  VideoCall: {
    object: "VideoCall",
    label: "Video Call",
    plural: "Video Calls",
    icon: "video",
    dataKey: "videoCalls",
    defaultList: "All Video Calls",
    listViews: [
      "All Video Calls",
      "Upcoming",
      "In Progress",
      "Completed",
      "Cancelled",
      "Recently Viewed (Pinned list)"
    ],
    actions: ["New"],
    columns: [
      { key: "name", label: "Video Call Name", link: true },
      { key: "status", label: "Status" },
      { key: "provider", label: "Provider" },
      { key: "scheduledStartAt", label: "Scheduled Start" },
      { key: "scheduledEndAt", label: "Scheduled End" },
      { key: "organizerName", label: "Organizer" }
    ],
    searchInputName: "Video Call-search-input",
    emptyTitle: "Schedule your first video call",
    emptyBody: "Choose New to track a real provider link, participants, attendance, and call lifecycle.",
    supportsNew: true
  }
};
