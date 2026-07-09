import "@/app/globals.css";
import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Salesforce Lightning CRM Clone",
  description: "A Salesforce Lightning Starter-style CRM rebuilt with Next.js, Radix UI, Tailwind, Prisma, and PostgreSQL."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sourceSans.variable}>
      <body className={sourceSans.className}>{children}</body>
    </html>
  );
}
