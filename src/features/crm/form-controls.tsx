"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { OBJECT_DEFINITIONS, stateOptionsForCountry } from "@/lib/crm-metadata";
import { contactName } from "@/lib/crm-data";
import { type ScopedCrmData, type CrmObject, type FieldDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { FieldShell, inputClass, inputErrorClass, NativeSelect, RadixCheckbox } from "@/features/crm/controls";
import { groupBy } from "@/features/crm/form-model";
import { requiredId } from "@/features/crm/record-model";
import { type LookupOption } from "@/features/crm/shared-types";

export function FormFields({
  fields,
  values,
  errors,
  data,
  onChange
}: {
  fields: FieldDefinition[];
  values: RecordData;
  errors: Record<string, string>;
  data: ScopedCrmData;
  onChange: (name: string, value: unknown) => void;
}) {
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
export function FieldInput({
  field,
  values,
  data,
  error,
  onChange
}: {
  field: FieldDefinition;
  values: RecordData;
  data: ScopedCrmData;
  error?: string;
  onChange: (name: string, value: unknown) => void;
}) {
  const value = values[field.name] ?? field.defaultValue ?? "";
  const controlClass = cn(inputClass, error && inputErrorClass);
  if (field.type === "textarea")
    return (
      <textarea
        className={cn(controlClass, "h-20")}
        value={String(value ?? "")}
        onChange={(event) => onChange(field.name, event.target.value)}
      />
    );
  if (field.type === "picklist") {
    const options = picklistOptionsForField(field, values);
    const countryUnset =
      Boolean(field.dependsOn) && (!values[field.dependsOn!] || values[field.dependsOn!] === "--None--");
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
  if (field.type === "checkbox")
    return (
      <RadixCheckbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(field.name, Boolean(checked))} />
    );
  if (field.type === "lookup") {
    return (
      <LookupField
        field={field}
        value={String(value ?? "")}
        data={data}
        error={Boolean(error)}
        inlineSelection
        onChange={(next) => onChange(field.name, next)}
      />
    );
  }
  if (field.type === "readonly") {
    const display =
      typeof value === "boolean" ? (value ? "True" : "False") : String(value ?? "");
    return <input className={controlClass} readOnly value={display} />;
  }
  return (
    <input
      className={controlClass}
      type={field.type === "currency" || field.type === "number" ? "number" : field.type}
      value={String(value ?? "")}
      onChange={(event) => onChange(field.name, event.target.value)}
    />
  );
}
export function picklistOptionsForField(field: FieldDefinition, values: RecordData) {
  if (field.dependsOn) {
    return stateOptionsForCountry(String(values[field.dependsOn] ?? ""));
  }
  return field.options ?? ["--None--"];
}
export function LookupField({
  field,
  value,
  data,
  options: suppliedOptions,
  disabled = false,
  error,
  inlineSelection = false,
  onChange,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy
}: {
  field: FieldDefinition;
  value: string;
  data: ScopedCrmData;
  options?: LookupOption[];
  disabled?: boolean;
  error?: boolean;
  inlineSelection?: boolean;
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
  const options = suppliedOptions ?? lookupOptionsForField(field, data);
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
    <div className={cn(!inlineSelection && "space-y-1")}>
      {!inlineSelection && selected && (
        <div className="inline-flex items-center gap-1 rounded-full border border-[#c9c9c9] bg-[#f8f8f8] px-2 py-1 text-xs">
          {selected.label}
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              onChange("");
              closeLookup();
            }}
          >
            <X size={12} />
          </button>
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
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#706e6b]"
            />
            <input
              id={inputId}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={
                open && filteredOptions[highlightedIndex] ? `${listId}-${highlightedIndex}` : undefined
              }
              aria-autocomplete="list"
              aria-invalid={invalid || undefined}
              aria-describedby={ariaDescribedBy}
              aria-label={field.label}
              disabled={disabled}
              value={inlineSelection && selected && !open ? selected.label : query}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpen(true);
                  setHighlightedIndex((current) =>
                    filteredOptions.length ? Math.min(filteredOptions.length - 1, current + 1) : 0
                  );
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlightedIndex((current) => Math.max(0, current - 1));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const option = filteredOptions[highlightedIndex] ?? filteredOptions[0];
                  if (option) choose(option.id);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeLookup();
                }
                if (event.key === "Backspace" && !query && value) onChange("");
              }}
              className={cn(
                inputClass,
                "pl-8",
                inlineSelection && selected && !open && "pr-9",
                invalid && inputErrorClass
              )}
              placeholder={placeholder}
            />
            {inlineSelection && selected && !open && !disabled && (
              <button
                type="button"
                aria-label={`Clear ${field.label}`}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#181818] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange("");
                  closeLookup();
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-[110] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded border border-[#d8dde6] bg-white shadow-popover"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onFocusOutside={(event) => event.preventDefault()}
          >
            <div
              id={listId}
              role="listbox"
              aria-label={`${field.label} lookup results`}
              className="slds-scrollbar max-h-60 overflow-auto p-1"
            >
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
                      className={cn(
                        "relative flex w-full items-center rounded py-2 pl-8 pr-3 text-left text-sm outline-none hover:bg-brand-50",
                        active && "bg-brand-50",
                        optionSelected && "font-semibold"
                      )}
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
export function AttendeePicker({
  field,
  value,
  data,
  onChange
}: {
  field: FieldDefinition;
  value: string[];
  data: ScopedCrmData;
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const generatedId = useId();
  const listId = `${generatedId}-attendee-results`;
  const options = lookupOptionsForField(field, data);
  const selected = value.map((id) => options.find((option) => option.id === id)).filter(Boolean) as LookupOption[];
  const availableOptions = options.filter((option) => !value.includes(option.id));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? availableOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : availableOptions;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, value.length]);

  function closePicker() {
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  }

  function addAttendee(optionId: string) {
    if (!value.includes(optionId)) onChange([...value, optionId]);
    closePicker();
  }

  function removeAttendee(optionId: string) {
    const next = value.filter((id) => id !== optionId);
    onChange(next.length ? next : [data.user.id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-8 flex-wrap gap-1 rounded border border-[#c9c9c9] bg-white p-1.5">
        {selected.map((option) => (
          <span
            key={option.id}
            className="inline-flex items-center gap-1 rounded-full border border-[#c9c9c9] bg-[#f8f8f8] px-2 py-1 text-xs"
          >
            {option.label}
            <button type="button" aria-label={`Remove ${option.label}`} onClick={() => removeAttendee(option.id)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) closePicker();
        }}
      >
        <Popover.Anchor asChild>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#706e6b]"
            />
            <input
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={
                open && filteredOptions[highlightedIndex] ? `${listId}-${highlightedIndex}` : undefined
              }
              aria-autocomplete="list"
              aria-label="Search People"
              value={query}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpen(true);
                  setHighlightedIndex((current) =>
                    filteredOptions.length ? Math.min(filteredOptions.length - 1, current + 1) : 0
                  );
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlightedIndex((current) => Math.max(0, current - 1));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const option = filteredOptions[highlightedIndex] ?? filteredOptions[0];
                  if (option) addAttendee(option.id);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closePicker();
                }
              }}
              className={cn(inputClass, "pl-8")}
              placeholder={availableOptions.length ? "Search People..." : "All people selected"}
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
            onFocusOutside={(event) => event.preventDefault()}
          >
            <div
              id={listId}
              role="listbox"
              aria-label="People lookup results"
              className="slds-scrollbar max-h-60 overflow-auto p-1"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#706e6b]">
                  {availableOptions.length ? "No matches" : "All available people are already selected"}
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const active = index === highlightedIndex;
                  return (
                    <button
                      key={option.id}
                      id={`${listId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-center rounded px-3 py-2 text-left text-sm outline-none hover:bg-brand-50",
                        active && "bg-brand-50"
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addAttendee(option.id)}
                    >
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
export function lookupOptionsForField(field: FieldDefinition, data: ScopedCrmData): LookupOption[] {
  if (field.lookupObject === "Account")
    return data.accounts.map((account) => ({ id: requiredId(account), label: String(account.name ?? "Account") }));
  if (field.lookupObject === "Contact")
    return data.contacts.map((contact) => ({ id: requiredId(contact), label: contactName(contact) }));
  if (field.lookupObject === "Lead")
    return data.leads.map((lead) => ({
      id: requiredId(lead),
      label: contactName(lead) || String(lead.company ?? "Lead")
    }));
  if (field.lookupObject === "Opportunity")
    return data.opportunities.map((opportunity) => ({
      id: requiredId(opportunity),
      label: String(opportunity.name ?? "Opportunity")
    }));
  if (field.lookupObject === "Case")
    return data.cases.map((caseRecord) => ({
      id: requiredId(caseRecord),
      label: String(caseRecord.caseNumber ?? caseRecord.subject ?? "Case")
    }));
  if (field.lookupObject === "Product2")
    return data.products.map((product) => ({ id: requiredId(product), label: String(product.name ?? "Product") }));
  if (field.lookupObject === "Pricebook2")
    return data.priceBooks.map((book) => ({ id: requiredId(book), label: String(book.name ?? "Price Book") }));
  if (field.lookupObject === "ListEmail")
    return data.listEmails.map((email) => ({
      id: requiredId(email),
      label: String(email.subject ?? email.name ?? "List Email")
    }));
  if (field.lookupObject === "Invoice")
    return data.invoices.map((invoice) => ({
      id: requiredId(invoice),
      label: String(invoice.name ?? invoice.invoiceNumber ?? "Invoice")
    }));
  if (field.lookupObject === "Knowledge__kav")
    return data.knowledgeArticles.map((article) => ({
      id: requiredId(article),
      label: String(article.title ?? "Article")
    }));
  if (field.lookupObject === "Campaign")
    return data.campaigns.map((campaign) => ({
      id: requiredId(campaign),
      label: String(campaign.name ?? "Campaign")
    }));
  if (field.lookupObject === "User") return data.users.map((user) => ({ id: user.id, label: user.name }));
  if (field.lookupObject === "People") {
    return [
      { id: data.user.id, label: data.user.name },
      ...data.contacts.map((contact) => ({ id: requiredId(contact), label: `Contact: ${contactName(contact)}` })),
      ...data.leads.map((lead) => ({
        id: requiredId(lead),
        label: `Lead: ${contactName(lead) || String(lead.company ?? "Lead")}`
      }))
    ].filter((option) => option.id && option.label);
  }
  return [];
}
export function lookupPlaceholder(field: FieldDefinition) {
  if (field.lookupObject === "User" || field.lookupObject === "People") return "Search People...";
  return `Search ${OBJECT_DEFINITIONS[field.lookupObject as CrmObject]?.plural ?? "Records"}...`;
}
