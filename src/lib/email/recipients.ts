import "server-only";

import { prisma } from "@/lib/prisma";
import { EmailValidationError } from "@/lib/email/errors";
import { isValidEmail, normalizeEmailAddress } from "@/lib/email/service";
import type { EmailAddress } from "@/lib/email/types";

export type RecipientKind = "lead" | "contact" | "account";

export type RecipientRecordSet = {
  leads: Array<{ id: string; firstName?: string | null; lastName: string; email?: string | null }>;
  contacts: Array<{ id: string; firstName?: string | null; lastName: string; email?: string | null }>;
  accounts: Array<{ id: string; name: string; contacts: Array<{ id: string; firstName?: string | null; lastName: string; email?: string | null }> }>;
};

export type ResolvedListEmailRecipients = {
  addresses: EmailAddress[];
  skipped: Array<{ reference: string; label: string; reason: string }>;
};

export function recipientReference(kind: RecipientKind, id: string) {
  return `${kind}:${id}`;
}

export function parseRecipientReference(reference: string): { kind?: RecipientKind; id: string } {
  const match = /^(lead|contact|account):(.+)$/.exec(reference);
  return match ? { kind: match[1] as RecipientKind, id: match[2] } : { id: reference };
}

function personName(person: { firstName?: string | null; lastName: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

export function resolveRecipientRecords(references: string[], records: RecipientRecordSet): ResolvedListEmailRecipients {
  const addresses = new Map<string, EmailAddress>();
  const skipped: ResolvedListEmailRecipients["skipped"] = [];
  const unknown: string[] = [];

  function addPerson(reference: string, person: RecipientRecordSet["contacts"][number], label: string) {
    if (!isValidEmail(person.email)) {
      skipped.push({ reference, label, reason: "No valid email address" });
      return false;
    }
    const email = normalizeEmailAddress(person.email);
    if (!addresses.has(email)) addresses.set(email, { email, name: personName(person) });
    return true;
  }

  for (const reference of [...new Set(references.map(String))]) {
    const parsed = parseRecipientReference(reference);
    const leads = records.leads.filter((record) => record.id === parsed.id && (!parsed.kind || parsed.kind === "lead"));
    const contacts = records.contacts.filter((record) => record.id === parsed.id && (!parsed.kind || parsed.kind === "contact"));
    const accounts = records.accounts.filter((record) => record.id === parsed.id && (!parsed.kind || parsed.kind === "account"));
    if (!leads.length && !contacts.length && !accounts.length) {
      unknown.push(reference);
      continue;
    }
    leads.forEach((lead) => addPerson(reference, lead, `Lead: ${personName(lead)}`));
    contacts.forEach((contact) => addPerson(reference, contact, `Contact: ${personName(contact)}`));
    accounts.forEach((account) => {
      const validContacts = account.contacts.filter((contact) => isValidEmail(contact.email));
      validContacts.forEach((contact) => addPerson(reference, contact, `Contact: ${personName(contact)} (${account.name})`));
      if (!validContacts.length) skipped.push({ reference, label: `Account: ${account.name}`, reason: "No contacts with valid email addresses" });
    });
  }

  if (unknown.length) throw new EmailValidationError("One or more selected email recipients were not found in this organization.");
  if (!addresses.size) throw new EmailValidationError("None of the selected records has a deliverable email address.");
  return { addresses: [...addresses.values()], skipped };
}

export async function resolveListEmailRecipients(organizationId: string, references: string[]) {
  if (!references.length) throw new EmailValidationError("Select at least one email recipient.");
  const parsed = references.map((reference) => parseRecipientReference(String(reference)));
  const rawIds = parsed.filter((item) => !item.kind).map((item) => item.id);
  const leadIds = [...rawIds, ...parsed.filter((item) => item.kind === "lead").map((item) => item.id)];
  const contactIds = [...rawIds, ...parsed.filter((item) => item.kind === "contact").map((item) => item.id)];
  const accountIds = [...rawIds, ...parsed.filter((item) => item.kind === "account").map((item) => item.id)];
  const [leads, contacts, accounts] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId, id: { in: leadIds } }, select: { id: true, firstName: true, lastName: true, email: true } }),
    prisma.contact.findMany({ where: { organizationId, id: { in: contactIds } }, select: { id: true, firstName: true, lastName: true, email: true } }),
    prisma.account.findMany({
      where: { organizationId, id: { in: accountIds } },
      select: { id: true, name: true, contacts: { select: { id: true, firstName: true, lastName: true, email: true } } }
    })
  ]);
  return resolveRecipientRecords(references, { leads, contacts, accounts });
}
