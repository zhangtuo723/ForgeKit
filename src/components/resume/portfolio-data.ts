export type ResumeProject = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  href: string;
  kind: "canvas" | "terminal" | "camera";
};

// Public repository READMEs verified on 2026-11-06. These are personal projects,
// not claims about work performed for an employer. No usage or impact metrics
// are inferred. Source links are also the destinations of the project cards.
export const projects: ResumeProject[] = [
  {
    id: "aigc-canvas",
    title: "AIGC CANVAS",
    subtitle: "让创意，在同一张画布上发生。",
    description:
      "面向 AI 短剧的桌面创作工作台。将 Agent 对话、角色与场景参考、节点式图片与视频生成，以及 3D 导演预演组织在同一个项目里。",
    tags: ["Electron", "React Flow", "Agent / MCP", "Three.js"],
    href: "https://github.com/zhangtuo723/aigc_line",
    kind: "canvas",
  },
  {
    id: "drama-canvas",
    title: "Drama Canvas",
    subtitle: "让 Agent 的创作过程，看得见。",
    description:
      "供 Codex 操作的本地媒体画布与 CLI。通过自然语言协作，把图像、视频、音频和提示词留在项目中，用连线记录素材之间的生成依赖。",
    tags: ["JavaScript", "Node.js", "CLI", "Codex"],
    href: "https://github.com/zhangtuo723/drama-canvas",
    kind: "terminal",
  },
  {
    id: "snapbooth",
    title: "SnapBooth",
    subtitle: "从一次快门，到一张有温度的照片。",
    description:
      "以 iPad 为主平台的活动拍照亭。连接佳能相机，完成拍摄、照片回传、滤镜和模板排版，再通过系统分享将成片交给米家 App 确认打印。",
    tags: ["Swift", "iPad", "USB / PTP", "Photo Printing"],
    href: "https://github.com/zhangtuo723/SnapBooth",
    kind: "camera",
  },
];
