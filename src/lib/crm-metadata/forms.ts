import type { CrmObject, FormDefinition } from "@/lib/crm-types";
import { COUNTRIES } from "@/lib/crm-metadata/geographic";
import { TIME_SLOTS } from "@/lib/crm-metadata/navigation";
import {
  ACCOUNT_TYPES,
  CASE_ORIGIN,
  CASE_PRIORITY,
  CASE_STATUS,
  COURIER,
  FORECAST_CATEGORY,
  INDUSTRIES,
  LEAD_RATING,
  LEAD_SOURCE,
  LEAD_STATUS,
  OPPORTUNITY_STAGE,
  PRODUCT_FAMILY,
  SALUTATIONS,
  SAMPLE_STATUS
} from "@/lib/crm-metadata/options";

/** Courier, tracking number, and delivery date, shared verbatim by Opportunity and Lead. */
const shipmentFields = (section: string) => [
  {
    name: "courier",
    label: "Courier",
    section,
    type: "picklist" as const,
    options: COURIER,
    defaultValue: "--None--"
  },
  { name: "trackingNumber", label: "Tracking Number", section, type: "text" as const },
  { name: "deliveryDate", label: "Delivery Date", section, type: "date" as const }
];

const addressFields = (prefix: string, section: string) => [
  {
    name: `${prefix}Country`,
    label: `${section.replace(" Address", "")} Country`,
    section,
    type: "picklist" as const,
    options: COUNTRIES,
    defaultValue: "--None--"
  },
  { name: `${prefix}Street`, label: `${section.replace(" Address", "")} Street`, section, type: "textarea" as const },
  {
    name: `${prefix}PostalCode`,
    label: `${section.replace(" Address", "")} Zip/Postal Code`,
    section,
    type: "text" as const
  },
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
      {
        name: "type",
        label: "Type",
        section: "About",
        type: "picklist",
        options: ACCOUNT_TYPES,
        defaultValue: "--None--"
      },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "parentAccountId", label: "Parent Account", section: "About", type: "lookup", lookupObject: "Account" },
      { name: "ownerId", label: "Account Owner", section: "About", type: "lookup", lookupObject: "User" },
      { name: "phone", label: "Phone", section: "Get in Touch", type: "phone" },
      { name: "numberOfEmployees", label: "No. of Employees", section: "Segment", type: "number" },
      { name: "annualRevenue", label: "Annual Revenue", section: "Segment", type: "currency" },
      {
        name: "industry",
        label: "Industry",
        section: "Segment",
        type: "picklist",
        options: INDUSTRIES,
        defaultValue: "--None--"
      },
      {
        name: "rating",
        label: "Rating",
        section: "Segment",
        type: "picklist",
        options: LEAD_RATING,
        defaultValue: "--None--"
      },
      ...addressFields("billing", "Billing Address"),
      ...addressFields("shipping", "Shipping Address")
    ]
  },
  Contact: {
    object: "Contact",
    title: "New Contact",
    fields: [
      {
        name: "salutation",
        label: "Salutation",
        section: "About",
        type: "picklist",
        options: SALUTATIONS,
        defaultValue: "--None--"
      },
      { name: "firstName", label: "First Name", section: "About", type: "text" },
      { name: "lastName", label: "Last Name", section: "About", type: "text", required: true },
      {
        name: "accountId",
        label: "Account Name",
        section: "About",
        type: "lookup",
        lookupObject: "Account",
        required: true
      },
      { name: "title", label: "Title", section: "About", type: "text" },
      { name: "reportsToContactId", label: "Reports To", section: "About", type: "lookup", lookupObject: "Contact" },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "ownerId", label: "Contact Owner", section: "About", type: "lookup", lookupObject: "User" },
      { name: "phone", label: "Phone", section: "Get in Touch", type: "phone" },
      { name: "email", label: "Email", section: "Get in Touch", type: "email" },
      { name: "birthDate", label: "Birthdate", section: "Get in Touch", type: "date" },
      {
        name: "leadSource",
        label: "Lead Source",
        section: "Get in Touch",
        type: "picklist",
        options: LEAD_SOURCE,
        defaultValue: "--None--"
      },
      ...addressFields("mailing", "Mailing Address")
    ]
  },
  Lead: {
    object: "Lead",
    title: "New Lead",
    fields: [
      {
        name: "status",
        label: "Lead Status",
        section: "About",
        type: "picklist",
        options: LEAD_STATUS,
        required: true,
        defaultValue: "New"
      },
      {
        name: "salutation",
        label: "Salutation",
        section: "About",
        type: "picklist",
        options: SALUTATIONS,
        defaultValue: "--None--"
      },
      { name: "firstName", label: "First Name", section: "About", type: "text" },
      { name: "lastName", label: "Last Name", section: "About", type: "text" },
      { name: "company", label: "Company", section: "About", type: "text" },
      { name: "title", label: "Title", section: "About", type: "text" },
      { name: "website", label: "Website", section: "About", type: "url" },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "ownerId", label: "Lead Owner", section: "About", type: "lookup", lookupObject: "User" },
      {
        name: "rating",
        label: "Rating",
        section: "About",
        type: "picklist",
        options: LEAD_RATING,
        defaultValue: "--None--"
      },
      { name: "phone", label: "Phone", section: "Get in Touch", type: "phone" },
      { name: "email", label: "Email", section: "Get in Touch", type: "email" },
      {
        name: "country",
        label: "Country",
        section: "Address",
        type: "picklist",
        options: COUNTRIES,
        defaultValue: "--None--"
      },
      { name: "street", label: "Street", section: "Address", type: "textarea" },
      { name: "postalCode", label: "Zip/Postal Code", section: "Address", type: "text" },
      { name: "city", label: "City", section: "Address", type: "text" },
      {
        name: "state",
        label: "State/Province",
        section: "Address",
        type: "picklist",
        options: ["--None--"],
        dependsOn: "country",
        defaultValue: "--None--"
      },
      { name: "numberOfEmployees", label: "No. of Employees", section: "Segment", type: "number" },
      { name: "annualRevenue", label: "Annual Revenue", section: "Segment", type: "currency" },
      {
        name: "leadSource",
        label: "Lead Source",
        section: "Segment",
        type: "picklist",
        options: LEAD_SOURCE,
        defaultValue: "--None--"
      },
      {
        name: "industry",
        label: "Industry",
        section: "Segment",
        type: "picklist",
        options: INDUSTRIES,
        defaultValue: "--None--"
      },
      { name: "sampleRequestedDate", label: "Sample Requested Date", section: "Sample", type: "date" },
      {
        name: "sampleStatus",
        label: "Sample Status",
        section: "Sample",
        type: "picklist",
        options: SAMPLE_STATUS,
        defaultValue: "--None--"
      },
      ...shipmentFields("Sample")
    ]
  },
  Opportunity: {
    object: "Opportunity",
    title: "New Opportunity",
    fields: [
      { name: "name", label: "Opportunity Name", section: "About", type: "text", required: true },
      {
        name: "accountId",
        label: "Account Name",
        section: "About",
        type: "lookup",
        lookupObject: "Account",
        required: true
      },
      {
        name: "contactId",
        label: "Contact Name",
        section: "About",
        type: "lookup",
        lookupObject: "Contact"
      },
      { name: "closeDate", label: "Close Date", section: "About", type: "date", required: true },
      { name: "amount", label: "Amount", section: "About", type: "currency" },
      { name: "description", label: "Description", section: "About", type: "textarea" },
      { name: "ownerId", label: "Opportunity Owner", section: "About", type: "lookup", lookupObject: "User" },
      {
        name: "stage",
        label: "Stage",
        section: "Status",
        type: "picklist",
        required: true,
        options: OPPORTUNITY_STAGE,
        defaultValue: "--None--"
      },
      { name: "probability", label: "Probability (%)", section: "Status", type: "number" },
      {
        name: "forecastCategory",
        label: "Forecast Category",
        section: "Status",
        type: "picklist",
        required: true,
        options: FORECAST_CATEGORY,
        defaultValue: "--None--"
      },
      { name: "nextStep", label: "Next Step", section: "Status", type: "text" },
      {
        name: "leadSource",
        label: "Lead Source",
        section: "Status",
        type: "picklist",
        options: LEAD_SOURCE,
        defaultValue: "--None--"
      },
      ...shipmentFields("Shipping")
    ]
  },
  Case: {
    object: "Case",
    title: "New Case",
    fields: [
      {
        name: "status",
        label: "Status",
        section: "Case Information",
        type: "picklist",
        required: true,
        options: CASE_STATUS,
        defaultValue: "New"
      },
      {
        name: "origin",
        label: "Case Origin",
        section: "Case Information",
        type: "picklist",
        options: CASE_ORIGIN,
        defaultValue: "--None--"
      },
      {
        name: "priority",
        label: "Priority",
        section: "Case Information",
        type: "picklist",
        options: CASE_PRIORITY,
        defaultValue: "Medium"
      },
      { name: "ownerId", label: "Case Owner", section: "Case Information", type: "lookup", lookupObject: "User" },
      {
        name: "contactId",
        label: "Contact Name",
        section: "Contact Information",
        type: "lookup",
        lookupObject: "Contact"
      },
      {
        name: "accountId",
        label: "Account Name",
        section: "Contact Information",
        type: "lookup",
        lookupObject: "Account"
      },
      { name: "subject", label: "Subject", section: "Description Information", type: "text" },
      { name: "description", label: "Description", section: "Description Information", type: "textarea" },
      {
        name: "sendNotificationEmailToContact",
        label: "Send notification email to contact",
        section: "Description Information",
        type: "checkbox"
      }
    ]
  },
  Pricebook2: {
    object: "Pricebook2",
    title: "New Price Book",
    fields: [
      { name: "name", label: "Price Book Name", section: "Price Book Information", type: "text", required: true },
      { name: "active", label: "Active", section: "Price Book Information", type: "checkbox" },
      { name: "description", label: "Description", section: "Price Book Information", type: "textarea" },
      {
        name: "isStandard",
        label: "Is Standard Price Book",
        section: "Price Book Information",
        type: "readonly",
        defaultValue: false
      },
      { name: "validFrom", label: "Valid From", section: "Price Book Information", type: "date" },
      {
        name: "validFromTime",
        label: "Valid From Time",
        section: "Price Book Information",
        type: "picklist",
        options: TIME_SLOTS,
        defaultValue: "00:00"
      },
      { name: "validTo", label: "Valid To", section: "Price Book Information", type: "date" },
      {
        name: "validToTime",
        label: "Valid To Time",
        section: "Price Book Information",
        type: "picklist",
        options: TIME_SLOTS,
        defaultValue: "00:00"
      }
    ]
  },
  Product2: {
    object: "Product2",
    title: "New Product",
    fields: [
      { name: "name", label: "Product Name", section: "Product Information", type: "text", required: true },
      {
        name: "family",
        label: "Product Family",
        section: "Product Information",
        type: "picklist",
        options: PRODUCT_FAMILY,
        defaultValue: "--None--"
      },
      { name: "productCode", label: "Product Code", section: "Product Information", type: "text" },
      { name: "sku", label: "Product SKU", section: "Product Information", type: "text" },
      { name: "category", label: "Category", section: "Product Information", type: "text" },
      { name: "active", label: "Active", section: "Product Information", type: "checkbox" },
      { name: "description", label: "Description", section: "Product Information", type: "textarea" }
    ]
  }
};
