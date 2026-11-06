import type { Metadata } from "next";
import "@/components/studio.css";

export const metadata: Metadata = {
  title: { default: "幕间 Studio · 剧本创作工作室", template: "%s | 幕间 Studio" },
  description: "编写剧本、管理人物与参考图，通过 Agent API 连接你的创作流程。",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
