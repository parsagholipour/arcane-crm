"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, CheckCircle2, Cloud, Settings, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { cn } from "@/lib/utils";

export type ToastState = {
  tone: "success" | "error" | "warning";
  message: string;
} | null;

export function BaseDialog({
  open,
  title,
  children,
  footer,
  onClose,
  wide = false
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="crm-overlay fixed inset-0 z-50 bg-shell/45 backdrop-blur-[3px]" />
        <Dialog.Content
          className={cn(
            "crm-dialog fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(96vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-modal",
            wide && "w-[min(96vw,920px)]"
          )}
        >
          <div className="flex items-center justify-between border-b border-[#e4e7ec] px-5 py-3.5">
            <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1.5 text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#181818] active:scale-90"
                aria-label="Cancel and close"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <div className="slds-scrollbar max-h-[calc(86vh-120px)] overflow-auto p-5">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-[#e4e7ec] bg-[#f8f9fb] px-5 py-3.5">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  className,
  disabled = false
}: {
  children: ReactNode;
  onClick?: () => void | Promise<unknown>;
  variant?: "primary" | "secondary" | "destructive";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <AsyncButton
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-8 items-center justify-center gap-1 rounded border px-3.5 py-1 text-xs font-semibold active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variant === "primary" &&
          "border-brand-700/60 bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(3,45,96,0.24)] hover:from-brand-600 hover:to-brand-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(3,45,96,0.3)]",
        variant === "secondary" &&
          "border-[#cfd4dc] bg-white text-brand-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb]",
        variant === "destructive" &&
          "border-[#8e030f] bg-gradient-to-b from-[#d40b1f] to-[#ba0517] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(142,3,15,0.28)] hover:from-[#ba0517] hover:to-[#8e030f]",
        className
      )}
    >
      {children}
    </AsyncButton>
  );
}

export function ToolbarButton({
  label,
  icon: Icon = Settings,
  onClick,
  disabled,
  disabledReason,
  onDisabled
}: {
  label: string;
  icon?: ElementType;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  onDisabled?: () => void;
}) {
  const reason = disabled ? disabledReason || `${label} is unavailable for this list.` : undefined;
  function handleClick() {
    if (disabled) {
      onDisabled?.();
      return;
    }
    onClick?.();
  }
  return (
    <button
      aria-label={label}
      title={reason || label}
      data-disabled={disabled ? "true" : undefined}
      onClick={handleClick}
      onFocus={() => disabled && onDisabled?.()}
      className="flex h-8 w-8 items-center justify-center rounded border border-[#cfd4dc] bg-white text-[#444] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb] hover:text-brand-700 active:scale-95 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-45 data-[disabled=true]:hover:border-[#cfd4dc] data-[disabled=true]:hover:bg-white data-[disabled=true]:hover:text-[#444]"
    >
      <Icon size={14} />
    </button>
  );
}

export function DashboardPanel({
  title,
  action,
  actionHref,
  onAction,
  children
}: {
  title: string;
  action?: string;
  actionHref?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]"
          >
            {action}
          </Link>
        )}
        {action && !actionHref && <Button onClick={onAction}>{action}</Button>}
      </div>
      {children}
    </section>
  );
}

export function EmptyPanel({
  title,
  body,
  action,
  onAction
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Cloud size={30} />
      </div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-[#706e6b]">{body}</p>
      {action && (
        <Button className="mt-4" variant="primary" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-48 items-center justify-center rounded border border-[#d8dde6] bg-white p-8 text-sm text-[#706e6b]"
      role="status"
    >
      <span
        className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

const toastToneStyles = {
  success: { icon: CheckCircle2, bar: "bg-[#2e844a]", iconColor: "text-[#2e844a]", label: "Success" },
  error: { icon: AlertCircle, bar: "bg-[#ba0517]", iconColor: "text-[#ba0517]", label: "Error" },
  warning: { icon: TriangleAlert, bar: "bg-[#a86403]", iconColor: "text-[#a86403]", label: "Warning" }
} as const;

export function ToastHost({ toast }: { toast: ToastState }) {
  const [rendered, setRendered] = useState<NonNullable<ToastState> | null>(toast);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (toast) {
      setRendered(toast);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setRendered(null);
      setLeaving(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!rendered) return null;
  const tone = toastToneStyles[rendered.tone];
  const ToneIcon = tone.icon;
  return (
    <div
      role="status"
      className={cn(
        "fixed right-4 top-36 z-[80] flex w-auto max-w-sm items-start gap-3 overflow-hidden rounded-lg border border-[#e4e7ec] bg-white py-3 pl-4 pr-5 text-sm shadow-modal",
        leaving ? "crm-toast-exit" : "crm-toast-enter"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} aria-hidden="true" />
      <ToneIcon size={18} className={cn("mt-0.5 shrink-0", tone.iconColor)} aria-hidden="true" />
      <div className="min-w-0">
        <div className="font-semibold text-[#181818]">{tone.label}</div>
        <div className="mt-0.5 text-[#514f4d]">{rendered.message}</div>
      </div>
    </div>
  );
}

export function NotFoundPanel({ title, body }: { title: string; body: string }) {
  return <EmptyPanel title={title} body={body} />;
}
