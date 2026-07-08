import "@/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salesforce Lightning CRM Clone",
  description: "A Salesforce Lightning Starter-style CRM rebuilt with Next.js, Radix UI, Tailwind, Prisma, and PostgreSQL."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
