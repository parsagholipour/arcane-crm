"use client";

import { Button } from "@/components/ui/crm-primitives";
import { inputClass } from "@/features/crm/controls";
import { agentforceMetadata } from "@/features/crm/utilities-model";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";
import { type HeaderUtilityContentProps } from "@/features/crm/header-utility-content";

export function AssistantUtilityContent({ model, utilityProps }: HeaderUtilityContentProps) {
  const {
    assistantInput,
    setAssistantInput,
    assistantLoading,
    assistantError,
    assistantScrollRef,
    assistantMessages,
    sendAssistantMessage,
    clearAssistantMessages,
    copyAssistantDraft
  } = model;
  const { onNavigate, onOpenDraft } = utilityProps;

  return (
    <div className="p-3">
      <div
        ref={assistantScrollRef}
        className="max-h-80 space-y-2 overflow-auto rounded border border-[#d8dde6] bg-[#f8f8f8] p-2"
        aria-live="polite"
        aria-busy={assistantLoading}
      >
        {assistantMessages.map((message, index) => {
          const metadata = agentforceMetadata(message);
          return (
            <div
              key={String(message.id ?? index)}
              className={cn(
                "rounded px-2 py-1 text-sm",
                message.role === "assistant" ? "bg-white" : "ml-8 bg-brand-50 text-brand-900"
              )}
            >
              <div className="text-[11px] font-semibold uppercase text-[#706e6b]">
                {message.role === "assistant" ? BRAND.assistant : "You"}
              </div>
              <div className="whitespace-pre-wrap">{String(message.text ?? "")}</div>
              {message.role === "assistant" && metadata.facts && metadata.facts.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {metadata.facts.map((fact) => (
                    <div
                      key={`${fact.label}-${fact.value}`}
                      className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-1.5"
                    >
                      <div className="text-[10px] uppercase text-[#706e6b]">{fact.label}</div>
                      <div className="font-semibold">{fact.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {message.role === "assistant" && metadata.draft && (
                <div className="mt-2 rounded border border-[#d8dde6] bg-[#f8f8f8] p-2">
                  <div className="text-[10px] font-semibold uppercase text-[#706e6b]">Draft Email</div>
                  {metadata.draft.to && <div className="mt-1 text-xs text-[#706e6b]">To: {metadata.draft.to}</div>}
                  <div className="mt-1 font-semibold">{metadata.draft.subject ?? "Follow up"}</div>
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-[#444]">
                    {metadata.draft.body ?? ""}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button onClick={() => void copyAssistantDraft(metadata.draft!)}>Copy</Button>
                    <Button
                      variant="primary"
                      disabled={!metadata.draft.subject || !metadata.draft.body}
                      onClick={() => {
                        if (!metadata.draft?.subject || !metadata.draft.body) return;
                        onOpenDraft({
                          subject: metadata.draft.subject,
                          body: metadata.draft.body,
                          to: metadata.draft.to,
                          recipientIds: metadata.draft.recipientIds ?? []
                        });
                      }}
                    >
                      Edit in Composer
                    </Button>
                  </div>
                </div>
              )}
              {message.role === "assistant" && metadata.actions && metadata.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {metadata.actions.map((action) => (
                    <button
                      key={`${action.label}-${action.href}`}
                      className="rounded border border-[#c9c9c9] bg-white px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                      onClick={() => onNavigate(action.href)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {assistantLoading && (
          <div className="flex items-center gap-2 rounded bg-white px-2 py-2 text-sm text-[#706e6b]">
            <RefreshCw size={14} className="animate-spin" /> {BRAND.assistant} is analyzing your workspace…
          </div>
        )}
      </div>
      {assistantError && (
        <div
          className="mt-2 flex items-start gap-1 rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-xs text-[#8e030f]"
          role="alert"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {assistantError}
        </div>
      )}
      <div className="mt-2 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <textarea
            className={cn(inputClass, "min-h-16 resize-y")}
            value={assistantInput}
            maxLength={2000}
            onChange={(event) => setAssistantInput(event.target.value)}
            placeholder="Ask about this CRM..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendAssistantMessage();
              }
            }}
          />
          <div className="text-right text-[10px] text-[#706e6b]">{assistantInput.length}/2000</div>
        </div>
        <Button
          variant="primary"
          disabled={assistantLoading || !assistantInput.trim()}
          onClick={() => void sendAssistantMessage()}
        >
          Send
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button disabled={assistantLoading} onClick={() => setAssistantInput("Summarize my open pipeline")}>
          Summarize pipeline
        </Button>
        <Button disabled={assistantLoading} onClick={() => setAssistantInput("Draft a follow-up email for Robert")}>
          Draft follow-up
        </Button>
        <Button disabled={assistantLoading} onClick={() => setAssistantInput("What support cases need attention?")}>
          Support cases
        </Button>
        <Button disabled={assistantLoading} onClick={() => void clearAssistantMessages()}>
          Clear chat
        </Button>
      </div>
    </div>
  );
}
