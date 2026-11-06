"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Clapperboard, FilePenLine, FileText, ImageIcon, KeyRound, LoaderCircle, Plus, RefreshCw, Sparkles, Upload, UsersRound } from "lucide-react";
import { api, relativeTime } from "@/lib/client";
import type { StudioOverview } from "@/lib/studio-types";
import { AssetImage } from "./asset-image";

export function StudioDashboard() {
  const [data, setData] = useState<StudioOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    api<StudioOverview>("/api/studio/overview").then(value => { if (!cancelled) setData(value); }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);
  if (!data && loading) return <div className="studio-loading"><LoaderCircle size={23} className="spin"/>正在打开你的工作室…</div>;
  if (!data) return <div className="studio-error" role="alert">{error}<button onClick={() => setRefresh(n => n + 1)}>重新加载</button></div>;
  const stats = [
    { label: "我的剧本", value: data.stats.scripts, foot: `${data.stats.writing} 部正在创作`, icon: FileText },
    { label: "人物档案", value: data.stats.characters, foot: "构建故事中的每一个人", icon: UsersRound },
    { label: "人物资产", value: data.stats.assets, foot: "形象 · 服装 · 表情参考", icon: ImageIcon },
    { label: "累计创作字数", value: data.stats.words, foot: "每一行，都是新的可能", icon: FilePenLine },
  ];
  return <div className="studio-page">
    <div className="studio-heading"><div><span className="studio-kicker">YOUR CREATIVE SPACE</span><h1>创作工作台<span className="heading-dot">.</span></h1><p>让灵感有处安放，让故事慢慢成形。</p></div><div className="studio-actions"><button className="icon-button" onClick={() => setRefresh(n => n + 1)} disabled={loading} aria-label="刷新工作台"><RefreshCw size={17} className={loading ? "spin" : ""}/></button><Link className="btn btn-secondary" href="/studio/scripts?import=1"><Upload size={15}/>导入剧本</Link><Link className="btn btn-primary" href="/studio/scripts?new=1"><Plus size={16}/>新建剧本</Link></div></div>
    {error && <div className="studio-error" role="alert">{error} · 当前显示上次加载的内容</div>}
    <section className="studio-hero"><div><span className="studio-kicker">A STORY STARTS WITH A SINGLE LINE</span><h2>{data.stats.scripts ? "你的故事，正在发生。" : "好故事，从第一行开始。"}</h2><p>在这里写下剧本，塑造人物，收集每一张灵感参考。<br/>从文字到画面，把你的创作留在同一个工作室。</p><div className="studio-actions"><Link className="btn btn-primary" href={data.recentScripts[0] ? `/studio/scripts/${data.recentScripts[0].id}` : "/studio/scripts?new=1"}><FilePenLine size={15}/>{data.recentScripts[0] ? "继续最近的创作" : "写下第一份剧本"}<ArrowUpRight size={15}/></Link></div></div><div className="studio-art" aria-hidden="true"><div className="studio-art-ring"/><div className="studio-art-paper"><span>SCENE / 001</span><Clapperboard size={30} strokeWidth={1.3}/><strong>Your<br/>next story.</strong><i/><i/></div></div></section>
    <div className="studio-stats">{stats.map(item => <div key={item.label} className="studio-stat"><div className="studio-stat-top"><span>{item.label}</span><item.icon size={19}/></div><strong>{item.value.toLocaleString()}</strong><small>{item.foot}</small></div>)}</div>
    <div className="studio-columns"><div className="studio-side-stack" style={{display:"flex"}}><section className="studio-section"><div className="studio-section-head"><h2><FileText size={16}/>最近编辑</h2><Link href="/studio/scripts">全部剧本<ArrowRight size={14}/></Link></div>{data.recentScripts.length ? data.recentScripts.slice(0,5).map((script,index) => <Link key={script.id} className="studio-script-row" href={`/studio/scripts/${script.id}`}><span className="studio-script-number">{String(index+1).padStart(2,"0")}</span><div className="studio-script-main"><strong>{script.title}</strong><p>{script.genre || "未分类"} · {script.wordCount.toLocaleString()} 字 · {script.characterCount} 位人物 · {relativeTime(script.updatedAt)}</p></div><span className="studio-pill">{script.status}</span><ArrowUpRight size={15} color="#a5b2a9"/></Link>) : <div className="studio-empty"><FileText size={32} strokeWidth={1.2}/><h3>你的第一份剧本，等你落笔</h3><p>直接在线编写，或导入已有的 TXT / Markdown 文件。内容会保存在你的工作室。</p><Link className="btn btn-secondary" href="/studio/scripts?new=1"><Plus size={14}/>创建剧本</Link></div>}</section>
    <section className="studio-section"><div className="studio-section-head"><h2><ImageIcon size={16}/>最新人物资产</h2><Link href="/studio/assets">打开资产库<ArrowRight size={14}/></Link></div>{data.recentAssets.length ? <div className="studio-asset-strip">{data.recentAssets.slice(0,6).map(asset => <Link key={asset.id} className="studio-asset-thumb" href={`/studio/assets?characterId=${asset.characterId}`}><AssetImage id={asset.id} name={asset.name}/><strong>{asset.name}</strong><small>{asset.characterName}</small></Link>)}</div> : <div className="studio-empty"><ImageIcon size={31} strokeWidth={1.2}/><h3>让笔下的人物有了模样</h3><p>创建人物档案，上传定妆照、形象参考、服装与表情图。</p><Link className="text-link studio-editor-link" href="/studio/characters">创建人物档案<ArrowRight size={14}/></Link></div>}</section></div>
    <div className="studio-side-stack"><section className="studio-section"><div className="studio-section-head"><h2>搭建你的创作流程</h2><Sparkles size={16} color="#7e9c83"/></div><div className="studio-guide"><Link href="/studio/scripts?import=1"><span>01</span><div><strong>写下故事的起点</strong><p>新建剧本，或导入已有文稿</p></div><ArrowUpRight size={15}/></Link><Link href="/studio/characters"><span>02</span><div><strong>丰富人物与视觉</strong><p>整理人物小传、外貌与参考图</p></div><ArrowUpRight size={15}/></Link><Link href="/studio/integrations"><span><KeyRound size={14}/></span><div><strong>连接你的创作 Agent</strong><p>通过 API 读写剧本和人物资产</p></div><ArrowUpRight size={15}/></Link></div></section>
    <section className="studio-section"><div className="studio-section-head"><h2>工作室动态</h2><Link href="/studio/activity"><ArrowUpRight size={15}/></Link></div>{data.activities.length ? <div className="studio-activity">{data.activities.slice(0,5).map(activity => <div className="studio-activity-item" key={activity.id}><span/><div><p><strong>{activity.actor}</strong> {activity.action}<br/>{activity.target}</p><small>{relativeTime(activity.createdAt)}</small></div></div>)}</div> : <div className="studio-empty" style={{minHeight:140}}><p>剧本、人物和资产的操作记录<br/>会从这里开始。</p></div>}</section></div></div>
    <p className="studio-bottom-note"><Clapperboard size={14}/>所有创作与资产均保存到当前工作室，外部 Agent 通过独立 API 密钥接入。</p>
  </div>;
}
