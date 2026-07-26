import type { ReactNode } from "react";

export function SignOutButton({
  children = "Sign out",
  className,
  formClassName
}: {
  children?: ReactNode;
  className?: string;
  formClassName?: string;
}) {
  return (
    <form action="/auth/signout" method="post" className={formClassName}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
