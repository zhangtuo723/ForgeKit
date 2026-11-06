import Link from "next/link";
export default function NotFound() {
  return <main className="standalone-state"><div className="brand-symbol">F</div><span className="eyebrow">404 / PAGE NOT FOUND</span><h1>这个页面暂时不在工作空间里。</h1><p>检查一下地址，或返回入口选择工作空间。</p><Link className="btn btn-primary" href="/">返回模块入口</Link></main>;
}
