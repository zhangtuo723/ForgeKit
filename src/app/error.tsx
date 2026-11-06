"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="standalone-state"><span className="eyebrow">SOMETHING WENT WRONG</span><h1>页面遇到了一点问题</h1><p>请稍后重试。如果问题持续存在，请检查服务状态。</p><button className="btn btn-primary" onClick={reset}>重新加载</button></main>;
}
