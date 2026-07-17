import type { AppKey, AppNavItem, CrmObject, FormDefinition, ObjectDefinition } from "@/lib/crm-types";

export const ACCOUNT_TYPES = ["--None--", "Analyst", "Competitor", "Customer", "Integrator", "Investor", "Partner", "Press", "Prospect", "Reseller", "Other"];
export const SALUTATIONS = ["--None--", "Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Mx."];
export const LEAD_STATUS = ["--None--", "New", "Contacted", "Nurturing", "Qualified", "Unqualified"];
export const LEAD_RATING = ["--None--", "Hot", "Warm", "Cold"];
export const LEAD_SOURCE = ["--None--", "Advertisement", "Employee Referral", "External Referral", "Partner", "Public Relations", "Seminar - Internal", "Seminar - Partner", "Trade Show", "Web", "Word of mouth", "Other"];
export const INDUSTRIES = ["--None--", "Agriculture", "Apparel", "Banking", "Biotechnology", "Chemicals", "Communications", "Construction", "Consulting", "Education", "Electronics", "Energy", "Engineering", "Entertainment", "Environmental", "Finance", "Food & Beverage", "Government", "Healthcare", "Hospitality", "Insurance", "Machinery", "Manufacturing", "Media", "Not For Profit", "Other", "Recreation", "Retail", "Shipping", "Technology", "Telecommunications", "Transportation", "Utilities"];
export const OPPORTUNITY_STAGE = ["--None--", "Qualify", "Meet & Present", "Propose", "Negotiate", "Closed Won", "Closed Lost"];
export const FORECAST_CATEGORY = ["--None--", "Pipeline", "Best Case", "Commit", "Closed", "Omitted"];
export const CASE_STATUS = ["--None--", "New", "Working", "Waiting on Customer", "Escalated", "Closed"];
export const CASE_ORIGIN = ["--None--", "Email", "Phone", "Web"];
export const CASE_PRIORITY = ["--None--", "High", "Medium", "Low"];
export const PRODUCT_FAMILY = ["--None--", "None"];
export const EVENT_SUBJECTS = ["Call", "Email", "Meeting", "Send Letter/Quote", "Other"];
export const SHOW_TIME_AS = ["Busy", "Free", "Tentative", "Out of Office"];
export const NAME_OBJECT_TYPES = ["Contacts", "Leads"];
export const RELATED_OBJECT_TYPES = [
  "Accounts",
  "Activity History",
  "Asset Relationships",
  "Assets",
  "Buyer Accounts",
  "Buyer Group Price Books",
  "Campaigns",
  "Cases",
  "Catalogs",
  "Communication Subscription Consents",
  "Contact Requests",
  "Coupons",
  "Credit Memos",
  "Environments",
  "Fulfillment Orders",
  "Goal Assignments",
  "Goal Definitions",
  "Images",
  "Invoice Documents",
  "Invoices",
  "Legal Entities",
  "List Emails",
  "Locations",
  "Opportunities",
  "Order Summaries",
  "Orders",
  "Party Consents",
  "Price Adjustment Schedules",
  "Price Adjustment Tiers",
  "Products",
  "Promotions",
  "Query Editor",
  "Request Infos",
  "Shipment Items",
  "Shipments",
  "Shipping Carrier Methods",
  "Shipping Carriers",
  "Store Price Books",
  "Web Store Message Contents"
];

export const COUNTRIES = [
  "--None--",
  "Afghanistan",
  "Aland Islands",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Anguilla",
  "Antarctica",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Aruba",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bermuda",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "British Indian Ocean Territory",
  "British Virgin Islands",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Cayman Islands",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Christmas Island",
  "Cocos (Keeling) Islands",
  "Colombia",
  "Comoros",
  "Congo",
  "Cook Islands",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cuba",
  "Curacao",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Falkland Islands",
  "Faroe Islands",
  "Fiji",
  "Finland",
  "France",
  "French Guiana",
  "French Polynesia",
  "French Southern Territories",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Gibraltar",
  "Greece",
  "Greenland",
  "Grenada",
  "Guadeloupe",
  "Guatemala",
  "Guernsey",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Heard Island and McDonald Islands",
  "Holy See",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Ireland",
  "Isle of Man",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jersey",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macau",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Martinique",
  "Mauritania",
  "Mauritius",
  "Mayotte",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Montserrat",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Caledonia",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "Niue",
  "Norfolk Island",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Pitcairn",
  "Poland",
  "Portugal",
  "Qatar",
  "Reunion",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Barthelemy",
  "Saint Helena",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Martin",
  "Saint Pierre and Miquelon",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Sint Maarten",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Georgia and the South Sandwich Islands",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Svalbard and Jan Mayen",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tokelau",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Turks and Caicos Islands",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Venezuela",
  "Vietnam",
  "Wallis and Futuna",
  "Western Sahara",
  "Yemen",
  "Zambia",
  "Zimbabwe"
];

export const US_STATES = ["--None--", "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"];

export const CA_PROVINCES = ["--None--", "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"];

export const AU_STATES = ["--None--", "Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland", "South Australia", "Tasmania", "Victoria", "Western Australia"];

export const GB_COUNTIES = ["--None--", "England", "Northern Ireland", "Scotland", "Wales"];

export const AE_EMIRATES = ["--None--", "Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"];

export const IN_STATES = ["--None--", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];

export const AR_PROVINCES = ["--None--", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autonoma de Buenos Aires", "Cordoba", "Corrientes", "Entre Rios", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquen", "Rio Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucuman"];

export const BR_STATES = ["--None--", "Acre", "Alagoas", "Amapa", "Amazonas", "Bahia", "Ceara", "Distrito Federal", "Espirito Santo", "Goias", "Maranhao", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Para", "Paraiba", "Parana", "Pernambuco", "Piaui", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondonia", "Roraima", "Santa Catarina", "Sao Paulo", "Sergipe", "Tocantins"];

export const CN_PROVINCES = ["--None--", "Anhui", "Beijing", "Chongqing", "Fujian", "Gansu", "Guangdong", "Guangxi", "Guizhou", "Hainan", "Hebei", "Heilongjiang", "Henan", "Hong Kong", "Hubei", "Hunan", "Inner Mongolia", "Jiangsu", "Jiangxi", "Jilin", "Liaoning", "Macau", "Ningxia", "Qinghai", "Shaanxi", "Shandong", "Shanghai", "Shanxi", "Sichuan", "Taiwan", "Tianjin", "Tibet", "Xinjiang", "Yunnan", "Zhejiang"];

export const DE_STATES = ["--None--", "Baden-Wurttemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"];

export const FR_REGIONS = ["--None--", "Auvergne-Rhone-Alpes", "Bourgogne-Franche-Comte", "Brittany", "Centre-Val de Loire", "Corsica", "Grand Est", "Hauts-de-France", "Ile-de-France", "Normandy", "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Cote d'Azur"];

export const JP_PREFECTURES = ["--None--", "Aichi", "Akita", "Aomori", "Chiba", "Ehime", "Fukui", "Fukuoka", "Fukushima", "Gifu", "Gunma", "Hiroshima", "Hokkaido", "Hyogo", "Ibaraki", "Ishikawa", "Iwate", "Kagawa", "Kagoshima", "Kanagawa", "Kochi", "Kumamoto", "Kyoto", "Mie", "Miyagi", "Miyazaki", "Nagano", "Nagasaki", "Nara", "Niigata", "Oita", "Okayama", "Okinawa", "Osaka", "Saga", "Saitama", "Shiga", "Shimane", "Shizuoka", "Tochigi", "Tokushima", "Tokyo", "Tottori", "Toyama", "Wakayama", "Yamagata", "Yamaguchi", "Yamanashi"];

export const MX_STATES = ["--None--", "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Mexico City", "Mexico State", "Michoacan", "Morelos", "Nayarit", "Nuevo Leon", "Oaxaca", "Puebla", "Queretaro", "Quintana Roo", "San Luis Potosi", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatan", "Zacatecas"];

export const NG_STATES = ["--None--", "Abia", "Abuja Federal Capital Territory", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];

export const NZ_REGIONS = ["--None--", "Auckland", "Bay of Plenty", "Canterbury", "Gisborne", "Hawke's Bay", "Manawatu-Wanganui", "Marlborough", "Nelson", "Northland", "Otago", "Southland", "Taranaki", "Tasman", "Waikato", "Wellington", "West Coast"];

export const PK_PROVINCES = ["--None--", "Azad Kashmir", "Balochistan", "Gilgit-Baltistan", "Islamabad Capital Territory", "Khyber Pakhtunkhwa", "Punjab", "Sindh"];

export const PH_REGIONS = ["--None--", "Bangsamoro Autonomous Region in Muslim Mindanao", "Bicol Region", "Cagayan Valley", "Calabarzon", "Caraga", "Central Luzon", "Central Visayas", "Cordillera Administrative Region", "Davao Region", "Eastern Visayas", "Ilocos Region", "Metro Manila", "Mimaropa", "Northern Mindanao", "Soccsksargen", "Western Visayas", "Zamboanga Peninsula"];

export const ZA_PROVINCES = ["--None--", "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

/** Dependent state/province options keyed by country. Missing countries yield only `--None--`. */
export const STATES_BY_COUNTRY: Record<string, string[]> = {
  Argentina: AR_PROVINCES,
  "United States": US_STATES,
  Brazil: BR_STATES,
  Canada: CA_PROVINCES,
  China: CN_PROVINCES,
  France: FR_REGIONS,
  Germany: DE_STATES,
  Australia: AU_STATES,
  "United Kingdom": GB_COUNTIES,
  "United Arab Emirates": AE_EMIRATES,
  India: IN_STATES,
  Japan: JP_PREFECTURES,
  Mexico: MX_STATES,
  "New Zealand": NZ_REGIONS,
  Nigeria: NG_STATES,
  Pakistan: PK_PROVINCES,
  Philippines: PH_REGIONS,
  "South Africa": ZA_PROVINCES
};

export function stateOptionsForCountry(country?: string | null) {
  if (!country || country === "--None--") return ["--None--"];
  return STATES_BY_COUNTRY[country] ?? ["--None--"];
}

export const TIME_SLOTS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4).toString().padStart(2, "0");
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
    { label: "List Emails", href: "/lightning/o/ListEmail/list", object: "ListEmail" }
  ],
  commerce: [{ label: "Stores", href: "/lightning/app/commerce" }],
  "your-account": [{ label: "Your Account", href: "/lightning/app/your-account" }]
};

export const OBJECT_DEFINITIONS: Record<CrmObject, ObjectDefinition> = {
  Contact: {
    object: "Contact",
    label: "Contact",
    plural: "Contacts",
    icon: "user",
    dataKey: "contacts",
    defaultList: "Recently Viewed",
    listViews: ["All Contacts", "Birthdays This Month", "My Contacts", "New This Week", "Recently Viewed (Pinned list)", "Recently Viewed Contacts"],
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
    defaultList: "Recently Viewed",
    listViews: ["All Accounts", "My Accounts", "New This Week", "Recently Viewed (Pinned list)", "Recently Viewed Accounts"],
    actions: ["New", "Import", "Assign Label"],
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
    actions: ["New", "Import", "Add to Campaign", "Send Email", "Change Owner", "Show more actions"],
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
    emptyBody: "Salesforce helps focus sales efforts by keeping prospecting information organized.",
    supportsNew: true
  },
  Opportunity: {
    object: "Opportunity",
    label: "Opportunity",
    plural: "Opportunities",
    icon: "badge-dollar-sign",
    dataKey: "opportunities",
    defaultList: "Recently Viewed",
    listViews: ["All Opportunities", "Closing Next Month", "My Opportunities", "Recently Viewed (Pinned list)"],
    actions: ["New", "Import", "Assign Label"],
    columns: [
      { key: "name", label: "Opportunity Name", link: true },
      { key: "accountName", label: "Account Name" },
      { key: "closeDate", label: "Close Date" },
      { key: "stage", label: "Stage" },
      { key: "amount", label: "Amount" },
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
    defaultList: "Recently Viewed",
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
    defaultList: "Recently Viewed",
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
    statusWhenEmpty: "0 items - Sorted by Case Number - Filtered by Date/Time Opened/Closed - Updated a few seconds ago",
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
    defaultList: "Recently Viewed",
    listViews: ["All Messaging Sessions", "Recently Viewed (Pinned list)"],
    actions: ["List View Controls", "Refresh", "Charts", "Filters"],
    columns: [
      { key: "name", label: "Messaging Session Name" },
      { key: "status", label: "Status" },
      { key: "ownerAlias", label: "Owner Alias" }
    ],
    searchInputName: "Messaging Session-search-input",
    disabledInlineEditMessage: "Inline edit isn't available for the displayed fields."
  },
  Knowledge__kav: {
    object: "Knowledge__kav",
    label: "Knowledge",
    plural: "Knowledge",
    icon: "library",
    dataKey: "knowledgeArticles",
    defaultList: "Recently Viewed",
    listViews: ["All Articles", "Archived Articles", "Draft Articles", "Published Articles", "Recently Viewed (Pinned list)"],
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
    defaultList: "Recently Viewed",
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
  Invoice: {
    object: "Invoice",
    label: "Invoice",
    plural: "Invoices",
    icon: "receipt",
    dataKey: "invoices",
    defaultList: "Recently Viewed",
    listViews: ["All Invoices", "Recently Viewed (Pinned list)"],
    actions: ["List View Controls", "Refresh", "Edit List", "Charts", "Filters"],
    columns: [
      { key: "name", label: "Invoice Name" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount" }
    ],
    searchInputName: "Invoice-search-input"
  },
  VideoCall: {
    object: "VideoCall",
    label: "Video Call",
    plural: "Video Calls",
    icon: "video",
    dataKey: "videoCalls",
    defaultList: "Recently Viewed",
    listViews: ["All Video Calls", "Recently Viewed (Pinned list)"],
    actions: ["List View Controls", "Refresh", "Edit List", "Charts", "Filters"],
    columns: [
      { key: "name", label: "Video Call Name" },
      { key: "provider", label: "Provider" },
      { key: "startedAt", label: "Started At" }
    ],
    searchInputName: "Video Call-search-input"
  }
};

const addressFields = (prefix: string, section: string) => [
  { name: `${prefix}Country`, label: `${section.replace(" Address", "")} Country`, section, type: "picklist" as const, options: COUNTRIES, defaultValue: "--None--" },
  { name: `${prefix}Street`, label: `${section.replace(" Address", "")} Street`, section, type: "textarea" as const },
  { name: `${prefix}PostalCode`, label: `${section.replace(" Address", "")} Zip/Postal Code`, section, type: "text" as const },
  { name: `${prefix}City`, label: `${section.replace(" Address", "")} City`, section, type: "text" as const },
  {
    name: `${prefix}State`,
    label: `${section.replace(" Address", "")} State/Province`,
    section,
    type: "picklist" as const,
    options: ["--None--"],
    dependsOn: `${prefix}Country`,
    defaultValue: "--None--"
  }
];

export const FORM_DEFINITIONS: Partial<Record<CrmObject, FormDefinition>> = {
  Account: {
    object: "Account",
    title: "New Account",
    fields: [
      { name: "name", label: "Account Name", section: "About", type: "text", required: true },
      { name: "website", label: "Website", section: "About", type: "url" },
      { name: "type", label: "Type", section: "About", type: "picklist", options: ACCOUNT_TYPES, defaultValue: "--None--" },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "parentAccountId", label: "Parent Account", section: "About", type: "lookup", lookupObject: "Account" },
      { name: "ownerId", label: "Account Owner", section: "About", type: "lookup", lookupObject: "User" },
      { name: "phone", label: "Phone", section: "Get in Touch", type: "phone" },
      ...addressFields("billing", "Billing Address"),
      ...addressFields("shipping", "Shipping Address")
    ]
  },
  Contact: {
    object: "Contact",
    title: "New Contact",
    fields: [
      { name: "salutation", label: "Salutation", section: "About", type: "picklist", options: SALUTATIONS, defaultValue: "--None--" },
      { name: "firstName", label: "First Name", section: "About", type: "text" },
      { name: "lastName", label: "Last Name", section: "About", type: "text", required: true },
      { name: "accountId", label: "Account Name", section: "About", type: "lookup", lookupObject: "Account", required: true },
      { name: "title", label: "Title", section: "About", type: "text" },
      { name: "reportsToContactId", label: "Reports To", section: "About", type: "lookup", lookupObject: "Contact" },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "ownerId", label: "Contact Owner", section: "About", type: "lookup", lookupObject: "User" },
      { name: "phone", label: "Phone", section: "Get in Touch", type: "phone" },
      { name: "email", label: "Email", section: "Get in Touch", type: "email" },
      ...addressFields("mailing", "Mailing Address")
    ]
  },
  Lead: {
    object: "Lead",
    title: "New Lead",
    fields: [
      { name: "status", label: "Lead Status", section: "About", type: "picklist", options: LEAD_STATUS, required: true, defaultValue: "New" },
      { name: "salutation", label: "Salutation", section: "About", type: "picklist", options: SALUTATIONS, defaultValue: "--None--" },
      { name: "firstName", label: "First Name", section: "About", type: "text" },
      { name: "lastName", label: "Last Name", section: "About", type: "text", required: true },
      { name: "company", label: "Company", section: "About", type: "text", required: true },
      { name: "title", label: "Title", section: "About", type: "text" },
      { name: "website", label: "Website", section: "About", type: "url" },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "ownerId", label: "Lead Owner", section: "About", type: "lookup", lookupObject: "User" },
      { name: "rating", label: "Rating", section: "About", type: "picklist", options: LEAD_RATING, defaultValue: "--None--" },
      { name: "phone", label: "Phone", section: "Get in Touch", type: "phone" },
      { name: "email", label: "Email", section: "Get in Touch", type: "email" },
      { name: "country", label: "Country", section: "Address", type: "picklist", options: COUNTRIES, defaultValue: "--None--" },
      { name: "street", label: "Street", section: "Address", type: "textarea" },
      { name: "postalCode", label: "Zip/Postal Code", section: "Address", type: "text" },
      { name: "city", label: "City", section: "Address", type: "text" },
      { name: "state", label: "State/Province", section: "Address", type: "picklist", options: ["--None--"], dependsOn: "country", defaultValue: "--None--" },
      { name: "numberOfEmployees", label: "No. of Employees", section: "Segment", type: "number" },
      { name: "annualRevenue", label: "Annual Revenue", section: "Segment", type: "currency" },
      { name: "leadSource", label: "Lead Source", section: "Segment", type: "picklist", options: LEAD_SOURCE, defaultValue: "--None--" },
      { name: "industry", label: "Industry", section: "Segment", type: "picklist", options: INDUSTRIES, defaultValue: "--None--" }
    ]
  },
  Opportunity: {
    object: "Opportunity",
    title: "New Opportunity",
    fields: [
      { name: "name", label: "Opportunity Name", section: "About", type: "text", required: true },
      { name: "accountId", label: "Account Name", section: "About", type: "lookup", lookupObject: "Account", required: true },
      { name: "closeDate", label: "Close Date", section: "About", type: "date", required: true },
      { name: "amount", label: "Amount", section: "About", type: "currency" },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "ownerId", label: "Opportunity Owner", section: "About", type: "lookup", lookupObject: "User" },
      { name: "stage", label: "Stage", section: "Status", type: "picklist", required: true, options: OPPORTUNITY_STAGE, defaultValue: "--None--" },
      { name: "probability", label: "Probability (%)", section: "Status", type: "number" },
      { name: "forecastCategory", label: "Forecast Category", section: "Status", type: "picklist", required: true, options: FORECAST_CATEGORY, defaultValue: "--None--" },
      { name: "nextStep", label: "Next Step", section: "Status", type: "text" }
    ]
  },
  Case: {
    object: "Case",
    title: "New Case",
    fields: [
      { name: "status", label: "Status", section: "Case Information", type: "picklist", required: true, options: CASE_STATUS, defaultValue: "New" },
      { name: "origin", label: "Case Origin", section: "Case Information", type: "picklist", options: CASE_ORIGIN, defaultValue: "--None--" },
      { name: "priority", label: "Priority", section: "Case Information", type: "picklist", options: CASE_PRIORITY, defaultValue: "Medium" },
      { name: "ownerId", label: "Case Owner", section: "Case Information", type: "lookup", lookupObject: "User" },
      { name: "contactId", label: "Contact Name", section: "Contact Information", type: "lookup", lookupObject: "Contact" },
      { name: "accountId", label: "Account Name", section: "Contact Information", type: "lookup", lookupObject: "Account" },
      { name: "subject", label: "Subject", section: "Description Information", type: "text" },
      { name: "description", label: "Description", section: "Description Information", type: "textarea" },
      { name: "sendNotificationEmailToContact", label: "Send notification email to contact", section: "Description Information", type: "checkbox" }
    ]
  },
  Pricebook2: {
    object: "Pricebook2",
    title: "New Price Book",
    fields: [
      { name: "name", label: "Price Book Name", section: "Price Book Information", type: "text", required: true },
      { name: "active", label: "Active", section: "Price Book Information", type: "checkbox" },
      { name: "description", label: "Description", section: "Price Book Information", type: "textarea" },
      { name: "isStandard", label: "Is Standard Price Book", section: "Price Book Information", type: "readonly", defaultValue: "False" },
      { name: "validFrom", label: "Valid From", section: "Price Book Information", type: "date" },
      { name: "validFromTime", label: "Valid From Time", section: "Price Book Information", type: "picklist", options: TIME_SLOTS, defaultValue: "00:00" },
      { name: "validTo", label: "Valid To", section: "Price Book Information", type: "date" },
      { name: "validToTime", label: "Valid To Time", section: "Price Book Information", type: "picklist", options: TIME_SLOTS, defaultValue: "00:00" }
    ]
  }
};

export function objectRoute(object: CrmObject) {
  return `/lightning/o/${object}/list`;
}
