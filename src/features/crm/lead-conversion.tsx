"use client";

import { Building2, Target, User } from "lucide-react";
import { useState, type ElementType, type ReactNode } from "react";
import { FORM_DEFINITIONS, LEAD_STATUS, SALUTATIONS } from "@/lib/crm-metadata";
import { contactName } from "@/lib/crm-data";
import {
  accountNameForLead,
  findExactAccountMatch,
  matchAccountsForLead,
  matchContactsForLead,
  opportunityNameFor,
  probabilityForStage,
  type ConvertibleLead
} from "@/lib/lead-conversion";
import { isValidEmail } from "@/lib/record-validation";
import { type ScopedCrmData, type CrmObject, type FieldDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { FieldShell, inputClass, NativeSelect, RadixCheckbox } from "@/features/crm/controls";
import { defaultLeadConversionCloseDate } from "@/features/crm/data-model";
import { FormFields, LookupField, picklistOptionsForField } from "@/features/crm/form-controls";
import { validateFields } from "@/features/crm/form-model";
import { requiredId } from "@/features/crm/record-model";

/** Same Opportunity create form, minus Account — conversion already picks that above. */
export const CONVERSION_OPPORTUNITY_FIELDS = (FORM_DEFINITIONS.Opportunity?.fields ?? []).filter(
  (field) => field.name !== "accountId"
);

export type LeadConversionForm = {
  accountMode: "new" | "existing";
  accountName: string;
  existingAccountId: string;
  contactMode: "new" | "existing";
  existingContactId: string;
  contact: { salutation: string; firstName: string; lastName: string; title: string; phone: string; email: string };
  createOpportunity: boolean;
  opportunityMode: "new" | "existing";
  existingOpportunityId: string;
  opportunity: RecordData;
  convertedStatus: string;
};
export function initialLeadConversionForm(lead: RecordData): LeadConversionForm {
  const accountName = accountNameForLead(leadForConversion(lead));
  const stage = "Qualify";
  const leadSource = String(lead.leadSource ?? "").trim();
  return {
    accountMode: "new",
    accountName,
    existingAccountId: "",
    contactMode: "new",
    existingContactId: "",
    contact: {
      salutation: String(lead.salutation ?? ""),
      firstName: String(lead.firstName ?? ""),
      lastName: String(lead.lastName ?? ""),
      title: String(lead.title ?? ""),
      phone: String(lead.phone ?? ""),
      email: String(lead.email ?? "")
    },
    createOpportunity: true,
    opportunityMode: "new",
    existingOpportunityId: "",
    opportunity: {
      name: opportunityNameFor(accountName),
      amount: "",
      closeDate: defaultLeadConversionCloseDate(),
      description: String(lead.description ?? ""),
      ownerId: String(lead.ownerId ?? ""),
      stage,
      probability: String(probabilityForStage(stage) ?? ""),
      forecastCategory: "Pipeline",
      nextStep: "Follow up after lead conversion",
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
  const [form, setForm] = useState<LeadConversionForm>(() => initialLeadConversionForm(firstLead));

  const update = (patch: Partial<LeadConversionForm>) => setForm((current) => ({ ...current, ...patch }));
  const updateContact = (patch: Partial<LeadConversionForm["contact"]>) =>
    setForm((current) => ({ ...current, contact: { ...current.contact, ...patch } }));
  const setOpportunityField = (name: string, value: unknown) =>
    setForm((current) => {
      const opportunity = { ...current.opportunity, [name]: value };
      for (const field of CONVERSION_OPPORTUNITY_FIELDS) {
        if (field.dependsOn === name) {
          const options = picklistOptionsForField(field, opportunity);
          const currentDependent = String(opportunity[field.name] ?? "--None--");
          if (!options.includes(currentDependent)) opportunity[field.name] = "--None--";
        }
      }
      return { ...current, opportunity };
    });

  const convertible = leadForConversion(firstLead);
  const contactDisplayName = contactName(firstLead) || "Converted Contact";
  const matchedAccounts = targetCount === 1 ? matchAccountsForLead(data.accounts.map(toNamedAccount), convertible) : [];
  const matchedContacts = targetCount === 1 ? matchContactsForLead(data.contacts.map(toNamedContact), convertible) : [];
  const duplicateAccount =
    targetCount === 1 && form.accountMode === "new"
      ? findExactAccountMatch(data.accounts.map(toNamedAccount), form.accountName)
      : undefined;
  const duplicateContact = targetCount === 1 && form.contactMode === "new" ? matchedContacts[0] : undefined;

  const opportunityOptions = data.opportunities.filter((opportunity) => {
    if (!form.existingAccountId) return true;
    return String(opportunity.accountId ?? "") === form.existingAccountId;
  });

  const errors = leadConversionFormErrors(form, targetCount);
  const opportunityErrors = opportunityFieldErrors(errors);
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
                  <FieldShell label="Account Name" error={errors.accountName}>
                    <input
                      className={inputClass}
                      value={form.accountName}
                      onChange={(event) => update({ accountName: event.target.value })}
                    />
                  </FieldShell>
                  {duplicateAccount ? (
                    <DuplicateWarning
                      message={`An account named "${String(duplicateAccount.name)}" already exists. Converting will reuse it instead of creating a duplicate.`}
                      actionLabel="Choose it explicitly"
                      onAction={() => update({ accountMode: "existing", existingAccountId: duplicateAccount.id })}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
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
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldShell label="Salutation">
                      <NativeSelect
                        options={SALUTATIONS}
                        value={form.contact.salutation || "--None--"}
                        onChange={(value) => updateContact({ salutation: value })}
                      />
                    </FieldShell>
                    <FieldShell label="Title">
                      <input
                        className={inputClass}
                        value={form.contact.title}
                        onChange={(event) => updateContact({ title: event.target.value })}
                      />
                    </FieldShell>
                    <FieldShell label="First Name">
                      <input
                        className={inputClass}
                        value={form.contact.firstName}
                        onChange={(event) => updateContact({ firstName: event.target.value })}
                      />
                    </FieldShell>
                    <FieldShell label="Last Name" required error={errors["contact.lastName"]}>
                      <input
                        className={inputClass}
                        value={form.contact.lastName}
                        onChange={(event) => updateContact({ lastName: event.target.value })}
                      />
                    </FieldShell>
                    <FieldShell label="Email" error={errors["contact.email"]}>
                      <input
                        className={inputClass}
                        value={form.contact.email}
                        onChange={(event) => updateContact({ email: event.target.value })}
                      />
                    </FieldShell>
                    <FieldShell label="Phone">
                      <input
                        className={inputClass}
                        value={form.contact.phone}
                        onChange={(event) => updateContact({ phone: event.target.value })}
                      />
                    </FieldShell>
                  </div>
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
            <p className="text-sm text-[#706e6b]">
              Each selected lead uses its Company value for the converted account and creates a matching contact.
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
    if (!form.accountName.trim()) errors.accountName = "Account Name is required.";
  } else if (!form.existingAccountId) {
    errors.existingAccountId = "Choose an account.";
  }

  if (form.contactMode === "new") {
    if (!form.contact.lastName.trim()) errors["contact.lastName"] = "Last Name is required.";
    if (form.contact.email.trim() && !isValidEmail(form.contact.email))
      errors["contact.email"] = "Enter a valid email address.";
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
export function opportunityFieldErrors(errors: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith("opportunity."))
      .map(([key, message]) => [key.slice("opportunity.".length), message])
  );
}
export function leadConversionPayload(form: LeadConversionForm, targetCount: number): RecordData {
  if (targetCount !== 1) {
    return { createOpportunity: form.createOpportunity, convertedStatus: form.convertedStatus };
  }
  const usesNewOpportunity = form.createOpportunity && form.opportunityMode === "new";
  const opportunity = form.opportunity;
  return {
    accountName: form.accountMode === "new" ? form.accountName : "",
    existingAccountId: form.accountMode === "existing" ? form.existingAccountId : "",
    existingContactId: form.contactMode === "existing" ? form.existingContactId : "",
    contact:
      form.contactMode === "new"
        ? {
            salutation: form.contact.salutation,
            firstName: form.contact.firstName,
            lastName: form.contact.lastName,
            title: form.contact.title,
            phone: form.contact.phone,
            email: form.contact.email
          }
        : undefined,
    createOpportunity: form.createOpportunity,
    existingOpportunityId:
      form.createOpportunity && form.opportunityMode === "existing" ? form.existingOpportunityId : "",
    opportunityName: usesNewOpportunity ? String(opportunity.name ?? "") : "",
    amount: usesNewOpportunity ? String(opportunity.amount ?? "") : "",
    closeDate: usesNewOpportunity ? String(opportunity.closeDate ?? "") : "",
    stage: usesNewOpportunity ? String(opportunity.stage ?? "Qualify") : "Qualify",
    forecastCategory: usesNewOpportunity ? String(opportunity.forecastCategory ?? "Pipeline") : "Pipeline",
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
