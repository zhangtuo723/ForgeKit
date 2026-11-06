import Link from "next/link";

export default function StudioNotFound() {
  return <main className="standalone-state"><span className="eyebrow">STUDIO / PAGE NOT FOUND</span><h1>没有找到这个创作页面</h1><p>检查一下地址，或回到工作台继续。</p><Link className="btn btn-primary" href="/studio/dashboard">回到创作工作台</Link></main>;
}
