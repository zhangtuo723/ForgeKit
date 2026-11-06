"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Activity as ActivityIcon, ArrowRight, Bell, Blocks, ChevronDown, ChevronRight, Command, FilePenLine, ImageIcon, KeyRound, LayoutDashboard, LogOut, Menu, Search, Settings2, UsersRound, X, Clapperboard } from "lucide-react";
import { api, relativeTime } from "@/lib/client";
import type { Activity, SessionUser, Settings } from "@/lib/types";

const navigation = [
  { href: "/studio/dashboard", label: "创作工作台", en: "Dashboard", icon: LayoutDashboard },
  { href: "/studio/scripts", label: "我的剧本", en: "Scripts", icon: FilePenLine },
  { href: "/studio/characters", label: "人物档案", en: "Characters", icon: UsersRound },
  { href: "/studio/assets", label: "人物资产库", en: "Assets", icon: ImageIcon },
  { href: "/studio/integrations", label: "Agent API", en: "Integration API keys", icon: KeyRound },
  { href: "/studio/activity", label: "操作日志", en: "Activity", icon: ActivityIcon },
  { href: "/studio/settings", label: "系统设置", en: "Settings", icon: Settings2 },
];

const WorkspaceContext = createContext<Settings>({ workspaceName: "Forge Admin", workspaceDescription: "", contactEmail: "", timezone: "Asia/Shanghai" });
export function useWorkspace() { return useContext(WorkspaceContext); }

export function AdminShell({ children, user, initialSettings }: { children: React.ReactNode; user: SessionUser; initialSettings: Settings }) {
  const pathname = usePathname(); const router = useRouter();
  const [mobile, setMobile] = useState(false); const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState(false); const [activities, setActivities] = useState<Activity[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [settings, setSettings] = useState(initialSettings); const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null); const notificationRef = useRef<HTMLDivElement>(null);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = navigation.find(n => isActive(n.href)) ?? navigation[0];
  useEffect(() => { setMobile(false); setQuery(""); setNotifications(false); }, [pathname]);
  useEffect(() => {
    function refreshSettings() { api<Settings>("/api/studio/settings").then(setSettings).catch(() => {}); }
    function keys(e: KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); } if (e.key === "Escape") { setQuery(""); setNotifications(false); setMobile(false); } }
    function outside(e: MouseEvent) { if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotifications(false); }
    document.addEventListener("keydown", keys); document.addEventListener("mousedown", outside);
    window.addEventListener("workspace-settings-updated", refreshSettings);
    return () => { document.removeEventListener("keydown", keys); document.removeEventListener("mousedown", outside); window.removeEventListener("workspace-settings-updated", refreshSettings); };
  }, []);
  async function toggleNotifications() {
    const next = !notifications; setNotifications(next);
    if (next) { setNotificationError(""); try { setActivities(await api<Activity[]>("/api/studio/activities")); } catch { setNotificationError("动态加载失败，请稍后重试"); } }
  }
  async function logout() {
    setLoggingOut(true); setLogoutError("");
    try { await api("/api/studio/auth/logout", { method: "POST" }); window.location.assign("/studio/login"); }
    catch (e) { setLogoutError(e instanceof Error ? e.message : "退出失败"); setLoggingOut(false); }
  }
  const results = navigation.filter(n => `${n.label} ${n.en}`.toLowerCase().includes(query.toLowerCase()));
  return <WorkspaceContext.Provider value={settings}><div className="app-shell">
    <a href="#main-content" className="skip-link">跳转到主要内容</a>
    {mobile && <button className="sidebar-scrim" onClick={() => setMobile(false)} aria-label="关闭导航"/>}
    <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
      <Link href="/studio/dashboard" className="sidebar-brand"><span className="brand-symbol studio-brand-mark"><Clapperboard size={21}/></span><div>幕间<span className="brand-light"> Studio</span><small>故事的幕后工作室</small></div></Link>
      <Link href="/" className="workspace-switch" aria-label="返回 ForgeKit 模块入口"><span className="workspace-icon"><Blocks size={19}/></span><div>{settings.workspaceName}<small>返回模块入口</small></div><span className="workspace-badge">STUDIO</span></Link>
      <div className="nav-label">工作空间 <span>WORKSPACE</span></div>
      <nav className="side-nav" aria-label="主导航">{navigation.slice(0,4).map(item => <Link key={item.href} href={item.href} className={`nav-link ${isActive(item.href) ? "active" : ""}`} aria-current={isActive(item.href) ? "page" : undefined}><item.icon size={19}/><span>{item.label}</span>{isActive(item.href) && <span className="nav-dot"/>}</Link>)}</nav>
      <div className="nav-label nav-label-system">工作室 <span>STUDIO</span></div><nav className="side-nav" aria-label="系统导航">{navigation.slice(4).map(item => <Link key={item.href} href={item.href} className={`nav-link ${isActive(item.href) ? "active" : ""}`} aria-current={isActive(item.href) ? "page" : undefined}><item.icon size={19}/><span>{item.label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Clapperboard size={20}/></span><strong>每个故事，都值得落笔。</strong><p>从一行文字，到一个鲜活世界。</p><Link href="/studio/scripts?new=1">开启新的故事 <ArrowRight size={14}/></Link></div>
        <div className="sidebar-user"><div className="avatar avatar-admin">A</div><div><strong>{user.name}</strong><small>系统管理员</small></div><button className="icon-button logout-button" aria-label="退出登录" title="退出登录" onClick={logout} disabled={loggingOut}><LogOut size={17}/></button></div>{logoutError && <p role="alert" className="form-error">{logoutError}</p>}
      </div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="打开导航" onClick={() => setMobile(true)}><Menu size={21}/></button><span className="breadcrumb-home">工作空间</span><ChevronRight size={14}/><span>{current.label}</span></div>
      <div className="topbar-right"><div className="global-search"><Search size={16}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索页面…" aria-label="搜索页面" onKeyDown={e => { if (e.key === "Enter" && results[0]) { router.push(results[0].href); setQuery(""); } }}/><kbd><Command size={10}/> K</kbd>{query && <div className="search-results">{results.length ? results.map(n => <Link href={n.href} key={n.href} onClick={() => setQuery("")}><n.icon size={17}/>{n.label}<ChevronRight size={14}/></Link>) : <p>没有找到相关页面</p>}</div>}</div>
        <div ref={notificationRef} className="notification-wrap"><button className={`icon-button notification-button ${notifications ? "selected" : ""}`} onClick={toggleNotifications} aria-label="查看最近动态" aria-expanded={notifications}><Bell size={19}/></button>{notifications && <div className="notification-popover"><div className="popover-title"><strong>最近动态</strong><button className="icon-button" onClick={() => setNotifications(false)} aria-label="关闭动态"><X size={15}/></button></div>{notificationError ? <p className="muted">{notificationError}</p> : activities.slice(0,4).map(a => <div className="notification-item" key={a.id}><span className="status-dot"/><div><p>{a.actor} {a.action} {a.target}</p><small>{relativeTime(a.createdAt)}</small></div></div>)}{!notificationError && !activities.length && <p className="muted">暂无动态</p>}<Link href="/studio/activity" className="popover-more">查看全部日志 <ArrowRight size={14}/></Link></div>}</div>
        <span className="topbar-divider"/><Link href="/studio/settings" className="topbar-profile"><span className="avatar avatar-admin small">A</span><span>{user.name}</span><ChevronDown size={14}/></Link>
      </div></header>
      <main id="main-content" className="main-content">{children}</main><footer className="app-footer"><span>© {new Date().getFullYear()} 幕间 Studio · 让故事有迹可循</span><span><span className="status-dot"/> 创作工作空间 <span className="footer-version">v2.0</span></span></footer>
    </div>
  </div></WorkspaceContext.Provider>;
}
