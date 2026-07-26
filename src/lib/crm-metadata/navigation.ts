import type { AppKey, AppNavItem } from "@/lib/crm-types";

export const TIME_SLOTS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4)
    .toString()
    .padStart(2, "0");
  const minutes = ((index % 4) * 15).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
});

export const LIST_EMAIL_LAYOUTS = [
  { name: "Sales", description: "Targeted outreach to sales leads." },
  { name: "Announcement", description: "Important updates or big events." },
  { name: "Newsletter", description: "Regular updates or brand promotion." },
  { name: "Rich Text", description: "Simple text-only layout for quick clear messages." },
  { name: "Create with HTML", description: "Custom HTML email." },
  { name: "Plain Text", description: "Compose plain text email from scratch." }
];

export const APP_NAV: Record<AppKey, AppNavItem[]> = {
  home: [{ label: "Home", href: "/lightning/page/home" }],
  contacts: [{ label: "Contacts", href: "/lightning/o/Contact/list", object: "Contact" }],
  accounts: [{ label: "Accounts", href: "/lightning/o/Account/list", object: "Account" }],
  sales: [
    { label: "Leads", href: "/lightning/o/Lead/list?filterName=AllOpenLeads", object: "Lead" },
    { label: "Contacts", href: "/lightning/o/Contact/list", object: "Contact" },
    { label: "Accounts", href: "/lightning/o/Account/list", object: "Account" },
    { label: "Opportunities", href: "/lightning/o/Opportunity/list", object: "Opportunity" },
    { label: "Products", href: "/lightning/o/Product2/list", object: "Product2" },
    { label: "Price Books", href: "/lightning/o/Pricebook2/list", object: "Pricebook2" },
    { label: "Calendar", href: "/lightning/o/Event/home", object: "Event" },
    { label: "Analytics", href: "/lightning/page/analytics" },
    { label: "Invoices", href: "/lightning/o/Invoice/list", object: "Invoice" },
    { label: "Video Calls", href: "/lightning/o/VideoCall/list", object: "VideoCall" }
  ],
  service: [
    { label: "Cases", href: "/lightning/o/Case/list?filterName=AllOpenCases", object: "Case" },
    { label: "Contacts", href: "/lightning/o/Contact/list", object: "Contact" },
    { label: "Accounts", href: "/lightning/o/Account/list", object: "Account" },
    { label: "Quick Text", href: "/lightning/o/QuickText/home", object: "QuickText" },
    { label: "Messaging Sessions", href: "/lightning/o/MessagingSession/list", object: "MessagingSession" },
    { label: "Analytics", href: "/lightning/page/analytics" },
    { label: "Knowledge", href: "/lightning/o/Knowledge__kav/list", object: "Knowledge__kav" }
  ],
  marketing: [
    { label: "Marketing overview", href: "/lightning/app/marketing" },
    { label: "Campaigns", href: "/lightning/o/Campaign/list", object: "Campaign" },
    { label: "List Emails", href: "/lightning/o/ListEmail/list", object: "ListEmail" }
  ],
  commerce: [{ label: "Stores", href: "/lightning/app/commerce" }],
  "your-account": [{ label: "Your Account", href: "/lightning/app/your-account" }]
};
