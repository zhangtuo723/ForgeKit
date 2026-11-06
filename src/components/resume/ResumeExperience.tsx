"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Moon, MousePointer2, Pause, Play, Printer, RotateCcw, Sun, X } from "lucide-react";
import { projects } from "./portfolio-data";
import styles from "./resume.module.css";

type Chapter = "about" | "work" | "journey";
const chapters: { id: Chapter; number: string; en: string; label: string }[] = [
  { id: "about", number: "01", en: "About", label: "关于" },
  { id: "work", number: "02", en: "Selected work", label: "作品" },
  { id: "journey", number: "03", en: "Journey", label: "经历" },
];
const experience = [
  { year: "2025 — 至今", company: "字节跳动", en: "BYTEDANCE", role: "全栈 Agent 开发", detail: "连接前端体验、后端服务与 Agent 能力，让智能体走进真实的产品工作流。", tags: ["Full-stack", "AI Agent", "产品工程"] },
  { year: "2024 — 2025", company: "小红书", en: "XIAOHONGSHU", role: "用户增长开发", detail: "围绕用户增长，参与增长活动开发、广告投放系统与厂商合作相关业务开发。", tags: ["增长活动", "广告投放", "厂商合作"] },
  { year: "2024", company: "研究生毕业", en: "A NEW CHAPTER", role: "从探索，走向实践", detail: "完成研究生阶段学习，开始把技术探索带入真实业务与产品开发。", tags: ["持续学习", "动手构建"] },
];
const WorkspaceScene = dynamic(() => import("./WorkspaceScene"), {
  ssr: false,
  loading: () => <div className={styles.loadingScene} role="status"><span className={styles.loadingMark}>dds.</span><span className={styles.loadingMessage}>正在进入创作街区<span/></span></div>,
});
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className={styles.loadingScene} role="status"><span className={styles.loadingMark}>dds.</span><span className={styles.loadingMessage}>场景暂时无法加载，可通过导航阅读简历。</span></div> : this.props.children; }
}

export default function ResumeExperience() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [playing, setPlaying] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [reading, setReading] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  const homeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setChapter(null); setReading(false);
    requestAnimationFrame(() => (openerRef.current?.isConnected ? openerRef.current : homeRef.current)?.focus({ preventScroll: true }));
  }, []);
  const open = useCallback((id: Chapter) => {
    if (!panelRef.current?.contains(document.activeElement)) openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setReading(false); setChapter(id);
  }, []);
  useEffect(() => {
    setPlaying(false);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => { if (preference.matches) setPlaying(false); };
    apply(); preference.addEventListener("change", apply);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    return () => { preference.removeEventListener("change", apply); window.removeEventListener("keydown", escape); };
  }, [close]);
  useEffect(() => {
    if (reading) documentRef.current?.focus({ preventScroll: true });
    else if (chapter) { panelRef.current?.focus({ preventScroll: true }); panelRef.current?.scrollTo(0, 0); }
    const documentPanel = documentRef.current;
    if (!reading || !documentPanel) return;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(documentPanel.querySelectorAll<HTMLElement>('button,a[href]')).filter(el => el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === documentPanel)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    documentPanel.addEventListener("keydown", trap);
    return () => documentPanel.removeEventListener("keydown", trap);
  }, [chapter, reading]);
  const current = chapters.find(item => item.id === chapter);
  return <main className={styles.page} data-theme={theme}>
    <div className={styles.stage} data-resume-stage data-panel-open={Boolean(chapter || reading)} inert={reading}>
      <div className={styles.sceneBackground} aria-label="DDS 的滨水创作街区，可旋转、缩放并点击建筑探索"><SceneBoundary><WorkspaceScene theme={theme} playing={playing && !reading} resetToken={resetToken} focused={chapter} onSelect={open}/></SceneBoundary></div>
      <div className={styles.vignette} aria-hidden="true"/>
      <header className={styles.header}>
        <button type="button" className={styles.wordmark} ref={homeRef} aria-label="回到 DDS 全景" onClick={() => { close(); setResetToken(v => v + 1); }}><span>dds<i>.</i></span><small>DEVELOPER<br/>AND MAKER</small></button>
        <nav className={styles.navigation} aria-label="探索简历">{chapters.map(item => <button type="button" key={item.id} onClick={() => open(item.id)} aria-expanded={chapter === item.id} aria-controls={chapter ? "resume-chapter" : undefined}><sup>{item.number}</sup><span>{item.label}</span><i/></button>)}</nav>
        <div className={styles.headerRight}><span className={styles.location}><i/>{theme === "dark" ? "AFTER HOURS" : "DAYLIGHT"}</span><button type="button" className={styles.themeButton} aria-label={theme === "light" ? "切换暮色场景" : "切换日间场景"} title={theme === "light" ? "暮色" : "日间"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={16}/> : <Sun size={16}/>}</button></div>
      </header>
      <div className={styles.hero} aria-hidden={chapter || reading ? true : undefined}>
        <p className={styles.heroEyebrow}><span/> A PERSONAL CREATIVE QUARTER</p>
        <h1>Built from<em>curiosity.</em></h1>
        <p className={styles.heroDescription}>把想法，安放在此。<span>全栈开发 · AI Agent · 创作工具</span></p>
        <button type="button" className={styles.heroExplore} onClick={() => open("work")} tabIndex={chapter || reading ? -1 : 0}><span>走进作品街区</span><ArrowUpRight size={17} strokeWidth={1.2}/></button>
      </div>
      <div className={styles.worldCaption} aria-hidden="true"><span className={styles.compass}>N<i/></span><span>THE WATERFRONT<br/><small>想法在这里生长</small></span></div>
      <footer className={styles.bottomBar}>
        <div className={styles.exploreHint}><MousePointer2 size={13}/><span className={styles.desktopHint}>拖动环视 · 滚轮缩放 · WASD 漫游</span><span className={styles.mobileHint}>单指环视 · 双指缩放 · 点击建筑</span></div>
        <div className={styles.controls}><button type="button" aria-label={playing ? "暂停场景动画" : "播放场景动画"} aria-pressed={playing} title={playing ? "暂停场景动画" : "播放场景动画"} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14}/> : <Play size={14}/>}</button><button type="button" aria-label="重置场景视角" title="回到全景" onClick={() => { close(); setResetToken(v => v + 1); }}><RotateCcw size={15}/></button><span className={styles.controlDivider}/><button type="button" className={styles.readButton} onClick={() => { openerRef.current = document.activeElement as HTMLElement; setReading(true); setChapter(null); }}><BookOpen size={14}/><span>文字简历</span></button></div>
        <div className={styles.footerLinks}><Link href="/">ForgeKit <ArrowUpRight size={12}/></Link><a href="https://github.com/zhangtuo723" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={12}/></a><span>© DDS 2026</span></div>
      </footer>
      {chapter && <aside className={styles.panel} id="resume-chapter" role="dialog" aria-modal="false" aria-labelledby="chapter-title" tabIndex={-1} ref={panelRef}>
        <div className={styles.panelTop}><span>FIELD NOTES / {current?.number}</span><button type="button" onClick={close} aria-label="关闭内容，返回全景"><X size={19} strokeWidth={1.3}/></button></div>
        <div className={styles.panelTitle}><span>{chapter === "about" ? "关于 DDS" : chapter === "work" ? "精选开源作品" : "工作与学习经历"}</span><h2 id="chapter-title"><em>{current?.en}</em><span>.</span></h2></div>
        {chapter === "about" && <div className={styles.aboutBody}><h3>程序员，也是一名<br/><em>持续好奇的创造者。</em></h3><p>我是 DDS。2024 年研究生毕业，从用户增长开发走向全栈 Agent 开发。喜欢把一个模糊的念头，变成可以触摸、使用和不断打磨的产品。</p><p>工作之外，我探索 AI 与创作的交汇：让 Agent 参与真实任务，让图像、视频与自动化流程更容易使用，也把体验延伸到相机和 iPad。</p><div className={styles.aboutQuote}><span>“</span>Build with logic.<br/><em>Create with curiosity.</em></div><div className={styles.toolGroups}>{[{ title: "INTERFACE", tools: "TypeScript / React / Next.js / Electron" }, { title: "INTELLIGENCE", tools: "Python / Node.js / Agent / CLI" }, { title: "EXPERIENCE", tools: "Three.js / React Flow / ComfyUI / Swift" }].map(group => <div key={group.title}><span>{group.title}</span><p>{group.tools}</p></div>)}</div><button type="button" className={styles.nextChapter} onClick={() => open("work")}>让作品继续讲述 <ArrowRight size={17}/></button></div>}
        {chapter === "work" && <div className={styles.projectList}><p className={styles.panelLead}>好奇心留下的，<br/>一些可以打开的答案。</p>{projects.map((project, index) => <article key={project.id} className={styles.project}><span className={styles.projectNumber}>0{index + 1}</span><a href={project.href} target="_blank" rel="noopener noreferrer"><span>{project.subtitle}</span><h3>{project.title}<ArrowUpRight size={20} strokeWidth={1.2}/></h3></a><p>{project.description}</p><div className={styles.tags}>{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div></article>)}<a className={styles.nextChapter} href="https://github.com/zhangtuo723?tab=repositories" target="_blank" rel="noopener noreferrer">全部开源实验 <ArrowUpRight size={17}/></a></div>}
        {chapter === "journey" && <div className={styles.journeyBody}><p className={styles.panelLead}>让技术走出编辑器，<br/>在真实的问题里找到价值。</p>{experience.map((item, index) => <article className={styles.experience} key={item.company}><div className={styles.experienceDate}><span>{item.year}</span>{index === 0 && <i>NOW</i>}</div><span className={styles.companyEnglish}>{item.en}</span><h3>{item.company}</h3><h4>{item.role}</h4><p>{item.detail}</p><div className={styles.tags}>{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></article>)}<button type="button" className={styles.nextChapter} onClick={() => window.print()}><Printer size={15}/> 打印 / 保存完整简历 <ArrowUpRight size={17}/></button></div>}
        <div className={styles.panelFooter}><span>STAY CURIOUS. KEEP BUILDING.</span><span>dds.</span></div>
      </aside>}
    </div>
    <section className={`${styles.document} ${reading ? styles.documentOpen : ""}`} data-resume-document aria-label="DDS 完整文字简历" tabIndex={-1} ref={documentRef} role={reading ? "dialog" : undefined} aria-modal={reading ? "true" : undefined}>
      <div className={styles.documentControls} data-resume-document-controls><button type="button" onClick={close}><ArrowLeft size={16}/> 返回 3D 世界</button><button type="button" onClick={() => window.print()}><Printer size={15}/> 打印 / 保存 PDF</button></div>
      <div className={styles.documentHeading}><span>CURRICULUM VITAE / 2026</span><h2>DDS<span>.</span></h2><p>全栈开发者 · AI Agent · 创作工具</p></div>
      <h3>关于</h3><p>2024 年研究生毕业。曾在小红书从事用户增长开发，2025 年至今在字节跳动从事全栈 Agent 开发。探索 AI、可视化创作工具，以及从 Web 到原生应用的交互体验。</p>
      <h3>工作与学习经历</h3>{experience.map(item => <article key={item.company}><span>{item.year}</span><h4>{item.company} · {item.role}</h4><p>{item.detail}</p></article>)}
      <h3>精选开源作品</h3>{projects.map(project => <article key={project.id}><h4><a href={project.href} target="_blank" rel="noopener noreferrer">{project.title} ↗</a></h4><p>{project.description}</p><small>{project.tags.join(" / ")}</small><a className={styles.printSource} href={project.href}>{project.href}</a></article>)}
      <h3>技术与探索方向</h3><p>TypeScript · React · Next.js · Node.js · Python · Electron · AI Agent · CLI · Three.js · React Flow · ComfyUI · Swift / iPad</p>
      <a className={styles.documentContact} href="https://github.com/zhangtuo723" target="_blank" rel="noopener noreferrer">通过 GitHub 项目 Issues 交流 <ArrowUpRight size={16}/></a>
    </section>
    <noscript><style>{`[data-resume-document-controls]{display:none!important}[data-resume-stage]{display:none!important}[data-resume-document]{display:block!important;position:relative!important;max-height:none!important;height:auto!important}`}</style></noscript>
  </main>;
}
