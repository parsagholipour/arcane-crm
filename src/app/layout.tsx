import "@/app/globals.css";
import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { BRAND } from "@/lib/brand";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.product} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: {
    icon: "/reloriq-mark.svg",
    shortcut: "/reloriq-mark.svg",
    apple: "/reloriq-mark.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sourceSans.variable}>
      <body className={sourceSans.className}>{children}</body>
    </html>
  );
}
