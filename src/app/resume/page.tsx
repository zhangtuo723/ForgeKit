import type { Metadata } from "next";
import ResumeExperience from "@/components/resume/ResumeExperience";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "DDS · Built from Curiosity",
  description: "DDS 的滨水创作街区与交互简历。在可漫游的 3D 空间里，探索从用户增长到全栈 Agent 开发的经历与开源作品。",
  robots: { index: false, follow: false },
};

export default function ResumePage() {
  return <ResumeExperience />;
}
