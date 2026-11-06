import Link from "next/link";
import { ArrowUpRight, Clapperboard } from "lucide-react";
import "./module-home.css";

const modules = [
  {
    href: "/studio",
    name: "剧本创作",
    product: "幕间 Studio",
    description: "从第一行对白到完整故事，把剧本、人物与视觉参考放在同一个创作空间。",
    features: ["在线编写", "人物资产", "Agent 协作"],
  },
];

export default function Home() {
  return <main className="module-hub">
    <header className="module-hub-header"><Link href="/" aria-label="ForgeKit 首页"><span className="module-hub-mark">F</span><strong>ForgeKit</strong></Link><span>你的工作空间</span></header>
    <section className="module-hub-intro"><span>YOUR WORKSPACE</span><h1>让每一件事，<br/>都有自己的空间。</h1><p>选择工具，继续你的创作与工作。</p></section>
    <section className="module-hub-modules" aria-labelledby="module-heading">
      <div className="module-hub-section-title"><h2 id="module-heading">工作空间</h2><span>{modules.length} 个可用模块</span></div>
      <div className="module-hub-grid">{modules.map(module => <Link className="module-hub-card" key={module.href} href={module.href}>
        <div className="module-hub-card-top"><span className="module-hub-icon"><Clapperboard size={27} strokeWidth={1.5}/></span><ArrowUpRight size={21}/></div>
        <span className="module-hub-product">{module.product}</span><h3>{module.name}</h3><p>{module.description}</p>
        <div className="module-hub-features">{module.features.map(feature => <span key={feature}>{feature}</span>)}</div>
        <div className="module-hub-card-footer">进入创作空间<ArrowUpRight size={17}/></div>
      </Link>)}</div>
    </section>
    <footer className="module-hub-footer">ForgeKit · 把想法，变成作品。</footer>
  </main>;
}
