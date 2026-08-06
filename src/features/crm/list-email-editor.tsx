"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { LIST_EMAIL_LAYOUTS, TIME_SLOTS } from "@/lib/crm-metadata";
import { contactName } from "@/lib/crm-data";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button, EmptyPanel } from "@/components/ui/crm-primitives";
import { checkboxClass, FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { recordDataShallowEqual, validateRequired } from "@/features/crm/form-model";
import { validEmailValue } from "@/features/crm/knowledge-editor";
import { useUnsavedChangesGuard } from "@/features/crm/record-editors";

export function ListEmailWizard({
  data,
  initialValues: providedInitialValues,
  startingStep = 1,
  initialLayout = "Sales",
  onClose,
  onSave
}: {
  data: ScopedCrmData;
  initialValues?: RecordData;
  startingStep?: 1 | 2;
  initialLayout?: string;
  onClose: () => void;
  onSave: (values: RecordData) => Promise<boolean>;
}) {
  function scheduleFields(value: unknown) {
    if (!value) return {};
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return {};
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
    return { scheduleDate: local.slice(0, 10), scheduleTime: local.slice(11, 16) };
  }

  function normalizeRecipientReference(value: unknown) {
    const reference = String(value);
    if (/^(lead|contact|account):/.test(reference)) return reference;
    if (data.leads.some((record) => String(record.id) === reference)) return `lead:${reference}`;
    if (data.contacts.some((record) => String(record.id) === reference)) return `contact:${reference}`;
    if (data.accounts.some((record) => String(record.id) === reference)) return `account:${reference}`;
    return reference;
  }

  function recipientTypeAllows(reference: string, recipientType: string) {
    if (recipientType === "Leads") return reference.startsWith("lead:");
    if (recipientType === "Contacts") return reference.startsWith("contact:");
    if (recipientType === "Accounts") return reference.startsWith("account:");
    if (recipientType === "Leads and Contacts")
      return reference.startsWith("lead:") || reference.startsWith("contact:");
    return true;
  }

  const initialLayoutValue = String(providedInitialValues?.layoutType || initialLayout);
  const [step, setStep] = useState<1 | 2>(startingStep);
  const [layout, setLayout] = useState(initialLayoutValue);
  const [layoutQuery, setLayoutQuery] = useState("");
  const [savedQuery, setSavedQuery] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [initialValues] = useState<RecordData>(() => ({
    recipientType: "Leads and Contacts",
    status: "Draft",
    scheduleTime: "09:00",
    ...scheduleFields(providedInitialValues?.scheduledAt),
    ...providedInitialValues,
    recipients: Array.isArray(providedInitialValues?.recipients)
      ? providedInitialValues.recipients.map(normalizeRecipientReference)
      : []
  }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const recipientType = String(values.recipientType ?? "Leads and Contacts");
  const selectedRecipients = Array.isArray(values.recipients) ? values.recipients.map(String) : [];
  const loadedRecipientOptions = [
    ...data.leads.map((lead) => ({
      id: `lead:${String(lead.id)}`,
      label: `Lead: ${contactName(lead) || lead.company || lead.id}`,
      disabled: !validEmailValue(lead.email),
      detail: validEmailValue(lead.email) ? String(lead.email) : "No email address"
    })),
    ...data.contacts.map((contact) => ({
      id: `contact:${String(contact.id)}`,
      label: `Contact: ${contactName(contact)}`,
      disabled: !validEmailValue(contact.email),
      detail: validEmailValue(contact.email) ? String(contact.email) : "No email address"
    })),
    ...data.accounts.map((account) => {
      const emailedContacts = data.contacts.filter(
        (contact) => contact.accountId === account.id && validEmailValue(contact.email)
      );
      return {
        id: `account:${String(account.id)}`,
        label: `Account: ${account.name ?? account.id}`,
        disabled: emailedContacts.length === 0,
        detail: emailedContacts.length
          ? `${emailedContacts.length} emailed contact${emailedContacts.length === 1 ? "" : "s"}`
          : "No contacts with email"
      };
    })
  ];
  const loadedRecipientIds = new Set(loadedRecipientOptions.map((recipient) => recipient.id));
  const missingRecipientOptions = selectedRecipients
    .filter((reference) => !loadedRecipientIds.has(reference))
    .map((reference) => ({
      id: reference,
      label: `Saved recipient: ${reference}`,
      disabled: false,
      detail: "Outside the currently loaded record set"
    }));
  const recipientOptions = [...loadedRecipientOptions, ...missingRecipientOptions];
  const availableRecipients = recipientOptions.filter(
    (recipient) => selectedRecipients.includes(recipient.id) || recipientTypeAllows(recipient.id, recipientType)
  );
  const layoutOptions = LIST_EMAIL_LAYOUTS.some((item) => item.name === layout)
    ? LIST_EMAIL_LAYOUTS
    : [{ name: layout, description: "Saved custom layout." }, ...LIST_EMAIL_LAYOUTS];
  const visibleLayouts = layoutOptions.filter((item) =>
    `${item.name} ${item.description}`.toLowerCase().includes(layoutQuery.toLowerCase())
  );
  const visibleSavedEmails = data.listEmails.filter((email) =>
    `${email.subject ?? ""} ${email.layoutType ?? ""}`.toLowerCase().includes(savedQuery.toLowerCase())
  );
  const selectedLayout = layoutOptions.find((item) => item.name === layout) ?? LIST_EMAIL_LAYOUTS[0];
  const previewSubject = String(values.subject ?? defaultListEmailSubject(layout));
  const previewBody = String(values.body ?? defaultListEmailBody(layout));
  const isDirty = layout !== initialLayoutValue || !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  function toggleRecipient(id: string) {
    const nextRecipients = selectedRecipients.includes(id)
      ? selectedRecipients.filter((item) => item !== id)
      : [...selectedRecipients, id];
    setValues({ ...values, recipients: nextRecipients });
  }

  function continueToCompose() {
    setStep(2);
    setPreviewOpen(false);
    setValues((current) => ({
      ...current,
      subject: current.subject ?? defaultListEmailSubject(layout),
      body: current.body ?? defaultListEmailBody(layout),
      recipients:
        Array.isArray(current.recipients) && current.recipients.length
          ? current.recipients
          : availableRecipients
              .filter((item) => !item.disabled)
              .slice(0, 2)
              .map((item) => item.id)
    }));
  }

  function loadSavedEmail(email: RecordData) {
    setLayout(String(email.layoutType ?? layout));
    setValues({
      recipientType: email.recipientType ?? "Leads and Contacts",
      status: "Draft",
      recipients: Array.isArray(email.recipients) ? email.recipients.map(normalizeRecipientReference) : [],
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
      onEnterAction={step === 1 ? continueToCompose : () => submit("Draft")}
      wide
      footer={
        step === 1 ? (
          <>
            <Button onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
            <Button variant="primary" onClick={continueToCompose}>
              Select & Continue
            </Button>
            <Button onClick={requestClose}>Cancel and close</Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
            <Button onClick={() => submit("Draft")}>Save Draft</Button>
            <Button onClick={() => submit("Scheduled")}>Schedule</Button>
            <Button variant="primary" onClick={() => submit("Sent")}>
              Send
            </Button>
            <Button onClick={requestClose}>Cancel</Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <Tabs.Root defaultValue="layout">
          <Tabs.List className="mb-3 flex border-b border-[#d8dde6]">
            <Tabs.Trigger
              value="layout"
              className="border-b-2 border-transparent px-4 py-2 data-[state=active]:border-brand-500 data-[state=active]:font-semibold"
            >
              Layout Options
            </Tabs.Trigger>
            <Tabs.Trigger
              value="saved"
              className="border-b-2 border-transparent px-4 py-2 data-[state=active]:border-brand-500 data-[state=active]:font-semibold"
            >
              Saved Emails
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="layout">
            <input
              className={cn(inputClass, "mb-3")}
              placeholder="Search..."
              value={layoutQuery}
              onChange={(event) => setLayoutQuery(event.target.value)}
            />
            <div className="grid gap-2 md:grid-cols-2">
              {visibleLayouts.map((item) => (
                <label
                  key={item.name}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded border border-[#d8dde6] p-3",
                    layout === item.name && "border-brand-500 bg-brand-50"
                  )}
                >
                  <input type="radio" checked={layout === item.name} onChange={() => setLayout(item.name)} />
                  <span>
                    <span className="block font-semibold">{item.name}</span>
                    <span className="text-sm text-[#706e6b]">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {!visibleLayouts.length && <EmptyPanel title="No layouts found" body="Try a different search." />}
          </Tabs.Content>
          <Tabs.Content value="saved">
            <input
              className={cn(inputClass, "mb-3")}
              placeholder="Search..."
              value={savedQuery}
              onChange={(event) => setSavedQuery(event.target.value)}
            />
            {visibleSavedEmails.length ? (
              <div className="space-y-2">
                {visibleSavedEmails.map((email) => (
                  <button
                    key={String(email.id)}
                    className="w-full rounded border border-[#d8dde6] p-3 text-left hover:border-brand-500 hover:bg-brand-50"
                    onClick={() => loadSavedEmail(email)}
                  >
                    <span className="block font-semibold">{String(email.subject ?? "Untitled email")}</span>
                    <span className="text-sm text-[#706e6b]">
                      {String(email.layoutType ?? "Saved")} - {String(email.status ?? "Draft")}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No saved emails" body="Saved email drafts appear here." />
            )}
          </Tabs.Content>
          {previewOpen && (
            <ListEmailPreview
              title={`${selectedLayout.name} Layout`}
              subject={previewSubject}
              body={previewBody}
              recipients={[selectedLayout.description]}
            />
          )}
        </Tabs.Root>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldShell label="Recipient Type">
              <NativeSelect
                options={["Leads and Contacts", "Leads", "Contacts", "Accounts", "Custom"]}
                value={recipientType}
                onChange={(value) =>
                  setValues({
                    ...values,
                    recipientType: value,
                    recipients: selectedRecipients.filter((reference) => recipientTypeAllows(reference, value))
                  })
                }
              />
            </FieldShell>
            <FieldShell label="Schedule">
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Schedule Date"
                  className={inputClass}
                  type="date"
                  value={String(values.scheduleDate ?? "")}
                  onChange={(event) => setValues({ ...values, scheduleDate: event.target.value })}
                />
                <NativeSelect
                  aria-label="Schedule Time"
                  options={TIME_SLOTS}
                  value={String(values.scheduleTime ?? "09:00")}
                  onChange={(value) => setValues({ ...values, scheduleTime: value })}
                />
              </div>
            </FieldShell>
          </div>
          <FieldShell label="Recipients" required error={errors.recipients}>
            <div className="grid max-h-36 gap-2 overflow-auto rounded-lg border border-[#e4e7ec] bg-white p-2 shadow-card md:grid-cols-2">
              {availableRecipients.map((recipient) => (
                <label
                  key={recipient.id}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-brand-50",
                    recipient.disabled && "cursor-not-allowed opacity-55"
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={recipient.disabled}
                    checked={selectedRecipients.includes(recipient.id)}
                    onChange={() => toggleRecipient(recipient.id)}
                    className={checkboxClass}
                  />
                  <span>
                    <span className="block">{recipient.label}</span>
                    <span className="block text-[11px] text-[#706e6b]">{recipient.detail}</span>
                  </span>
                </label>
              ))}
              {!availableRecipients.length && (
                <div className="col-span-full p-3 text-center text-sm text-[#706e6b]">
                  No records are available for this recipient type.
                </div>
              )}
            </div>
          </FieldShell>
          <FieldShell label="Subject" required error={errors.subject}>
            <input
              className={inputClass}
              value={String(values.subject ?? "")}
              onChange={(event) => setValues({ ...values, subject: event.target.value })}
            />
          </FieldShell>
          <FieldShell label="Body" required error={errors.body}>
            <textarea
              className={cn(inputClass, "h-44")}
              value={String(values.body ?? "")}
              onChange={(event) => setValues({ ...values, body: event.target.value })}
            />
          </FieldShell>
          {errors.scheduledAt && <p className="text-xs text-[#ba0517]">{errors.scheduledAt}</p>}
          {previewOpen && (
            <ListEmailPreview
              title={`${layout} Email Preview`}
              subject={previewSubject}
              body={previewBody}
              recipients={availableRecipients
                .filter((recipient) => selectedRecipients.includes(recipient.id))
                .map((recipient) => recipient.label)}
            />
          )}
        </div>
      )}
    </BaseDialog>
  );
}
export function ListEmailPreview({
  title,
  subject,
  body,
  recipients
}: {
  title: string;
  subject: string;
  body: string;
  recipients: string[];
}) {
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
export function defaultListEmailSubject(layout: string) {
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
export function defaultListEmailBody(layout: string) {
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
