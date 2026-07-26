"use client";

import { Building2, CheckCircle2, ChevronRight, Target, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ElementType } from "react";
import { contactName } from "@/lib/crm-data";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { requiredId } from "@/features/crm/record-model";
import { type ModalState } from "@/features/crm/shared-types";

export function LeadConversionSuccessModal({
  modal,
  onClose
}: {
  modal: Extract<ModalState, { type: "leadConversionSuccess" }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const account = modal.accounts[0];
  const contact = modal.contacts[0];
  const opportunity = modal.opportunities[0];
  const rows = [
    account
      ? {
          label: "Account",
          name: String(account.name ?? "Account"),
          href: `/lightning/r/Account/${requiredId(account)}/view`,
          icon: Building2
        }
      : null,
    contact
      ? {
          label: "Contact",
          name: contactName(contact) || "Contact",
          href: `/lightning/r/Contact/${requiredId(contact)}/view`,
          icon: User
        }
      : null,
    opportunity
      ? {
          label: "Opportunity",
          name: String(opportunity.name ?? "Opportunity"),
          href: `/lightning/r/Opportunity/${requiredId(opportunity)}/view`,
          icon: Target
        }
      : null
  ].filter(Boolean) as Array<{ label: string; name: string; href: string; icon: ElementType }>;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <BaseDialog
      open
      title="Your lead has been converted"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {account && (
            <Button variant="primary" onClick={() => go(`/lightning/r/Account/${requiredId(account)}/view`)}>
              Go to Account
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded border border-[#abe2b4] bg-[#eef8f0] px-3 py-2 text-sm text-[#2e844a]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>
            {modal.leads.length} lead{modal.leads.length === 1 ? "" : "s"} converted successfully.
            {opportunity ? "" : " No opportunity was created."}
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.href}
                type="button"
                className="flex w-full items-center gap-3 rounded border border-[#d8dde6] bg-white px-3 py-2.5 text-left hover:border-brand-300 hover:bg-[#f8fbff]"
                onClick={() => go(row.href)}
              >
                <Icon size={16} className="text-brand-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wide text-[#706e6b]">{row.label}</div>
                  <div className="truncate font-medium text-brand-700">{row.name}</div>
                </div>
                <ChevronRight size={16} className="text-[#706e6b]" />
              </button>
            );
          })}
        </div>
      </div>
    </BaseDialog>
  );
}
