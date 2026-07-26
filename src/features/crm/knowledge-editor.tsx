"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRef, useState } from "react";
import { type RecordData } from "@/lib/crm-types";
import { cn, slugify } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import {
  FieldShell,
  inputBareClass,
  inputClass,
  knowledgeToolbarButtonClass,
  NativeSelect,
  RadixCheckbox
} from "@/features/crm/controls";
import { recordDataShallowEqual, validateRequired } from "@/features/crm/form-model";
import { formatWordCount, richTextWordCount, stripRichTextMarkup } from "@/features/crm/quick-text-editor";
import { useUnsavedChangesGuard } from "@/features/crm/record-editors";

export function KnowledgeModal({
  initial,
  onClose,
  onSave
}: {
  initial?: RecordData;
  onClose: () => void;
  onSave: (values: RecordData) => Promise<boolean>;
}) {
  const [initialValues] = useState<RecordData>(() =>
    initial ? { ...initial } : { visibleInInternalApp: true, visibleToCustomer: false }
  );
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [slugManual, setSlugManual] = useState(Boolean(initial?.urlName));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [showMoreToolbar, setShowMoreToolbar] = useState(false);
  const [menuNotice, setMenuNotice] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const bodyRichText = String(values.bodyRichText ?? "");
  const wordCount = richTextWordCount(bodyRichText);
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  async function submit(stayOpen = false) {
    const nextErrors = validateRequired(values, ["title", "urlName"]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const ok = await onSave(values);
    if (ok && stayOpen) {
      setValues(initialValues);
      setSlugManual(false);
      setErrors({});
      setUndoStack([]);
      setRedoStack([]);
      setMenuNotice("");
      setFullscreen(false);
    }
  }
  function setBodyRichText(nextBody: string, selection?: { start: number; end: number }) {
    if (nextBody === bodyRichText) return;
    setUndoStack((current) => [...current.slice(-24), bodyRichText]);
    setRedoStack([]);
    setValues((current) => ({ ...current, bodyRichText: nextBody }));
    if (selection) {
      requestAnimationFrame(() => {
        textAreaRef.current?.focus();
        textAreaRef.current?.setSelectionRange(selection.start, selection.end);
      });
    }
  }

  function replaceSelection(transform: (selected: string) => string, placeholder = "text") {
    const area = textAreaRef.current;
    const start = area?.selectionStart ?? bodyRichText.length;
    const end = area?.selectionEnd ?? bodyRichText.length;
    const selected = bodyRichText.slice(start, end) || placeholder;
    const replacement = transform(selected);
    const nextBody = `${bodyRichText.slice(0, start)}${replacement}${bodyRichText.slice(end)}`;
    setBodyRichText(nextBody, { start, end: start + replacement.length });
  }

  function insertAtSelection(text: string) {
    replaceSelection(() => text, "");
  }

  function wrapSelection(prefix: string, suffix: string, placeholder: string) {
    replaceSelection((selected) => `${prefix}${selected}${suffix}`, placeholder);
  }

  function applyBlockFormat(format: string) {
    const tags: Record<string, [string, string, string]> = {
      Paragraph: ["<p>", "</p>", "Paragraph text"],
      "Heading 1": ["<h1>", "</h1>", "Heading"],
      "Heading 2": ["<h2>", "</h2>", "Heading"],
      Quote: ["<blockquote>", "</blockquote>", "Quote"],
      Code: ["<pre><code>", "</code></pre>", "code"]
    };
    const [prefix, suffix, placeholder] = tags[format] ?? tags.Paragraph;
    wrapSelection(prefix, suffix, placeholder);
  }

  function applyAlignment(alignment: "left" | "center" | "right" | "justify") {
    replaceSelection((selected) => `<p style="text-align: ${alignment};">${selected}</p>`, "Aligned text");
  }

  function clearFormatting() {
    const area = textAreaRef.current;
    const start = area?.selectionStart ?? 0;
    const end = area?.selectionEnd ?? 0;
    if (start !== end) {
      const replacement = stripRichTextMarkup(bodyRichText.slice(start, end));
      setBodyRichText(`${bodyRichText.slice(0, start)}${replacement}${bodyRichText.slice(end)}`, {
        start,
        end: start + replacement.length
      });
      return;
    }
    setBodyRichText(stripRichTextMarkup(bodyRichText));
  }

  function normalizeBody() {
    setBodyRichText(
      bodyRichText
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
    setMenuNotice("Extra spacing normalized.");
  }

  function undoEditor() {
    const previous = undoStack.at(-1);
    if (previous === undefined) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [bodyRichText, ...current].slice(0, 25));
    setValues((current) => ({ ...current, bodyRichText: previous }));
  }

  function redoEditor() {
    const next = redoStack[0];
    if (next === undefined) return;
    setRedoStack((current) => current.slice(1));
    setUndoStack((current) => [...current.slice(-24), bodyRichText]);
    setValues((current) => ({ ...current, bodyRichText: next }));
  }

  function updateBodyFromTyping(nextBody: string) {
    setUndoStack((current) => [...current.slice(-24), bodyRichText]);
    setRedoStack([]);
    setValues((current) => ({ ...current, bodyRichText: nextBody }));
  }

  const menuActions: Record<string, Array<{ label: string; action: () => void; destructive?: boolean }>> = {
    File: [
      { label: "Print Article", action: () => window.print() },
      { label: "Clear Article Body", action: () => setBodyRichText(""), destructive: true }
    ],
    Edit: [
      { label: "Undo", action: undoEditor },
      { label: "Redo", action: redoEditor },
      { label: "Clear Formatting", action: clearFormatting }
    ],
    Insert: [
      { label: "Current Date", action: () => insertAtSelection(new Date().toLocaleDateString("en-US")) },
      { label: "Horizontal Rule", action: () => insertAtSelection("\n<hr />\n") },
      {
        label: "2 x 2 Table",
        action: () =>
          insertAtSelection("<table><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></table>")
      }
    ],
    View: [
      { label: fullscreen ? "Exit Fullscreen" : "Fullscreen", action: () => setFullscreen((current) => !current) },
      {
        label: showMoreToolbar ? "Hide More Toolbar Items" : "Show More Toolbar Items",
        action: () => setShowMoreToolbar((current) => !current)
      }
    ],
    Format: [
      { label: "Paragraph", action: () => applyBlockFormat("Paragraph") },
      { label: "Heading 1", action: () => applyBlockFormat("Heading 1") },
      { label: "Quote", action: () => applyBlockFormat("Quote") }
    ],
    Table: [
      {
        label: "Insert 2 x 2 Table",
        action: () =>
          insertAtSelection("<table><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></table>")
      }
    ],
    Tools: [
      { label: "Normalize Spacing", action: normalizeBody },
      { label: "Strip Formatting", action: clearFormatting }
    ],
    Help: [
      {
        label: "Insert Authoring Checklist",
        action: () =>
          insertAtSelection(
            "\n<ul><li>Confirm audience.</li><li>Review visibility settings.</li><li>Save or publish when ready.</li></ul>\n"
          )
      }
    ]
  };

  if (discardDialog) return discardDialog;

  return (
    <BaseDialog
      open
      title={initial ? `Edit ${String(initial.title ?? "Knowledge")}` : "New Knowledge"}
      onClose={requestClose}
      wide
      footer={
        <>
          <Button onClick={requestClose}>Cancel</Button>
          {!initial && <Button onClick={() => submit(true)}>Save & New</Button>}
          <Button variant="primary" onClick={() => submit(false)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Title" required error={errors.title}>
            <input
              className={inputClass}
              value={String(values.title ?? "")}
              onChange={(event) => {
                const title = event.target.value;
                setValues({ ...values, title, urlName: slugManual ? values.urlName : slugify(title) });
              }}
            />
          </FieldShell>
          <FieldShell label="URL Name" required error={errors.urlName}>
            <input
              className={inputClass}
              value={String(values.urlName ?? "")}
              onChange={(event) => {
                setSlugManual(true);
                setValues({ ...values, urlName: slugify(event.target.value) });
              }}
            />
          </FieldShell>
        </div>
        <div
          className={cn(
            "rounded border border-[#d8dde6] bg-white",
            fullscreen && "fixed inset-4 z-[90] flex flex-col shadow-modal"
          )}
        >
          <div className="flex flex-wrap gap-1 border-b border-[#d8dde6] bg-[#f8f8f8] p-2 text-xs">
            {Object.entries(menuActions).map(([label, actions]) => (
              <DropdownMenu.Root key={label}>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="rounded px-2 py-1 hover:bg-white">
                    {label}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="z-[100] min-w-48 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
                    {actions.map((item) => (
                      <DropdownMenu.Item
                        key={item.label}
                        onSelect={item.action}
                        className={cn(
                          "cursor-pointer rounded px-3 py-2 text-sm outline-none hover:bg-brand-50",
                          item.destructive && "text-[#ba0517] hover:bg-[#fff1f1]"
                        )}
                      >
                        {item.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b border-[#d8dde6] p-2">
            <button
              type="button"
              className={knowledgeToolbarButtonClass}
              onClick={() => setFullscreen((current) => !current)}
            >
              {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button
              type="button"
              className={knowledgeToolbarButtonClass}
              disabled={redoStack.length === 0}
              onClick={redoEditor}
            >
              Redo
            </button>
            <button
              type="button"
              className={knowledgeToolbarButtonClass}
              disabled={undoStack.length === 0}
              onClick={undoEditor}
            >
              Undo
            </button>
            <NativeSelect
              className="h-8 w-36 text-xs"
              options={["Paragraph", "Heading 1", "Heading 2", "Quote", "Code"]}
              value="Paragraph"
              onChange={applyBlockFormat}
            />
            <button
              type="button"
              aria-label="Bold"
              className={cn(knowledgeToolbarButtonClass, "font-bold")}
              onClick={() => wrapSelection("<strong>", "</strong>", "bold text")}
            >
              B
            </button>
            <button
              type="button"
              aria-label="Italic"
              className={cn(knowledgeToolbarButtonClass, "italic")}
              onClick={() => wrapSelection("<em>", "</em>", "italic text")}
            >
              I
            </button>
            <button
              type="button"
              aria-label="Underline"
              className={cn(knowledgeToolbarButtonClass, "underline")}
              onClick={() => wrapSelection("<u>", "</u>", "underlined text")}
            >
              U
            </button>
            <button
              type="button"
              aria-label="Strikethrough"
              className={cn(knowledgeToolbarButtonClass, "line-through")}
              onClick={() => wrapSelection("<s>", "</s>", "struck text")}
            >
              S
            </button>
            <NativeSelect
              className="h-8 w-36 text-xs"
              options={[
                { value: "text", label: "Text color" },
                { value: "#0176d3", label: "Blue" },
                { value: "#2e844a", label: "Green" },
                { value: "#ba0517", label: "Red" },
                { value: "#181818", label: "Black" }
              ]}
              value="text"
              onChange={(color) =>
                color !== "text" && wrapSelection(`<span style="color: ${color};">`, "</span>", "colored text")
              }
            />
            <NativeSelect
              className="h-8 w-40 text-xs"
              options={[
                { value: "background", label: "Background" },
                { value: "#fff7e8", label: "Gold" },
                { value: "#e4f6e6", label: "Green" },
                { value: "#eef4ff", label: "Blue" },
                { value: "#fff1f1", label: "Red" }
              ]}
              value="background"
              onChange={(color) =>
                color !== "background" &&
                wrapSelection(`<span style="background-color: ${color};">`, "</span>", "highlighted text")
              }
            />
            <button type="button" className={knowledgeToolbarButtonClass} onClick={clearFormatting}>
              Clear
            </button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("left")}>
              Left
            </button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("center")}>
              Center
            </button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("right")}>
              Right
            </button>
            <button type="button" className={knowledgeToolbarButtonClass} onClick={() => applyAlignment("justify")}>
              Justify
            </button>
            <button
              type="button"
              className={knowledgeToolbarButtonClass}
              onClick={() => setShowMoreToolbar((current) => !current)}
            >
              {showMoreToolbar ? "Less" : "More"}
            </button>
            {showMoreToolbar && (
              <>
                <button
                  type="button"
                  className={knowledgeToolbarButtonClass}
                  onClick={() => insertAtSelection("\n<hr />\n")}
                >
                  Rule
                </button>
                <button
                  type="button"
                  className={knowledgeToolbarButtonClass}
                  onClick={() =>
                    insertAtSelection(
                      "<table><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></table>"
                    )
                  }
                >
                  Table
                </button>
                <button type="button" className={knowledgeToolbarButtonClass} onClick={normalizeBody}>
                  Normalize
                </button>
              </>
            )}
          </div>
          <textarea
            ref={textAreaRef}
            className={cn(inputBareClass, fullscreen ? "min-h-0 flex-1 p-3" : "h-44 p-3")}
            value={bodyRichText}
            onChange={(event) => updateBodyFromTyping(event.target.value)}
            aria-label="Article Body"
          />
          <div className="flex items-center justify-between gap-3 border-t border-[#d8dde6] px-3 py-1 text-xs text-[#706e6b]">
            <span>{formatWordCount(wordCount)}</span>
            {menuNotice && <span>{menuNotice}</span>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Visible In Internal App">
            <RadixCheckbox
              checked={Boolean(values.visibleInInternalApp)}
              onCheckedChange={(value) => setValues({ ...values, visibleInInternalApp: Boolean(value) })}
            />
          </FieldShell>
          <FieldShell label="Visible to Customer">
            <RadixCheckbox
              checked={Boolean(values.visibleToCustomer)}
              onCheckedChange={(value) => setValues({ ...values, visibleToCustomer: Boolean(value) })}
            />
          </FieldShell>
          {[
            "Article Created Date",
            "Created By",
            "Article Archived Date",
            "Last Modified By",
            "Article Total View Count",
            "Archived By"
          ].map((label) => (
            <FieldShell key={label} label={label}>
              <input className={inputClass} readOnly />
            </FieldShell>
          ))}
        </div>
      </div>
    </BaseDialog>
  );
}
export function validEmailValue(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
