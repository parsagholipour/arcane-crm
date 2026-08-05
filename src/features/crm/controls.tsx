"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  BadgeDollarSign,
  BookOpen,
  Box,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  GripVertical,
  Library,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Receipt,
  Search,
  Settings,
  Target,
  User,
  Video
} from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode
} from "react";
import { type CrmObject, type ObjectDefinition } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/crm-primitives";
import { listViewSharingOptions } from "@/features/crm/list-model";

export const iconMap: Record<string, ElementType> = {
  user: User,
  building: Building2,
  target: Target,
  "badge-dollar-sign": BadgeDollarSign,
  box: Box,
  "book-open": BookOpen,
  calendar: CalendarDays,
  "circle-help": CircleHelp,
  "message-square-text": MessageSquareText,
  "messages-square": MessagesSquare,
  library: Library,
  mail: Mail,
  receipt: Receipt,
  video: Video
};
export function ListViewControlsMenu({
  object,
  listView,
  isCustom,
  onAction
}: {
  object: CrmObject;
  listView: string;
  isCustom: boolean;
  onAction: (action: string) => void;
}) {
  const items = listViewControlItems(object, listView, isCustom);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="List View Controls"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#cfd4dc] bg-white text-[#444] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb] hover:text-brand-700 active:scale-95 data-[state=open]:border-brand-500 data-[state=open]:text-brand-700"
        >
          <Settings size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-56 rounded border border-[#d8dde6] bg-white p-1 shadow-popover"
        >
          <div className="border-b border-[#d8dde6] px-3 py-2 text-xs text-[#706e6b]">{listView}</div>
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={!item.enabled}
              title={!item.enabled ? item.description : undefined}
              onSelect={() => onAction(item.label)}
              className="cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-brand-50 data-[disabled]:cursor-not-allowed data-[disabled]:text-[#a8a8a8] data-[disabled]:hover:bg-white"
            >
              <div className="font-medium">{item.label}</div>
              {!item.enabled && <div className="mt-0.5 text-xs leading-snug text-[#a8a8a8]">{item.description}</div>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export type ListViewControlItem = {
  label: string;
  enabled: boolean;
  description: string;
};
export function listViewControlItems(object: CrmObject, listView: string, isCustom: boolean): ListViewControlItem[] {
  const isRecentlyViewed = listView.includes("Recently Viewed");
  return [
    { label: "New", enabled: true, description: "Create a private list view with its own fields and filters." },
    { label: "Clone", enabled: !isRecentlyViewed, description: "Copy this list view into a new editable custom view." },
    { label: "Rename", enabled: isCustom, description: "Update the name of this custom list view." },
    { label: "Sharing Settings", enabled: !isRecentlyViewed, description: "Choose who can see this list view." },
    {
      label: "Select Fields to Display",
      enabled: !isRecentlyViewed,
      description: "Choose columns, display order, and saved widths."
    },
    { label: "Delete", enabled: isCustom, description: "Remove this custom list view without deleting records." },
    ...(object === "Knowledge__kav"
      ? []
      : [
          { label: "Reset Column Sorting", enabled: true, description: "Clear the current column sort for this view." }
        ]),
    { label: "Reset Column Widths", enabled: true, description: "Restore default column widths for this view." }
  ];
}
export function listViewMatchesSearch(view: string, query: string) {
  return view.toLowerCase().includes(query.trim().toLowerCase());
}
export function normalizeListViewSharing(value: unknown) {
  const sharing = String(value ?? "");
  if (listViewSharingOptions.includes(sharing)) return sharing;
  if (sharing === "All") return listViewSharingOptions[1];
  if (sharing === "Groups") return listViewSharingOptions[2];
  return listViewSharingOptions[0];
}
export function ObjectIcon({ definition }: { definition: ObjectDefinition }) {
  const Icon = iconMap[definition.icon] ?? Box;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_3px_rgba(3,45,96,0.24)]">
      <Icon size={20} />
    </div>
  );
}
export function AvatarImage({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block shrink-0 bg-cover bg-center", className)}
      style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
    />
  );
}
export type NativeSelectOption = string | { value: string; label: string };
export function normalizeSelectOptions(options: NativeSelectOption[]) {
  return options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
}
export function NativeSelect({
  options,
  value,
  onChange,
  error,
  className,
  id,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  placeholder = "Select..."
}: {
  options: NativeSelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const listId = `${searchId}-list`;
  const suppliedOptions = normalizeSelectOptions(options);
  const normalizedOptions =
    value && !suppliedOptions.some((option) => option.value === value)
      ? [{ value, label: value }, ...suppliedOptions]
      : suppliedOptions;
  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? normalizedOptions.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedQuery) || option.value.toLowerCase().includes(normalizedQuery)
      )
    : normalizedOptions;

  const optionsKey = normalizedOptions.map((option) => option.value).join("\u0001");
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, optionsKey]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let detach: (() => void) | undefined;
    let frame = 0;

    const scrollList = (event: Event) => {
      const panel = panelRef.current;
      const list = listRef.current;
      if (!panel || !list || !panel.contains(event.target as Node)) return;

      const maxScroll = list.scrollHeight - list.clientHeight;
      if (maxScroll <= 0) return;

      const deltaY = "deltaY" in event ? (event as WheelEvent).deltaY : 0;
      if (!deltaY && event.type !== "wheel") return;

      event.preventDefault();
      event.stopPropagation();
      if (event.type === "wheel") {
        list.scrollTop = Math.min(maxScroll, Math.max(0, list.scrollTop + deltaY));
      }
    };

    const attach = () => {
      if (cancelled) return;
      if (!panelRef.current || !listRef.current) {
        frame = requestAnimationFrame(attach);
        return;
      }
      // Capture on document so this runs before Dialog's react-remove-scroll lock.
      document.addEventListener("wheel", scrollList, { passive: false, capture: true });
      detach = () => {
        document.removeEventListener("wheel", scrollList, true);
      };
    };

    attach();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      detach?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setHighlightedIndex(0);
    } else {
      const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }

  function choose(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        filteredOptions.length ? Math.min(filteredOptions.length - 1, current + 1) : 0
      );
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(0, current - 1));
    }
    if (event.key === "Enter") {
      // Always preventDefault so an empty result set cannot submit a parent <form>.
      event.preventDefault();
      const option = filteredOptions[highlightedIndex] ?? filteredOptions[0];
      if (option) choose(option.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleOpenChange(false);
    }
  }

  return (
    <Popover.Root modal open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && filteredOptions[highlightedIndex] ? `${listId}-${highlightedIndex}` : undefined
          }
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          title={disabled ? (selectedOption?.label ?? placeholder) : undefined}
          disabled={disabled}
          className={cn(
            inputClass,
            "flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
            (error || ariaInvalid) && inputErrorClass,
            className
          )}
        >
          <span className={cn("min-w-0 truncate", !selectedOption?.label && "text-[#706e6b]")}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown size={14} className="shrink-0 text-[#706e6b]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[70] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded border border-[#d8dde6] bg-white shadow-popover"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div ref={panelRef}>
            <div className="border-b border-[#d8dde6] p-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#706e6b]"
                />
                <input
                  id={searchId}
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cn(inputBareClass, "h-8 w-full pl-8 pr-2 text-sm")}
                  placeholder="Search..."
                  aria-label="Search options"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  onKeyDown={onSearchKeyDown}
                />
              </div>
            </div>
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Options"
              tabIndex={-1}
              className="slds-scrollbar max-h-60 min-h-10 overflow-y-auto overscroll-contain p-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#706e6b]">No matches</div>
              ) : (
                filteredOptions.map((option, index) => {
                  const selected = option.value === value;
                  const active = index === highlightedIndex;
                  return (
                    <div
                      key={option.value}
                      id={`${listId}-${index}`}
                      data-option-index={index}
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      className={cn(
                        "relative flex w-full cursor-pointer items-center rounded py-2 pl-8 pr-3 text-left text-sm outline-none hover:bg-brand-50 focus-visible:bg-brand-50",
                        active && "bg-brand-50",
                        selected && "font-semibold"
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option.value)}
                    >
                      {selected && <Check size={14} className="absolute left-2 text-brand-600" />}
                      <span className="truncate">{option.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function RadixCheckbox({
  checked,
  onCheckedChange,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean | "indeterminate") => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <Checkbox.Root
      id={id}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#c9c9c9] bg-white outline-none transition-all hover:border-[#a0a0a0] focus-visible:border-brand-500 focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.16)] active:scale-90 data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=checked]:hover:border-brand-600"
    >
      <Checkbox.Indicator>
        <Check size={12} className="text-white" strokeWidth={3} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
export function FieldShell({
  label,
  required,
  error,
  children
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const control = enhanceFieldControl(children, { id: fieldId, error, errorId });

  return (
    <label className="block text-sm" htmlFor={fieldId}>
      <span className="mb-1 block text-xs font-semibold text-[var(--control-label,#444)]">
        {label}
        {required && (
          <span className="ml-0.5 text-[#ba0517]" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </span>
      {control}
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-[#ba0517]">
          {error}
        </span>
      )}
    </label>
  );
}
export function enhanceFieldControl(
  children: ReactNode,
  options: { id: string; error?: string; errorId: string }
): ReactNode {
  if (!isValidElement(children)) return children;

  const element = children as ReactElement<{
    id?: string;
    className?: string;
    error?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
  const isNativeControl = typeof element.type === "string";

  if (!isNativeControl) {
    return cloneElement(element, {
      id: element.props.id ?? options.id,
      error: element.props.error || Boolean(options.error),
      "aria-invalid": options.error ? true : element.props["aria-invalid"],
      "aria-describedby": options.error ? options.errorId : element.props["aria-describedby"]
    });
  }

  return cloneElement(element, {
    id: element.props.id ?? options.id,
    className: cn(element.props.className, options.error && inputErrorClass),
    "aria-invalid": options.error ? true : undefined,
    "aria-describedby": options.error ? options.errorId : undefined
  });
}
export function GuidanceCard({
  title,
  body,
  onSnooze,
  onDismiss,
  onComplete
}: {
  title: string;
  body: string;
  onSnooze: () => void;
  onDismiss: () => void;
  onComplete?: () => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const activeDragState = dragState;
    if (!activeDragState) return;
    const { startX, startY, originX, originY } = activeDragState;

    function handlePointerMove(event: PointerEvent) {
      setOffset({
        x: originX + event.clientX - startX,
        y: originY + event.clientY - startY
      });
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  return (
    <div
      className="fixed bottom-5 right-5 z-30 w-80 rounded border border-brand-500 bg-white p-3 shadow-popover"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="font-semibold">{title}</div>
        <button
          className="cursor-grab rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3] active:cursor-grabbing"
          aria-label="Drag and Drop"
          title="Drag and Drop"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragState({ startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y });
          }}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <p className="text-sm text-[#706e6b]">{body}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {onComplete && (
          <Button variant="primary" onClick={onComplete}>
            Add sample lead
          </Button>
        )}
        <Button onClick={onSnooze}>Snooze In-App Guidance</Button>
        <Button onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}
export const inputClass =
  "min-h-8 w-full rounded border border-[var(--control-border,#c9c9c9)] bg-[var(--control-bg,#fff)] px-2.5 py-1.5 text-sm text-[#181818] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--control-placeholder,#706e6b)] hover:border-[var(--control-border-hover,#a0a0a0)] focus:border-[var(--control-border-focus,#4f46e5)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.16)] disabled:cursor-not-allowed disabled:border-[#c9c9c9] disabled:bg-[var(--control-bg-muted,#f3f3f3)] disabled:text-[#706e6b] disabled:hover:border-[#c9c9c9] disabled:focus:shadow-none read-only:border-[#c9c9c9] read-only:bg-[var(--control-bg-muted,#f3f3f3)] read-only:text-[#444] read-only:hover:border-[#c9c9c9] read-only:focus:border-[#c9c9c9] read-only:focus:shadow-none";
export const inputErrorClass =
  "border-[var(--control-border-error,#ba0517)] hover:border-[var(--control-border-error,#ba0517)] focus:border-[var(--control-border-error,#ba0517)] focus:shadow-[0_0_0_3px_rgba(186,5,23,0.14)]";
export const inputBareClass =
  "h-full min-h-0 w-full flex-1 border-0 bg-transparent px-2 text-sm text-[#181818] outline-none placeholder:text-[var(--control-placeholder,#706e6b)]";
export const knowledgeToolbarButtonClass =
  "inline-flex h-8 items-center justify-center rounded border border-[#c9c9c9] bg-white px-2 text-xs font-semibold text-[#444] hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-45";
export const checkboxClass = "h-4 w-4 shrink-0 rounded border border-[#c9c9c9] accent-brand-600";
