"use client";

import { Building2, Target, User } from "lucide-react";
import { useState, type ElementType, type ReactNode } from "react";
import { FORM_DEFINITIONS, LEAD_STATUS } from "@/lib/crm-metadata";
import { contactName } from "@/lib/crm-data";
import {
  accountNameForLead,
  CONVERSION_OPPORTUNITY_FORECAST,
  CONVERSION_OPPORTUNITY_STAGE,
  findExactAccountMatch,
  matchAccountsForLead,
  matchContactsForLead,
  opportunityNameFor,
  defaultOpportunitySeed,
  type ConvertibleLead
} from "@/lib/lead-conversion";
import { isValidEmail } from "@/lib/record-validation";
import { type ScopedCrmData, type CrmObject, type FieldDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { FieldShell, NativeSelect, RadixCheckbox } from "@/features/crm/controls";
import { FormFields, LookupField, picklistOptionsForField } from "@/features/crm/form-controls";
import { buildInitialValues, validateFields } from "@/features/crm/form-model";
import { requiredId } from "@/features/crm/record-model";

/** Account create form — conversion already chooses create vs existing above. */
export const CONVERSION_ACCOUNT_FIELDS = FORM_DEFINITIONS.Account?.fields ?? [];

/** Contact create form, minus Account — conversion already picks that above. */
export const CONVERSION_CONTACT_FIELDS = (FORM_DEFINITIONS.Contact?.fields ?? []).filter(
  (field) => field.name !== "accountId"
);

/**
 * Opportunity create form, minus Account and Contact — conversion already picks those.
 * Contact is linked automatically to the converted contact.
 */
export const CONVERSION_OPPORTUNITY_FIELDS = (FORM_DEFINITIONS.Opportunity?.fields ?? []).filter(
  (field) => field.name !== "accountId" && field.name !== "contactId"
);

export type LeadConversionForm = {
  accountMode: "new" | "existing";
  existingAccountId: string;
  account: RecordData;
  contactMode: "new" | "existing";
  existingContactId: string;
  contact: RecordData;
  createOpportunity: boolean;
  opportunityMode: "new" | "existing";
  existingOpportunityId: string;
  opportunity: RecordData;
  convertedStatus: string;
};

export function initialLeadConversionForm(lead: RecordData, currentUserId?: string): LeadConversionForm {
  const accountName = accountNameForLead(leadForConversion(lead));
  const opportunitySeed = defaultOpportunitySeed();
  const stage = opportunitySeed.stage;
  const leadSource = String(lead.leadSource ?? "").trim();
  const accountDefinition = FORM_DEFINITIONS.Account;
  const contactDefinition = FORM_DEFINITIONS.Contact;

  const account = accountDefinition
    ? buildInitialValues(
        accountDefinition,
        {
          name: accountName,
          website: lead.website ?? "",
          // Match Account form default (--None--); do not hardcode Prospect.
          description: lead.description ?? "",
          ownerId: String(lead.ownerId ?? currentUserId ?? ""),
          phone: lead.phone ?? "",
          numberOfEmployees: lead.numberOfEmployees ?? "",
          annualRevenue: lead.annualRevenue ?? "",
          industry: lead.industry ?? "--None--",
          rating: lead.rating ?? "--None--",
          billingCountry: lead.country ?? "--None--",
          billingStreet: lead.street ?? "",
          billingPostalCode: lead.postalCode ?? "",
          billingCity: lead.city ?? "",
          billingState: lead.state ?? "--None--"
        },
        currentUserId
      )
    : { name: accountName };

  const contact = contactDefinition
    ? buildInitialValues(
        contactDefinition,
        {
          salutation: lead.salutation ?? "--None--",
          firstName: lead.firstName ?? "",
          lastName: lead.lastName ?? "",
          title: lead.title ?? "",
          description: lead.description ?? "",
          ownerId: String(lead.ownerId ?? currentUserId ?? ""),
          phone: lead.phone ?? "",
          email: lead.email ?? "",
          leadSource: leadSource || "--None--",
          mailingCountry: lead.country ?? "--None--",
          mailingStreet: lead.street ?? "",
          mailingPostalCode: lead.postalCode ?? "",
          mailingCity: lead.city ?? "",
          mailingState: lead.state ?? "--None--"
        },
        currentUserId
      )
    : {
        firstName: String(lead.firstName ?? ""),
        lastName: String(lead.lastName ?? ""),
        phone: String(lead.phone ?? ""),
        email: String(lead.email ?? "")
      };

  return {
    accountMode: "new",
    existingAccountId: "",
    account,
    contactMode: "new",
    existingContactId: "",
    contact,
    createOpportunity: false,
    opportunityMode: "new",
    existingOpportunityId: "",
    opportunity: {
      name: opportunityNameFor(accountName),
      amount: "",
      closeDate: opportunitySeed.closeDate.toISOString().slice(0, 10),
      description: String(lead.description ?? ""),
      ownerId: String(lead.ownerId ?? ""),
      stage,
      probability: String(opportunitySeed.probability ?? ""),
      forecastCategory: opportunitySeed.forecastCategory,
      nextStep: opportunitySeed.nextStep,
      leadSource: leadSource || "--None--",
      courier: "--None--",
      trackingNumber: ""
    },
    convertedStatus: "Qualified"
  };
}

export function leadForConversion(lead: RecordData): ConvertibleLead {
  return {
    id: requiredId(lead),
    firstName: lead.firstName == null ? null : String(lead.firstName),
    lastName: String(lead.lastName ?? ""),
    company: lead.company == null ? null : String(lead.company),
    ownerId: String(lead.ownerId ?? ""),
    phone: lead.phone == null ? null : String(lead.phone),
    email: lead.email == null ? null : String(lead.email)
  };
}

function setDependentFields(fields: FieldDefinition[], values: RecordData, name: string) {
  const next = { ...values, [name]: values[name] };
  for (const field of fields) {
    if (field.dependsOn === name) {
      const options = picklistOptionsForField(field, next);
      const currentDependent = String(next[field.name] ?? "--None--");
      if (!options.includes(currentDependent)) next[field.name] = "--None--";
    }
  }
  return next;
}

export function LeadConversionDialog({
  title,
  leads,
  selectedIds,
  data,
  onClose,
  onApply
}: {
  title: string;
  leads: RecordData[];
  selectedIds: string[];
  data: ScopedCrmData;
  onClose: () => void;
  onApply: (action: string, object: CrmObject, selectedIds: string[], payload: RecordData) => Promise<void>;
}) {
  const targetCount = leads.length;
  const firstLead = leads[0] ?? {};
  const [form, setForm] = useState<LeadConversionForm>(() => initialLeadConversionForm(firstLead, data.user.id));

  const update = (patch: Partial<LeadConversionForm>) => setForm((current) => ({ ...current, ...patch }));
  const setAccountField = (name: string, value: unknown) =>
    setForm((current) => ({
      ...current,
      account: setDependentFields(CONVERSION_ACCOUNT_FIELDS, { ...current.account, [name]: value }, name)
    }));
  const setContactField = (name: string, value: unknown) =>
    setForm((current) => ({
      ...current,
      contact: setDependentFields(CONVERSION_CONTACT_FIELDS, { ...current.contact, [name]: value }, name)
    }));
  const setOpportunityField = (name: string, value: unknown) =>
    setForm((current) => ({
      ...current,
      opportunity: setDependentFields(CONVERSION_OPPORTUNITY_FIELDS, { ...current.opportunity, [name]: value }, name)
    }));

  const convertible = leadForConversion(firstLead);
  const contactDisplayName = contactName(firstLead) || "Converted Contact";
  const matchedAccounts = targetCount === 1 ? matchAccountsForLead(data.accounts.map(toNamedAccount), convertible) : [];
  const matchedContacts = targetCount === 1 ? matchContactsForLead(data.contacts.map(toNamedContact), convertible) : [];
  const accountName = String(form.account.name ?? "").trim();
  const duplicateAccount =
    targetCount === 1 && form.accountMode === "new"
      ? findExactAccountMatch(data.accounts.map(toNamedAccount), accountName)
      : undefined;
  const duplicateContact = targetCount === 1 && form.contactMode === "new" ? matchedContacts[0] : undefined;

  const opportunityOptions = data.opportunities.filter((opportunity) => {
    if (!form.existingAccountId) return true;
    return String(opportunity.accountId ?? "") === form.existingAccountId;
  });

  const errors = leadConversionFormErrors(form, targetCount);
  const accountErrors = prefixedFieldErrors(errors, "account.");
  const contactErrors = prefixedFieldErrors(errors, "contact.");
  const opportunityErrors = prefixedFieldErrors(errors, "opportunity.");
  const canConvert = targetCount > 0 && Object.keys(errors).length === 0;

  const accountLookupField: FieldDefinition = {
    name: "existingAccountId",
    label: "Account",
    section: "Account",
    type: "lookup",
    lookupObject: "Account"
  };
  const contactLookupField: FieldDefinition = {
    name: "existingContactId",
    label: "Contact",
    section: "Contact",
    type: "lookup",
    lookupObject: "Contact"
  };
  const opportunityLookupField: FieldDefinition = {
    name: "existingOpportunityId",
    label: "Opportunity",
    section: "Opportunity",
    type: "lookup",
    lookupObject: "Opportunity"
  };

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="primary"
        disabled={!canConvert}
        onClick={() => onApply("Convert Lead", "Lead", selectedIds, leadConversionPayload(form, targetCount))}
      >
        Convert
      </Button>
    </>
  );

  return (
    <BaseDialog open title={title} onClose={onClose} wide footer={footer}>
      <div className="grid gap-4">
        <div className="rounded border border-[#d8dde6] bg-[#f3f9ff] px-3 py-2 text-sm text-[#16325c]">
          {targetCount === 0
            ? "Select a lead before converting."
            : targetCount === 1
              ? `Convert ${contactDisplayName} into an account, contact, and optional opportunity.`
              : `${targetCount} leads will each convert into an account, contact, and optional opportunity.`}
        </div>
        {targetCount === 1 ? (
          <div className="grid gap-3">
            <ConversionSection
              icon={Building2}
              title="Account"
              subtitle="Company the contact belongs to"
              mode={form.accountMode}
              onModeChange={(mode) =>
                update({
                  accountMode: mode,
                  existingAccountId:
                    mode === "existing" ? form.existingAccountId || requiredId(matchedAccounts[0] ?? {}) : ""
                })
              }
            >
              {form.accountMode === "new" ? (
                <div className="space-y-2">
                  <FormFields
                    fields={CONVERSION_ACCOUNT_FIELDS}
                    values={form.account}
                    errors={accountErrors}
                    data={data}
                    onChange={setAccountField}
                  />
                  {duplicateAccount ? (
                    <DuplicateWarning
                      message={`An account named "${String(duplicateAccount.name)}" already exists. Create New will still create another Account with this name unless you choose the existing one.`}
                      actionLabel="Choose existing Account"
                      onAction={() => update({ accountMode: "existing", existingAccountId: duplicateAccount.id })}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#706e6b]">
                    Existing Account is kept; blank fields are gap-filled from the Lead. Values already on the Account
                    are not overwritten.
                  </p>
                  {matchedAccounts.length > 0 && !form.existingAccountId && (
                    <button
                      type="button"
                      className="w-full rounded border border-[#94d0ff] bg-[#f3f9ff] px-3 py-2 text-left text-sm hover:bg-[#e8f4ff]"
                      onClick={() => update({ existingAccountId: matchedAccounts[0].id })}
                    >
                      Suggested match: <span className="font-semibold">{String(matchedAccounts[0].name)}</span>
                    </button>
                  )}
                  <FieldShell label="Account" error={errors.existingAccountId}>
                    <LookupField
                      field={accountLookupField}
                      value={form.existingAccountId}
                      data={data}
                      onChange={(next) => update({ existingAccountId: next })}
                    />
                  </FieldShell>
                </div>
              )}
            </ConversionSection>

            <ConversionSection
              icon={User}
              title="Contact"
              subtitle={contactDisplayName}
              mode={form.contactMode}
              onModeChange={(mode) =>
                update({
                  contactMode: mode,
                  existingContactId:
                    mode === "existing" ? form.existingContactId || requiredId(matchedContacts[0] ?? {}) : ""
                })
              }
            >
              {form.contactMode === "new" ? (
                <div className="space-y-2">
                  <FormFields
                    fields={CONVERSION_CONTACT_FIELDS}
                    values={form.contact}
                    errors={contactErrors}
                    data={data}
                    onChange={setContactField}
                  />
                  {duplicateContact ? (
                    <DuplicateWarning
                      message={`${contactName(duplicateContact as RecordData) || "An existing contact"} already looks like this lead. Creating a new contact will duplicate them.`}
                      actionLabel="Use the existing contact"
                      onAction={() => update({ contactMode: "existing", existingContactId: duplicateContact.id })}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#706e6b]">
                    Existing Contact is re-parented onto the converted Account. Blank Contact fields are gap-filled from
                    the Lead; existing values are kept.
                  </p>
                  {matchedContacts.length > 0 && !form.existingContactId && (
                    <button
                      type="button"
                      className="w-full rounded border border-[#94d0ff] bg-[#f3f9ff] px-3 py-2 text-left text-sm hover:bg-[#e8f4ff]"
                      onClick={() => update({ existingContactId: matchedContacts[0].id })}
                    >
                      Suggested match:{" "}
                      <span className="font-semibold">{contactName(matchedContacts[0] as RecordData)}</span>
                      {matchedContacts[0].email ? (
                        <span className="text-[#706e6b]"> · {String(matchedContacts[0].email)}</span>
                      ) : null}
                    </button>
                  )}
                  <FieldShell label="Contact" error={errors.existingContactId}>
                    <LookupField
                      field={contactLookupField}
                      value={form.existingContactId}
                      data={data}
                      onChange={(next) => update({ existingContactId: next })}
                    />
                  </FieldShell>
                </div>
              )}
            </ConversionSection>

            <ConversionSection
              icon={Target}
              title="Opportunity"
              subtitle="Optional deal for this conversion"
              mode={form.createOpportunity ? form.opportunityMode : "new"}
              onModeChange={(mode) => update({ createOpportunity: true, opportunityMode: mode })}
              disabled={!form.createOpportunity}
              extraHeader={
                <label className="flex items-center gap-2 text-sm text-[#444]">
                  <RadixCheckbox
                    checked={!form.createOpportunity}
                    onCheckedChange={(checked) =>
                      update({ createOpportunity: !checked, opportunityMode: "new", existingOpportunityId: "" })
                    }
                  />
                  Don&apos;t create an opportunity
                </label>
              }
            >
              {form.createOpportunity ? (
                form.opportunityMode === "new" ? (
                  <FormFields
                    fields={CONVERSION_OPPORTUNITY_FIELDS}
                    values={form.opportunity}
                    errors={opportunityErrors}
                    data={data}
                    onChange={setOpportunityField}
                  />
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-[#706e6b]">
                      Existing Opportunity is re-linked to the converted Account and Contact only. Stage, amount, and
                      other Opportunity fields are not changed.
                    </p>
                    {opportunityOptions.length === 0 && form.existingAccountId ? (
                      <p className="text-xs text-[#706e6b]">
                        No open opportunities on the selected account. Search all opportunities below, or create a new
                        one.
                      </p>
                    ) : null}
                    <FieldShell label="Opportunity" error={errors.existingOpportunityId}>
                      <LookupField
                        field={opportunityLookupField}
                        value={form.existingOpportunityId}
                        data={{
                          ...data,
                          opportunities: opportunityOptions.length ? opportunityOptions : data.opportunities
                        }}
                        onChange={(next) => update({ existingOpportunityId: next })}
                      />
                    </FieldShell>
                  </div>
                )
              ) : (
                <p className="text-sm text-[#706e6b]">This lead will convert to an account and contact only.</p>
              )}
            </ConversionSection>

            <FieldShell label="Converted Status">
              <NativeSelect
                options={LEAD_STATUS.filter((status) => status !== "--None--")}
                value={form.convertedStatus}
                onChange={(value) => update({ convertedStatus: value })}
              />
            </FieldShell>
          </div>
        ) : targetCount > 1 ? (
          <div className="grid gap-3">
            {/*
              Intentional reduced flow: bulk convert cannot edit per-lead Account/Contact/Opportunity
              forms. Each lead uses its Company/person fields and the same opportunity defaults as a
              single-lead convert (Qualify / Pipeline / +30 days / conversion next step).
            */}
            <p className="text-sm text-[#706e6b]">
              Bulk convert is a reduced flow: each lead uses its Company value for the account and creates a matching
              contact from lead fields. Opportunity fields use the same system defaults as a single convert (Qualify,
              Pipeline, close date +30 days). Open a single lead to edit full Account, Contact, or Opportunity forms.
            </p>
            <FieldShell label="Create Opportunity">
              <RadixCheckbox
                checked={form.createOpportunity}
                onCheckedChange={(value) => update({ createOpportunity: Boolean(value) })}
              />
            </FieldShell>
            <FieldShell label="Converted Status">
              <NativeSelect
                options={LEAD_STATUS.filter((status) => status !== "--None--")}
                value={form.convertedStatus}
                onChange={(value) => update({ convertedStatus: value })}
              />
            </FieldShell>
            <div className="rounded border border-[#d8dde6]">
              <div className="border-b border-[#d8dde6] bg-[#f8f8f8] px-3 py-2 text-xs font-semibold uppercase text-[#706e6b]">
                Selected Leads
              </div>
              <div className="max-h-48 overflow-auto p-2">
                {leads.map((lead) => (
                  <div
                    key={requiredId(lead)}
                    className="grid gap-1 border-b border-[#f3f3f3] px-2 py-2 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_120px]"
                  >
                    <span className="font-medium">{contactName(lead) || "Unnamed Lead"}</span>
                    <span className="text-[#706e6b]">{String(lead.company ?? "No company")}</span>
                    <span className="text-[#706e6b]">{String(lead.status ?? "New")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </BaseDialog>
  );
}

export function DuplicateWarning({
  message,
  actionLabel,
  onAction
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded border border-[#f5c26b] bg-[#fdf5e6] px-3 py-2 text-sm text-[#8a6116]">
      {message}{" "}
      <button type="button" className="font-semibold underline hover:no-underline" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

export function leadConversionFormErrors(form: LeadConversionForm, targetCount: number) {
  const errors: Record<string, string> = {};
  if (targetCount !== 1) return errors;

  if (form.accountMode === "new") {
    for (const [field, message] of Object.entries(validateFields(CONVERSION_ACCOUNT_FIELDS, form.account))) {
      errors[`account.${field}`] = message;
    }
  } else if (!form.existingAccountId) {
    errors.existingAccountId = "Choose an account.";
  }

  if (form.contactMode === "new") {
    for (const [field, message] of Object.entries(validateFields(CONVERSION_CONTACT_FIELDS, form.contact))) {
      errors[`contact.${field}`] = message;
    }
    const email = String(form.contact.email ?? "").trim();
    if (email && !isValidEmail(email)) errors["contact.email"] = "Enter a valid email address.";
  } else if (!form.existingContactId) {
    errors.existingContactId = "Choose a contact.";
  }

  if (form.createOpportunity) {
    if (form.opportunityMode === "new") {
      for (const [field, message] of Object.entries(validateFields(CONVERSION_OPPORTUNITY_FIELDS, form.opportunity))) {
        errors[`opportunity.${field}`] = message;
      }
      const amount = String(form.opportunity.amount ?? "").trim();
      if (amount && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
        errors["opportunity.amount"] = "Amount must be a non-negative number.";
      }
      const closeDate = String(form.opportunity.closeDate ?? "").trim();
      if (closeDate && !Number.isFinite(new Date(closeDate).getTime())) {
        errors["opportunity.closeDate"] = "Choose a valid Close Date.";
      }
      const probability = String(form.opportunity.probability ?? "").trim();
      if (probability) {
        const value = Number(probability);
        if (!Number.isInteger(value) || value < 0 || value > 100) {
          errors["opportunity.probability"] = "Probability must be a whole number from 0 through 100.";
        }
      }
    } else if (!form.existingOpportunityId) {
      errors.existingOpportunityId = "Choose an opportunity.";
    }
  }

  return errors;
}

export function prefixedFieldErrors(errors: Record<string, string>, prefix: string) {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, message]) => [key.slice(prefix.length), message])
  );
}

/** @deprecated Prefer prefixedFieldErrors(errors, "opportunity.") */
export function opportunityFieldErrors(errors: Record<string, string>) {
  return prefixedFieldErrors(errors, "opportunity.");
}

export function leadConversionPayload(form: LeadConversionForm, targetCount: number): RecordData {
  if (targetCount !== 1) {
    return { createOpportunity: form.createOpportunity, convertedStatus: form.convertedStatus };
  }
  const usesNewOpportunity = form.createOpportunity && form.opportunityMode === "new";
  const opportunity = form.opportunity;
  const account = form.account;
  const contact = form.contact;
  return {
    accountName: form.accountMode === "new" ? String(account.name ?? "") : "",
    account:
      form.accountMode === "new"
        ? {
            type: account.type,
            description: account.description,
            parentAccountId: account.parentAccountId,
            website: account.website,
            ownerId: account.ownerId,
            phone: account.phone,
            numberOfEmployees: account.numberOfEmployees,
            annualRevenue: account.annualRevenue,
            industry: account.industry,
            rating: account.rating,
            billingCountry: account.billingCountry,
            billingStreet: account.billingStreet,
            billingPostalCode: account.billingPostalCode,
            billingCity: account.billingCity,
            billingState: account.billingState,
            shippingCountry: account.shippingCountry,
            shippingStreet: account.shippingStreet,
            shippingPostalCode: account.shippingPostalCode,
            shippingCity: account.shippingCity,
            shippingState: account.shippingState
          }
        : undefined,
    existingAccountId: form.accountMode === "existing" ? form.existingAccountId : "",
    existingContactId: form.contactMode === "existing" ? form.existingContactId : "",
    contact:
      form.contactMode === "new"
        ? {
            salutation: contact.salutation,
            firstName: contact.firstName,
            lastName: contact.lastName,
            title: contact.title,
            phone: contact.phone,
            email: contact.email,
            description: contact.description,
            ownerId: contact.ownerId,
            birthDate: contact.birthDate,
            leadSource: contact.leadSource,
            reportsToContactId: contact.reportsToContactId,
            mailingCountry: contact.mailingCountry,
            mailingStreet: contact.mailingStreet,
            mailingPostalCode: contact.mailingPostalCode,
            mailingCity: contact.mailingCity,
            mailingState: contact.mailingState
          }
        : undefined,
    createOpportunity: form.createOpportunity,
    existingOpportunityId:
      form.createOpportunity && form.opportunityMode === "existing" ? form.existingOpportunityId : "",
    opportunityName: usesNewOpportunity ? String(opportunity.name ?? "") : "",
    amount: usesNewOpportunity ? String(opportunity.amount ?? "") : "",
    closeDate: usesNewOpportunity ? String(opportunity.closeDate ?? "") : "",
    stage: usesNewOpportunity
      ? String(opportunity.stage ?? CONVERSION_OPPORTUNITY_STAGE)
      : CONVERSION_OPPORTUNITY_STAGE,
    forecastCategory: usesNewOpportunity
      ? String(opportunity.forecastCategory ?? CONVERSION_OPPORTUNITY_FORECAST)
      : CONVERSION_OPPORTUNITY_FORECAST,
    description: usesNewOpportunity ? String(opportunity.description ?? "") : "",
    ownerId: usesNewOpportunity ? String(opportunity.ownerId ?? "") : "",
    probability: usesNewOpportunity ? String(opportunity.probability ?? "") : "",
    nextStep: usesNewOpportunity ? String(opportunity.nextStep ?? "") : "",
    leadSource: usesNewOpportunity ? String(opportunity.leadSource ?? "") : "",
    courier: usesNewOpportunity ? String(opportunity.courier ?? "") : "",
    trackingNumber: usesNewOpportunity ? String(opportunity.trackingNumber ?? "") : "",
    convertedStatus: form.convertedStatus
  };
}

export function toNamedAccount(account: RecordData) {
  return { id: requiredId(account), name: account.name == null ? null : String(account.name) };
}

export function toNamedContact(contact: RecordData) {
  return {
    id: requiredId(contact),
    firstName: contact.firstName == null ? null : String(contact.firstName),
    lastName: contact.lastName == null ? null : String(contact.lastName),
    email: contact.email == null ? null : String(contact.email),
    phone: contact.phone == null ? null : String(contact.phone)
  };
}

export function ConversionSection({
  icon: Icon,
  title,
  subtitle,
  mode,
  onModeChange,
  disabled,
  extraHeader,
  children
}: {
  icon: ElementType;
  title: string;
  subtitle: string;
  mode: "new" | "existing";
  onModeChange: (mode: "new" | "existing") => void;
  disabled?: boolean;
  extraHeader?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-[#d8dde6] bg-white", disabled && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ecebea] px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <Icon size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <div className="font-semibold text-[#080707]">{title}</div>
            <div className="truncate text-xs text-[#706e6b]">{subtitle}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraHeader}
          {!disabled && (
            <div className="inline-flex overflow-hidden rounded border border-[#c9c9c9] text-xs">
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1.5",
                  mode === "new" ? "bg-brand-600 text-white" : "bg-white text-[#444] hover:bg-[#f3f3f3]"
                )}
                onClick={() => onModeChange("new")}
              >
                Create New
              </button>
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1.5",
                  mode === "existing" ? "bg-brand-600 text-white" : "bg-white text-[#444] hover:bg-[#f3f3f3]"
                )}
                onClick={() => onModeChange("existing")}
              >
                Choose Existing
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
