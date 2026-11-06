import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ForgeKit · 工作空间", template: "%s | ForgeKit" },
  description: "从统一入口进入你的创作与管理工具。",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
