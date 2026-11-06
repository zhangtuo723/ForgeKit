"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, ArrowRight, Eye, EyeOff, LockKeyhole, LoaderCircle, ShieldCheck, UserRound, Layers3, Sparkles } from "lucide-react";
import { api } from "@/lib/client";

export function LoginForm() {
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      await api("/api/studio/auth/login", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password"), remember: form.get("remember") === "on" }) });
      window.location.assign("/studio/dashboard");
    } catch (e) { setError(e instanceof Error ? e.message : "登录失败"); setPending(false); }
  }
  return <main className="login-page">
    <section className="login-story" aria-label="幕间 Studio 创作空间介绍">
      <a href="/studio/dashboard" className="login-brand"><span className="brand-symbol">F<span /></span><span>幕间<span className="brand-light"> Studio</span></span></a>
      <div className="login-story-content"><div className="story-label"><span /> YOUR IDEAS. ONE WORKSPACE.</div><h1>让故事生长，<br />让人物<span>鲜活。</span></h1><p>从第一行对白到完整剧本，<br />把灵感与人物，放在同一个地方。</p></div>
      <div className="login-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-orbit orbit-three"/><div className="art-core"><Layers3 size={54} strokeWidth={1.1}/></div><div className="floating-chip chip-one"><span className="chip-icon"><ShieldCheck size={18}/></span><span>每一个角色，都有故事<small>Everything in sync</small></span><span className="tiny-online"/></div><div className="floating-chip chip-two"><Sparkles size={17}/><span>为创作而生</span><ArrowUpRight size={16}/></div></div>
      <div className="login-story-footer"><span>从一行文字，走进一个世界。</span><span>01 — ∞</span></div>
    </section>
    <section className="login-form-side"><div className="login-topnote"><span className="status-dot"/> 一切就绪，等待你的加入</div><div className="login-form-wrap"><div className="login-mini-mark"><Layers3 size={25}/></div><span className="eyebrow">WELCOME BACK</span><h2>欢迎回到创作空间</h2><p className="login-subtitle">登录工作室，继续你的剧本与人物创作。</p>
      <form onSubmit={submit} className="login-form">
        <label className="field-label" htmlFor="username">登录账号</label><div className="login-input"><UserRound size={18}/><input id="username" name="username" autoComplete="username" placeholder="请输入账号" required maxLength={80} autoFocus disabled={pending}/></div>
        <label className="field-label" htmlFor="password">登录密码</label><div className="login-input"><LockKeyhole size={18}/><input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="请输入密码" required maxLength={256} disabled={pending}/><button type="button" aria-label={show ? "隐藏密码" : "显示密码"} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
        <div className="login-options"><label><input name="remember" type="checkbox"/> 7 天内保持登录</label><span><ShieldCheck size={13}/> 安全会话</span></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className="login-submit" disabled={pending}>{pending ? <><LoaderCircle size={18} className="spin"/> 正在登录</> : <>进入创作空间 <ArrowRight size={18}/></>}</button>
      </form><div className="login-help"><LockKeyhole size={14}/> 仅限授权管理员访问</div>
    </div><footer className="login-bottom"><span>© {new Date().getFullYear()} 幕间 Studio</span><span>让故事有迹可循 <span className="footer-spark">✳</span></span></footer></section>
  </main>;
}

