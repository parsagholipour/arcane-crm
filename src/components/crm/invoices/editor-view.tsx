"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { type FieldDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { LookupField } from "@/features/crm/form-controls";
import { useDialogEnterAction } from "@/components/ui/crm-primitives";
import {
  text,
  InvoiceButton,
  SectionTitle,
  InvoiceField,
  controlClass,
  FieldError,
  money,
  TotalRow
} from "@/components/crm/invoices/primitives";
import {
  currencies,
  linePreview,
  emptyLine,
  type InvoiceEditorModalModel
} from "@/components/crm/invoices/editor-controller";

const accountLookupField: FieldDefinition = {
  name: "accountId",
  label: "Account",
  section: "Invoice Information",
  type: "lookup",
  lookupObject: "Account"
};
const opportunityLookupField: FieldDefinition = {
  name: "opportunityId",
  label: "Opportunity",
  section: "Invoice Information",
  type: "lookup",
  lookupObject: "Opportunity"
};
const productLookupField: FieldDefinition = {
  name: "productId",
  label: "Product",
  section: "Line Items",
  type: "lookup",
  lookupObject: "Product2"
};

export function InvoiceEditorView({ model }: { model: InvoiceEditorModalModel }) {
  const {
    mode,
    data,
    invoice,
    onClose,
    header,
    lines,
    setLines,
    errors,
    saving,
    confirmDiscard,
    setConfirmDiscard,
    opportunities,
    preview,
    requestClose,
    updateHeader,
    selectAccount,
    updateLine,
    selectProduct,
    moveLine,
    save
  } = model;
  const handleEnterAction = useDialogEnterAction(save);
  const selectedProductIds = new Set(lines.map((line) => line.productId).filter(Boolean));
  const activeProducts = data.products.filter(
    (product) => product.active !== false || selectedProductIds.has(String(product.id))
  );
  const currencyOptions = [...new Set([header.currency, ...currencies])].filter(Boolean);
  const invoiceAccount = invoice?.account as RecordData | undefined;
  const invoiceOpportunity = invoice?.opportunity as RecordData | undefined;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[#080707]/55 backdrop-blur-[1px]" />
        <Dialog.Content
          onKeyDown={handleEnterAction}
          className="fixed left-1/2 top-1/2 z-[91] flex max-h-[94vh] w-[min(98vw,1180px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-modal"
        >
          {confirmDiscard ? (
            <div className="p-6">
              <Dialog.Title className="text-xl font-semibold">Discard changes?</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-[#444]">
                You have unsaved invoice changes. Discard them and close?
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-2">
                <InvoiceButton onClick={() => setConfirmDiscard(false)}>Keep Editing</InvoiceButton>
                <InvoiceButton tone="danger" onClick={onClose}>
                  Discard
                </InvoiceButton>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[#d8dde6] px-5 py-4">
                <div>
                  <Dialog.Title className="text-xl font-semibold">
                    {mode === "new" ? "New Invoice" : `Edit ${text(invoice?.invoiceNumber)}`}
                  </Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-sm text-[#706e6b]">
                    Create and manage customer sales invoices.
                  </Dialog.Description>
                </div>
                <button
                  aria-label="Close invoice editor"
                  onClick={requestClose}
                  className="rounded p-2 text-[#706e6b] hover:bg-[#f3f3f3]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="slds-scrollbar flex-1 overflow-auto p-5">
                <section>
                  <SectionTitle>Invoice information</SectionTitle>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <InvoiceField label="Account" required error={errors.accountId}>
                      <LookupField
                        field={accountLookupField}
                        value={header.accountId}
                        selectedLabel={text(invoiceAccount?.name) || undefined}
                        data={data}
                        error={Boolean(errors.accountId)}
                        inlineSelection
                        onChange={selectAccount}
                      />
                    </InvoiceField>
                    <InvoiceField label="Opportunity">
                      <LookupField
                        field={opportunityLookupField}
                        value={header.opportunityId}
                        selectedLabel={text(invoiceOpportunity?.name) || undefined}
                        data={{ ...data, opportunities }}
                        inlineSelection
                        onChange={(opportunityId) => updateHeader("opportunityId", opportunityId)}
                      />
                    </InvoiceField>
                    <InvoiceField label="Issue Date" required error={errors.issueDate}>
                      <input
                        aria-label="Issue Date"
                        type="date"
                        className={controlClass}
                        value={header.issueDate}
                        onChange={(event) => updateHeader("issueDate", event.target.value)}
                      />
                    </InvoiceField>
                    <InvoiceField label="Due Date" required error={errors.dueDate}>
                      <input
                        aria-label="Due Date"
                        type="date"
                        className={controlClass}
                        value={header.dueDate}
                        onChange={(event) => updateHeader("dueDate", event.target.value)}
                      />
                    </InvoiceField>
                    <InvoiceField label="Currency">
                      <select
                        aria-label="Currency"
                        className={controlClass}
                        value={header.currency}
                        onChange={(event) => updateHeader("currency", event.target.value)}
                      >
                        {currencyOptions.map((currency) => (
                          <option key={currency}>{currency}</option>
                        ))}
                      </select>
                    </InvoiceField>
                    <InvoiceField label="Purchase Order Number">
                      <input
                        aria-label="Purchase Order Number"
                        className={controlClass}
                        value={header.purchaseOrderNumber}
                        onChange={(event) => updateHeader("purchaseOrderNumber", event.target.value)}
                      />
                    </InvoiceField>
                    <InvoiceField label="Billing Name">
                      <input
                        aria-label="Billing Name"
                        className={controlClass}
                        value={header.billingName}
                        onChange={(event) => updateHeader("billingName", event.target.value)}
                      />
                    </InvoiceField>
                    <InvoiceField label="Billing Country">
                      <input
                        aria-label="Billing Country"
                        className={controlClass}
                        value={header.billingCountry}
                        onChange={(event) => updateHeader("billingCountry", event.target.value)}
                      />
                    </InvoiceField>
                    <div className="md:col-span-2">
                      <InvoiceField label="Billing Street">
                        <input
                          aria-label="Billing Street"
                          className={controlClass}
                          value={header.billingStreet}
                          onChange={(event) => updateHeader("billingStreet", event.target.value)}
                        />
                      </InvoiceField>
                    </div>
                    <InvoiceField label="Billing City">
                      <input
                        aria-label="Billing City"
                        className={controlClass}
                        value={header.billingCity}
                        onChange={(event) => updateHeader("billingCity", event.target.value)}
                      />
                    </InvoiceField>
                    <InvoiceField label="Billing State / Province">
                      <input
                        aria-label="Billing State / Province"
                        className={controlClass}
                        value={header.billingState}
                        onChange={(event) => updateHeader("billingState", event.target.value)}
                      />
                    </InvoiceField>
                    <InvoiceField label="Billing Postal Code">
                      <input
                        aria-label="Billing Postal Code"
                        className={controlClass}
                        value={header.billingPostalCode}
                        onChange={(event) => updateHeader("billingPostalCode", event.target.value)}
                      />
                    </InvoiceField>
                  </div>
                </section>

                <section className="mt-7">
                  <div className="mb-3 flex items-center justify-between">
                    <SectionTitle>Line items</SectionTitle>
                    <InvoiceButton onClick={() => setLines((current) => [...current, emptyLine(current.length)])}>
                      <Plus size={14} /> Add Line Item
                    </InvoiceButton>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[#d8dde6]">
                    <table className="w-full min-w-[1040px] text-sm">
                      <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
                        <tr>
                          <th className="px-2 py-2 text-left">Order</th>
                          <th className="px-2 py-2 text-left">Product</th>
                          <th className="px-2 py-2 text-left">Description</th>
                          <th className="px-2 py-2 text-left">Quantity</th>
                          <th className="px-2 py-2 text-left">Unit Price</th>
                          <th className="px-2 py-2 text-left">Discount</th>
                          <th className="px-2 py-2 text-left">Tax %</th>
                          <th className="px-2 py-2 text-right">Line Total</th>
                          <th className="px-2 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, index) => (
                          <tr key={line.key} className="border-t border-[#e5e5e5] align-top">
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                <button
                                  aria-label={`Move line ${index + 1} up`}
                                  disabled={index === 0}
                                  onClick={() => moveLine(index, -1)}
                                  className="rounded p-1 hover:bg-[#f3f3f3] disabled:opacity-30"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  aria-label={`Move line ${index + 1} down`}
                                  disabled={index === lines.length - 1}
                                  onClick={() => moveLine(index, 1)}
                                  className="rounded p-1 hover:bg-[#f3f3f3] disabled:opacity-30"
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="w-44 px-2 py-2">
                              <LookupField
                                field={{ ...productLookupField, label: `Line ${index + 1} Product` }}
                                value={line.productId}
                                selectedLabel={line.productLabel || undefined}
                                data={{ ...data, products: activeProducts }}
                                inlineSelection
                                onChange={(productId) => selectProduct(line, productId)}
                              />
                            </td>
                            <td className="min-w-64 px-2 py-2">
                              <textarea
                                aria-label={`Line ${index + 1} Description`}
                                className={cn(controlClass, "min-h-16 resize-y")}
                                value={line.description}
                                onChange={(event) => updateLine(line.key, "description", event.target.value)}
                              />
                              {errors[`${line.key}.description`] && (
                                <FieldError>{errors[`${line.key}.description`]}</FieldError>
                              )}
                            </td>
                            <td className="w-24 px-2 py-2">
                              <input
                                aria-label={`Line ${index + 1} Quantity`}
                                type="number"
                                min="0.0001"
                                step="0.0001"
                                className={controlClass}
                                value={line.quantity}
                                onChange={(event) => updateLine(line.key, "quantity", event.target.value)}
                              />
                              {errors[`${line.key}.quantity`] && (
                                <FieldError>{errors[`${line.key}.quantity`]}</FieldError>
                              )}
                            </td>
                            <td className="w-28 px-2 py-2">
                              <input
                                aria-label={`Line ${index + 1} Unit Price`}
                                type="number"
                                min="0"
                                step="0.01"
                                className={controlClass}
                                value={line.unitPrice}
                                onChange={(event) => updateLine(line.key, "unitPrice", event.target.value)}
                              />
                              {errors[`${line.key}.unitPrice`] && (
                                <FieldError>{errors[`${line.key}.unitPrice`]}</FieldError>
                              )}
                            </td>
                            <td className="w-28 px-2 py-2">
                              <input
                                aria-label={`Line ${index + 1} Discount`}
                                type="number"
                                min="0"
                                step="0.01"
                                className={controlClass}
                                value={line.discountAmount}
                                onChange={(event) => updateLine(line.key, "discountAmount", event.target.value)}
                              />
                              {errors[`${line.key}.discountAmount`] && (
                                <FieldError>{errors[`${line.key}.discountAmount`]}</FieldError>
                              )}
                            </td>
                            <td className="w-24 px-2 py-2">
                              <input
                                aria-label={`Line ${index + 1} Tax Rate`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className={controlClass}
                                value={line.taxRate}
                                onChange={(event) => updateLine(line.key, "taxRate", event.target.value)}
                              />
                              {errors[`${line.key}.taxRate`] && (
                                <FieldError>{errors[`${line.key}.taxRate`]}</FieldError>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-4 text-right font-semibold">
                              {money(linePreview(line).total, header.currency)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              <button
                                aria-label={`Remove line ${index + 1}`}
                                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                                className="rounded p-2 text-[#ba0517] hover:bg-[#fff1f1]"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {lines.length === 0 && (
                      <div className="p-6 text-center text-sm text-[#706e6b]">
                        Drafts can be saved without line items. Add at least one valid line item before marking the
                        invoice as Sent.
                      </div>
                    )}
                  </div>
                  <div className="ml-auto mt-4 w-full max-w-sm space-y-2 rounded-lg bg-[#f8fafc] p-4 text-sm">
                    <TotalRow label="Subtotal" value={money(preview.subtotal, header.currency)} />
                    <TotalRow label="Discounts" value={`-${money(preview.discount, header.currency)}`} />
                    <TotalRow label="Tax" value={money(preview.tax, header.currency)} />
                    <TotalRow label="Preview Total" value={money(preview.total, header.currency)} strong />
                    <p className="pt-1 text-xs text-[#706e6b]">
                      Preview only. The server recalculates all financial totals.
                    </p>
                  </div>
                </section>

                <section className="mt-7 grid gap-4 md:grid-cols-2">
                  <InvoiceField label="Notes">
                    <textarea
                      aria-label="Notes"
                      className={cn(controlClass, "min-h-24")}
                      value={header.notes}
                      onChange={(event) => updateHeader("notes", event.target.value)}
                    />
                  </InvoiceField>
                  <InvoiceField label="Payment Terms">
                    <textarea
                      aria-label="Payment Terms"
                      className={cn(controlClass, "min-h-24")}
                      value={header.terms}
                      onChange={(event) => updateHeader("terms", event.target.value)}
                    />
                  </InvoiceField>
                </section>
              </div>
              <div className="flex items-center justify-between border-t border-[#d8dde6] bg-[#f8f8f8] px-5 py-3">
                <span className="text-xs text-[#706e6b]">
                  Saving creates or updates a Draft. It does not email the customer.
                </span>
                <div className="flex gap-2">
                  <InvoiceButton onClick={requestClose}>Cancel</InvoiceButton>
                  <InvoiceButton tone="primary" disabled={saving} onClick={() => save()}>
                    {saving ? "Saving..." : "Save Draft"}
                  </InvoiceButton>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
