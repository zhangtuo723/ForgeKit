import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dev Toolbox",
    template: "%s | Dev Toolbox"
  },
  description:
    "Fast, focused developer tools built with Next.js. Start with formatters, decoders, generators, and API helpers.",
  metadataBase: new URL("https://devtoolbox.local")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
