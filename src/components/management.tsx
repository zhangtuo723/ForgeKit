"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Activity as ActivityIcon, CalendarDays, Check, CheckCircle2, CircleAlert, FileText, LoaderCircle, Search, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { api, relativeTime } from "@/lib/client";
import { useWorkspace } from "@/components/admin-shell";
import type { Activity, Settings } from "@/lib/types";
import "./management.css";

const errorText = (error: unknown) => error instanceof Error ? error.message : "请求失败，请稍后重试";

function useCollection<T>(url: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const reload = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<T[]>(url);
      if (request.current === current) setData(result);
    } catch (failure) {
      if (request.current === current) setError(errorText(failure));
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [url]);
  useEffect(() => { void reload(); return () => { request.current += 1; }; }, [reload]);
  return { data, loading, error, reload };
}

function useNotice() {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(timer);
  }, [notice]);
  return { notice, notify: setNotice };
}

function Notice({ message }: { message: string }) {
  return message ? <div className="mg-toast" role="status"><CheckCircle2 size={17} />{message}</div> : null;
}

function LoadState({ loading, error, empty, retry, children }: { loading: boolean; error: string; empty: boolean; retry: () => void; children: ReactNode }) {
  if (loading) return <div className="mg-state" role="status"><LoaderCircle className="mg-spin" size={25} /><strong>正在加载工作空间</strong><span>马上就好…</span></div>;
  if (error) return <div className="mg-state" role="alert"><CircleAlert size={28} /><strong>暂时无法加载</strong><span>{error}</span><button className="mg-button mg-button-secondary" onClick={retry}>重新加载</button></div>;
  if (empty) return <div className="mg-state"><Search size={28} /><strong>没有找到匹配的内容</strong><span>试试其他关键词，或者调整筛选条件。</span></div>;
  return children;
}

const activityTypes = [{ value: "all", label: "全部动态" }, { value: "project", label: "剧本操作" }, { value: "user", label: "人物与资产" }, { value: "system", label: "系统事件" }];
export function ActivityManager() {
  const { timezone } = useWorkspace();
  const activities = useCollection<Activity>("/api/studio/activities");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const shown = activities.data.filter(item => (type === "all" || type === item.type) && `${item.actor} ${item.action} ${item.target}`.toLowerCase().includes(query.trim().toLowerCase()));
  const dayKey = (value: string) => new Date(value).toLocaleDateString("zh-CN", { timeZone: timezone, year: "numeric", month: "long", day: "numeric", weekday: "long" });
  return <div className="mg-page"><div className="mg-page-heading"><div><span className="mg-eyebrow">ACTIVITY LOG</span><h1>操作日志</h1><p>记录剧本、人物、图片与 Agent 的每一次操作。</p></div><button className="mg-button mg-button-secondary" disabled={activities.loading} onClick={() => void activities.reload()}><ActivityIcon size={16} />刷新动态</button></div><section className="mg-panel"><div className="mg-toolbar"><div className="mg-tabs" aria-label="日志类型">{activityTypes.map(item => <button key={item.value} aria-pressed={type === item.value} className={type === item.value ? "active" : ""} onClick={() => setType(item.value)}>{item.label}</button>)}</div><label className="mg-search"><Search size={16} /><input placeholder="搜索操作内容…" aria-label="搜索日志" value={query} onChange={event => setQuery(event.target.value)} /></label></div><LoadState loading={activities.loading} error={activities.error} empty={!shown.length} retry={() => void activities.reload()}><div className="mg-activity-list">{shown.map((item, index) => {
    const Icon = item.type === "project" ? FileText : item.type === "user" ? UsersRound : Settings2;
    return <div key={item.id}>{(index === 0 || dayKey(shown[index - 1].createdAt) !== dayKey(item.createdAt)) && <div className="mg-activity-date"><CalendarDays size={14} />{dayKey(item.createdAt)}</div>}<article className="mg-activity-item"><span className={`mg-activity-icon mg-activity-${item.type}`}><Icon size={17} /></span><div><p><strong>{item.actor}</strong><span>{item.action}</span><b>{item.target}</b></p><span className="mg-activity-kind">{activityTypes.find(activityType => activityType.value === item.type)?.label}<i />{new Date(item.createdAt).toLocaleTimeString("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit" })}</span></div><time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time></article></div>;
  })}</div><div className="mg-list-footer"><span>显示最近 {shown.length} 条记录</span><span>日志由系统自动记录</span></div></LoadState></section></div>;
}

export function SettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { notice, notify } = useNotice();
  const load = useCallback(async () => { setLoading(true); setError(""); try { const result = await api<Settings>("/api/studio/settings"); setSettings(result); setSaved(result); } catch (failure) { setError(errorText(failure)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!settings) return; setBusy(true); setError(""); try { const result = await api<Settings>("/api/studio/settings", { method: "PATCH", body: JSON.stringify(settings) }); setSettings(result); setSaved(result); notify("工作空间设置已保存"); window.dispatchEvent(new Event("workspace-settings-updated")); } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); } }
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  return <div className="mg-page"><Notice message={notice} /><div className="mg-page-heading"><div><span className="mg-eyebrow">WORKSPACE SETTINGS</span><h1>系统设置</h1><p>让工作空间，更符合你的工作方式。</p></div><span className="mg-settings-status"><span className="mg-dot" />{dirty ? "有未保存的修改" : "设置已同步"}</span></div><LoadState loading={loading} error={!settings ? error : ""} empty={false} retry={() => void load()}>{settings && <form onSubmit={save} className="mg-settings-layout"><section className="mg-panel mg-settings-panel"><div className="mg-section-heading"><span className="mg-summary-icon"><Settings2 size={20} /></span><div><h2>工作空间</h2><p>管理工作空间的基本信息与显示偏好。</p></div></div><div className="mg-workspace-identity"><div className="mg-workspace-logo">{settings.workspaceName.slice(0, 1).toUpperCase() || "F"}<i /></div><div><strong>{settings.workspaceName || "你的工作空间"}</strong><span>属于你的剧本创作工作室</span></div><span className="mg-workspace-badge">WORKSPACE</span></div><div className="mg-settings-fields"><label className="mg-field">工作空间名称 <em>*</em><input required maxLength={60} value={settings.workspaceName} onChange={event => setSettings({ ...settings, workspaceName: event.target.value })} /><span className="mg-field-help">显示在系统侧边栏和工作空间信息中。</span></label><label className="mg-field">工作空间描述<textarea rows={3} maxLength={300} value={settings.workspaceDescription} onChange={event => setSettings({ ...settings, workspaceDescription: event.target.value })} placeholder="用一句话介绍这个工作空间…" /></label><div className="mg-form-grid"><label className="mg-field">联系邮箱 <em>*</em><input type="email" required maxLength={120} value={settings.contactEmail} onChange={event => setSettings({ ...settings, contactEmail: event.target.value })} /></label><label className="mg-field">工作空间时区<select value={settings.timezone} onChange={event => setSettings({ ...settings, timezone: event.target.value })}><option value="Asia/Shanghai">中国标准时间 · UTC+8</option><option value="Asia/Tokyo">日本标准时间 · UTC+9</option><option value="Europe/London">伦敦 · Europe/London</option><option value="America/New_York">纽约 · America/New_York</option><option value="UTC">协调世界时 · UTC</option></select></label></div>{error && <p className="mg-form-error" role="alert"><CircleAlert size={15} />{error}</p>}</div><div className="mg-settings-footer"><span>{dirty ? "修改将在保存后生效" : "所有修改均已保存"}</span><div><button type="button" className="mg-button mg-button-secondary" disabled={busy || !dirty} onClick={() => { setSettings(saved); setError(""); }}>撤销修改</button><button className="mg-button mg-button-primary" disabled={busy || !dirty}>{busy ? <LoaderCircle size={16} className="mg-spin" /> : <Check size={16} />}{busy ? "正在保存" : "保存设置"}</button></div></div></section><aside className="mg-settings-aside"><section className="mg-panel mg-account-card"><span className="mg-account-icon"><ShieldCheck size={26} /></span><h3>管理员访问</h3><p>当前使用固定管理员账号管理剧本、人物与资产。外部 Agent 使用独立 API 密钥接入。</p><div><span>登录账号</span><strong>admin</strong></div><div><span>身份</span><span className="mg-role mg-role-admin">系统管理员</span></div><div><span>登录方式</span><strong>账号与密码</strong></div></section><section className="mg-settings-note"><span>让信息保持一致</span><p>工作空间时区用于日志和日期显示。API 密钥可以在 Agent API 页面创建与撤销。</p></section></aside></form>}</LoadState></div>;
}

