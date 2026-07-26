"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

export type AsyncButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown;
  pendingContent?: ReactNode;
};

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    value !== undefined &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value
  );
}

/**
 * A button that owns the pending UI for promise-returning actions.
 * Callers only need to return their async work from onClick.
 */
export function AsyncButton({
  children,
  disabled = false,
  onClick,
  pendingContent,
  type = "button",
  ...props
}: AsyncButtonProps) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled || pendingRef.current) return;

    const result = onClick?.(event);
    if (!isPromiseLike(result)) return;

    pendingRef.current = true;
    setPending(true);
    try {
      await result;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-loading={pending || undefined}
      onClick={handleClick}
    >
      {pending && <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />}
      {pending && pendingContent !== undefined ? pendingContent : children}
    </button>
  );
}
