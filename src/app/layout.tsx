import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dev Toolbox",
    template: "%s | Dev Toolbox"
  },
  description:
    "Fast, focused developer tools built with Next.js. Start with formatters, decoders, generators, and API helpers.",
  metadataBase: new URL("https://devtoolbox.local"),
  alternates: {
    languages: {
      "zh-CN": "/zh",
      en: "/en"
    }
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
