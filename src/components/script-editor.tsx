"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlignLeft, ArrowDownToLine, ArrowLeft, ArrowUpRight, BookOpenText, Check, ChevronDown, CircleAlert, Cloud, FileText, LoaderCircle, MessageSquare, PanelRightClose, PanelRightOpen, Plus, RotateCcw, Save, ScanLine, UsersRound } from "lucide-react";
import { api } from "@/lib/client";
import type { Character, Script, ScriptStatus } from "@/lib/studio-types";
import { useWorkspace } from "./admin-shell";
import { downloadText, scriptError, scriptStatuses } from "./scripts-ui";
import { AssetImage } from "./asset-image";
import { ListPagination, useStudioList } from "./studio-list";
import "./scripts.css";

type Draft = Pick<Script, "title" | "synopsis" | "genre" | "status" | "content">;
type LocalDraft = { revision: number; draft: Draft; savedAt: string };
type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
const fields = (script: Script): Draft => ({ title: script.title, synopsis: script.synopsis, genre: script.genre, status: script.status, content: script.content });
const packed = (draft: Draft | null) => JSON.stringify(draft);
const isDraft = (value: unknown): value is Draft => {
  if (!value || typeof value !== "object") return false;
  const item = value as Draft;
  return typeof item.title === "string" && typeof item.synopsis === "string" && typeof item.genre === "string" && typeof item.content === "string" && item.content.length <= 200000 && scriptStatuses.includes(item.status);
};

export function ScriptEditor({ id }: { id: string }) {
  const { timezone } = useWorkspace();
  const [script, setScript] = useState<Script | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved"); const [saveError, setSaveError] = useState("");
  const [recovery, setRecovery] = useState<LocalDraft | null>(null); const [localWarning, setLocalWarning] = useState("");
  const { items: characters, pagination: characterPagination, error: characterError, loading: charactersLoading, reload: loadCharacters, setPage: setCharacterPage } = useStudioList<Character>("/api/studio/characters", { scriptId: id }, 6);
  const [details, setDetails] = useState(true); const [exporting, setExporting] = useState(false); const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const draftRef = useRef<Draft | null>(null); const savedRef = useRef(""); const revision = useRef(0);
  const inFlight = useRef(false); const blocked = useRef<"none" | "error" | "conflict">("none");
  const mounted = useRef(true); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSequence = useRef(0);
  const saveRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const recoveryRef = useRef(false); const textarea = useRef<HTMLTextAreaElement>(null); const exportMenu = useRef<HTMLDivElement>(null);
  const storageKey = `forge-script-draft:${id}`;
  function storeLocal(value: Draft) {
    try { localStorage.setItem(storageKey, JSON.stringify({ revision: revision.current, draft: value, savedAt: new Date().toISOString() } satisfies LocalDraft)); }
    catch { setLocalWarning("浏览器无法保存本地备份，请及时保存到工作空间或导出文稿。"); }
  }
  function clearLocalIfMatching(value: Draft) {
    try { const raw = localStorage.getItem(storageKey); if (raw && packed(JSON.parse(raw).draft) === packed(value)) localStorage.removeItem(storageKey); } catch { /* A failed local cleanup does not affect the server save. */ }
  }
  const load = useCallback(async (ignoreLocal = false) => {
    const sequence = ++loadSequence.current;
    const priorDraft = draftRef.current;
    setLoading(true); setLoadError("");
    try {
      const current = await api<Script>(`/api/studio/scripts/${id}`);
      if (!mounted.current || sequence !== loadSequence.current) return;
      if (ignoreLocal && priorDraft) clearLocalIfMatching(priorDraft);
      const value = fields(current);
      revision.current = current.revision; savedRef.current = packed(value); draftRef.current = value;
      blocked.current = "none"; setScript(current); setDraft(value); setSaveState("saved"); setSaveError(""); setRecovery(null); recoveryRef.current = false;
      if (!ignoreLocal) {
        try {
          const raw = localStorage.getItem(storageKey);
          const local: LocalDraft | null = raw ? JSON.parse(raw) : null;
          if (local && isDraft(local.draft) && typeof local.revision === "number" && packed(local.draft) !== packed(value)) { setRecovery(local); recoveryRef.current = true; }
        } catch { setLocalWarning("本地备份无法读取，当前显示服务器保存的文稿。"); }
      }
    } catch (failure) {
      if (mounted.current && sequence === loadSequence.current) {
        if (ignoreLocal && priorDraft) setSaveError(`载入最新版本失败：${scriptError(failure)}。当前草稿仍保留，可以先导出备份。`);
        else setLoadError(scriptError(failure));
      }
    }
    finally { if (mounted.current && sequence === loadSequence.current) setLoading(false); }
  }, [id, storageKey]);

  const save = useCallback(async (force = false) => {
    if (timer.current) clearTimeout(timer.current);
    if (!draftRef.current || inFlight.current || recoveryRef.current || blocked.current === "conflict" || (!force && blocked.current === "error")) return;
    const snapshot = { ...draftRef.current };
    if (packed(snapshot) === savedRef.current) { setSaveState("saved"); return; }
    if (!snapshot.title.trim()) { setSaveError("请先填写剧本名称，正文已保留在本地草稿。"); setSaveState("error"); blocked.current = "error"; return; }
    inFlight.current = true; blocked.current = "none"; setSaveState("saving"); setSaveError("");
    try {
      const response = await fetch(`/api/studio/scripts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, revision: revision.current }) });
      const body = await response.json();
      if (response.status === 401) { window.location.assign("/studio/login"); throw new Error("登录已失效，本地草稿已保留，请重新登录"); }
      if (response.status === 409) { blocked.current = "conflict"; if (mounted.current) { setSaveState("conflict"); setSaveError("这部剧本已在其他页面或 Agent 中更新。自动保存已暂停，请先导出当前草稿，再载入最新版本。"); } return; }
      if (!response.ok) throw new Error(body.error || "保存失败，请重试");
      const result = body.data as Script;
      revision.current = result.revision; savedRef.current = packed(snapshot);
      const current = draftRef.current;
      if (mounted.current) setScript(result);
      if (packed(current) === packed(snapshot)) {
        clearLocalIfMatching(snapshot);
        if (mounted.current) setSaveState("saved");
      } else if (mounted.current) {
        setSaveState("dirty");
        // Changes typed during a request must use the returned revision on their next save.
        if (current) storeLocal(current);
        timer.current = setTimeout(() => { void saveRef.current(); }, 800);
      }
    } catch (failure) {
      blocked.current = "error";
      if (mounted.current) { setSaveState("error"); setSaveError(scriptError(failure)); }
    } finally { inFlight.current = false; }
  // Local backup helpers use only this script's immutable storage key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, storageKey]);
  saveRef.current = save;

  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; loadSequence.current++; if (timer.current) clearTimeout(timer.current); };
  }, [load]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) { if (draftRef.current && packed(draftRef.current) !== savedRef.current) { event.preventDefault(); event.returnValue = ""; } }
    function key(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveRef.current(true); } if (event.key === "Escape") setExportOpen(false); }
    function click(event: MouseEvent) {
      if (exportMenu.current && !exportMenu.current.contains(event.target as Node)) setExportOpen(false);
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.hasAttribute("download") || target.target === "_blank" || !draftRef.current || packed(draftRef.current) === savedRef.current) return;
      if (!window.confirm("还有修改未保存到工作空间。离开后可从本地草稿恢复，确定离开吗？")) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener("beforeunload", beforeUnload); document.addEventListener("keydown", key); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("keydown", key); document.removeEventListener("click", click, true); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);

  function change(patch: Partial<Draft>) {
    if (!draftRef.current) return;
    const next = { ...draftRef.current, ...patch }; draftRef.current = next; setDraft(next); storeLocal(next);
    if (timer.current) clearTimeout(timer.current);
    if (blocked.current === "conflict") return;
    blocked.current = "none"; setSaveError("");
    setSaveState(inFlight.current ? "saving" : packed(next) === savedRef.current ? "saved" : "dirty");
    timer.current = setTimeout(() => { void saveRef.current(); }, 1200);
  }
  function restore() {
    if (!recovery) return;
    const older = recovery.revision !== revision.current;
    recoveryRef.current = false; setRecovery(null);
    if (older) {
      draftRef.current = recovery.draft; setDraft(recovery.draft); blocked.current = "conflict"; setSaveState("conflict");
      setSaveError("已打开本地草稿，但服务器版本已改变。请导出草稿后载入最新版本，再合并需要的内容。");
    } else change(recovery.draft);
  }
  function discardRecovery() {
    if (recovery) clearLocalIfMatching(recovery.draft);
    recoveryRef.current = false; setRecovery(null);
  }
  async function reloadServer() {
    if (inFlight.current) return;
    if (!window.confirm("载入最新版本会替换编辑区内容。建议先导出当前草稿，确定继续吗？")) return;
    if (timer.current) clearTimeout(timer.current);
    await load(true);
  }
  function insert(kind: "scene" | "dialogue" | "action") {
    if (!draftRef.current || !textarea.current || recoveryRef.current) return;
    const target = textarea.current; const start = target.selectionStart, end = target.selectionEnd;
    const text = kind === "scene" ? "\n\n场景 01｜地点｜日 / 内\n" : kind === "dialogue" ? "\n人物名\n（语气 / 动作）\n对白内容\n" : "\n△ 动作、环境与人物反应。\n";
    const next = draftRef.current.content.slice(0, start) + text + draftRef.current.content.slice(end);
    if (next.length > 200000) { setNotice("正文已达到 20 万字符上限，请拆分剧本。"); return; }
    change({ content: next });
    requestAnimationFrame(() => { target.focus(); target.setSelectionRange(start + text.length, start + text.length); });
  }
  async function exportFile(format: "txt" | "md") {
    if (!draftRef.current) return;
    setExportOpen(false); setExporting(true);
    try {
      const current = draftRef.current;
      if (packed(current) !== savedRef.current) { downloadText(current.content, current.title, format); setNotice("已导出当前编辑区草稿，包含尚未保存的修改"); }
      else {
        const response = await fetch(`/api/studio/scripts/${id}/export?format=${format}`);
        if (!response.ok) { const result = await response.json().catch(() => null); throw new Error(result?.error || "导出失败，请稍后重试"); }
        downloadText(await response.text(), current.title, format); setNotice("剧本已导出");
      }
    } catch (failure) { setNotice(scriptError(failure)); } finally { setExporting(false); }
  }
  if (loading) return <div className="sc-empty" role="status"><LoaderCircle className="spin" size={30}/><h2>正在打开你的故事</h2></div>;
  if (loadError || !draft || !script) return <div className="sc-empty" role="alert"><CircleAlert size={32}/><h2>暂时无法打开剧本</h2><p>{loadError || "剧本不存在或已被删除"}</p><div className="sc-actions"><button className="sc-button sc-secondary" onClick={() => void load()}>重新加载</button><Link className="sc-button sc-primary" href="/studio/scripts">返回剧本库</Link></div></div>;
  const wordCount = draft.content.replace(/\s/g, "").length;
  const time = new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(script.updatedAt));
  const saveLabel = { saved: "已保存", dirty: "等待保存…", saving: "正在保存…", error: "保存失败", conflict: "版本冲突" }[saveState];
  return <div className="sc-editor-page">
    {notice && <div className="sc-toast" role="status">{notice}</div>}
    <header className="sc-editor-heading"><div className="sc-editor-breadcrumb"><Link href="/studio/scripts" className="sc-back"><ArrowLeft size={17}/><span>剧本库</span></Link><span className="sc-slash">/</span><h1>{draft.title || "未命名剧本"}</h1></div><div className="sc-actions"><span className={`sc-save-state sc-save-${saveState}`} role="status">{saveState === "saving" ? <LoaderCircle size={15} className="spin"/> : saveState === "saved" ? <Cloud size={16}/> : <CircleAlert size={15}/>} {saveLabel}</span><div className="sc-export" ref={exportMenu}><button className="sc-button sc-secondary" disabled={exporting} onClick={() => setExportOpen(value => !value)} aria-expanded={exportOpen}><ArrowDownToLine size={16}/><span>导出</span><ChevronDown size={13}/></button>{exportOpen && <div className="sc-export-menu"><button onClick={() => void exportFile("txt")}><FileText size={15}/>导出 TXT</button><button onClick={() => void exportFile("md")}><FileText size={15}/>导出 Markdown</button></div>}</div><button className="sc-button sc-primary" disabled={saveState === "saving" || saveState === "saved" || saveState === "conflict" || !!recovery} onClick={() => void save(true)}><Save size={16}/><span>保存</span></button></div></header>
    {recovery && <div className="sc-recovery" role="alert"><RotateCcw size={20}/><div><strong>发现尚未提交的本地草稿</strong><p>{recovery.revision === revision.current ? "可以恢复上次离开时的修改，或继续使用服务器版本。" : "服务器版本已更新。可打开本地草稿查看、导出，再手动合并。"}</p></div><button className="sc-button sc-secondary" onClick={() => downloadText(recovery.draft.content, recovery.draft.title, "txt")}>导出备份</button><button className="sc-button sc-secondary" onClick={discardRecovery}>使用服务器版本</button><button className="sc-button sc-primary" onClick={restore}>打开本地草稿</button></div>}
    {saveError && <div className={`sc-save-alert ${saveState === "conflict" ? "conflict" : ""}`} role="alert"><CircleAlert size={19}/><p>{saveError}</p>{saveState === "conflict" ? <><button className="sc-button sc-secondary" onClick={() => void exportFile("txt")}>导出当前草稿</button><button className="sc-button sc-secondary" onClick={() => void reloadServer()}>载入最新版本</button></> : <button className="sc-button sc-secondary" onClick={() => void save(true)}>重试保存</button>}</div>}
    {localWarning && <p className="sc-warning" role="alert">{localWarning}</p>}
    <div className={`sc-editor-layout ${details ? "" : "sc-editor-focused"}`}>
      <section className="sc-writing-room"><div className="sc-writing-toolbar"><div><span className="sc-toolbar-label"><BookOpenText size={16}/>文稿</span><span className="sc-toolbar-divider"/><button onClick={() => insert("scene")} disabled={!!recovery} title="在光标处插入场景标题"><ScanLine size={15}/><span>场景</span></button><button onClick={() => insert("dialogue")} disabled={!!recovery} title="在光标处插入对白模板"><MessageSquare size={15}/><span>对白</span></button><button onClick={() => insert("action")} disabled={!!recovery} title="在光标处插入动作描述"><AlignLeft size={15}/><span>动作</span></button></div><button aria-label={details ? "收起剧本资料" : "展开剧本资料"} onClick={() => setDetails(value => !value)}>{details ? <PanelRightClose size={17}/> : <PanelRightOpen size={17}/>}</button></div><div className="sc-manuscript"><div className="sc-manuscript-kicker"><span>SCREENPLAY</span><i/></div><input className="sc-manuscript-title" aria-label="剧本名称" value={draft.title} maxLength={120} disabled={!!recovery} onChange={event => change({ title: event.target.value })} placeholder="写下故事的名字"/><div className="sc-manuscript-byline"><span>{draft.genre || "未分类"}</span><i/>剧本文稿</div><textarea ref={textarea} className="sc-manuscript-text" aria-label="剧本正文" value={draft.content} maxLength={200000} disabled={!!recovery} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => change({ content: event.target.value })} placeholder={"场景 01｜地点｜日 / 内\n\n△ 写下第一个画面，让故事从这里开始。\n\n人物名\n（语气 / 动作）\n第一句对白……"} spellCheck={false}/></div><footer className="sc-writing-footer"><span>{wordCount.toLocaleString()} 字<span className="sc-footer-sep">·</span>{draft.content.length.toLocaleString()} / 200,000 字符</span><span>自动保存<span className="sc-footer-sep">·</span><kbd>Ctrl S</kbd> 手动保存</span></footer></section>
      {details && <aside className="sc-editor-aside"><section className="sc-detail-panel"><div className="sc-detail-heading"><h2>剧本资料</h2><span>DETAILS</span></div><label className="sc-field-label">创作状态<select className="sc-field" disabled={!!recovery} value={draft.status} onChange={event => change({ status: event.target.value as ScriptStatus })}>{scriptStatuses.map(status => <option key={status}>{status}</option>)}</select></label><label className="sc-field-label">故事类型<input className="sc-field" disabled={!!recovery} maxLength={40} placeholder="剧情 / 悬疑 / 科幻…" value={draft.genre} onChange={event => change({ genre: event.target.value })}/></label><label className="sc-field-label">故事梗概<textarea className="sc-field" disabled={!!recovery} rows={5} maxLength={2000} placeholder="记录故事的核心冲突与创作方向。" value={draft.synopsis} onChange={event => change({ synopsis: event.target.value })}/></label><dl className="sc-script-info"><div><dt>最近保存</dt><dd>{time}</dd></div><div><dt>保存版本</dt><dd>v{script.revision}</dd></div>{script.sourceName && <div><dt>导入文件</dt><dd title={script.sourceName}>{script.sourceName}</dd></div>}</dl></section><section className="sc-detail-panel"><div className="sc-detail-heading"><h2><UsersRound size={17}/>关联人物 <b>{characterPagination.total}</b></h2><button className="sc-icon-button" onClick={() => void loadCharacters()} aria-label="刷新关联人物"><RotateCcw size={14}/></button></div>{charactersLoading ? <p role="status">正在读取关联人物…</p> : characterError ? <p className="sc-error">{characterError}</p> : characters.length ? <div className="sc-character-list">{characters.map(character => <Link key={character.id} href={`/studio/characters?scriptId=${id}&characterId=${character.id}`}><span className="sc-character-avatar">{character.coverAssetId ? <AssetImage id={character.coverAssetId} name={character.name}/> : character.name.slice(0,1)}</span><span><strong>{character.name}</strong><small>{character.role || "角色设定待完善"} · {character.assetCount} 张参考图</small></span><ArrowUpRight size={14}/></Link>)}</div> : <div className="sc-characters-empty"><UsersRound size={27} strokeWidth={1.2}/><p>故事中的人，还在等你落笔。</p><span>创建人物档案，并为他们添加形象参考。</span></div>}{characterPagination.totalPages > 1 && <ListPagination pagination={characterPagination} disabled={charactersLoading} onPage={setCharacterPage}/>}<Link className="sc-add-character" href={`/studio/characters?scriptId=${id}`}><Plus size={15}/>管理人物与参考图</Link></section><div className="sc-writing-note"><span>✦</span><p>好的故事，始于一个<br/>值得被看见的人物。</p><small>KEEP THE STORY GOING</small></div></aside>}
    </div>
  </div>;
}
