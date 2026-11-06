"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpenText, Check, CircleAlert, FileText, FolderOpen, LoaderCircle, Plus, Search, Trash2, Upload, UsersRound, X } from "lucide-react";
import { api, relativeTime } from "@/lib/client";
import type { Script, ScriptStatus } from "@/lib/studio-types";
import { ScriptDialog, scriptError, scriptStatuses, scriptStatusClass } from "./scripts-ui";
import "./scripts.css";

export function ScriptLibrary({ initialAction = "", initialQuery = "" }: { initialAction?: string; initialQuery?: string }) {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [query, setQuery] = useState(initialQuery); const [filter, setFilter] = useState<ScriptStatus | "全部">("全部");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [modal, setModal] = useState<"new" | "import" | null>(null); const [deleting, setDeleting] = useState<Script | null>(null);
  const [busy, setBusy] = useState(false); const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(""); const [title, setTitle] = useState(""); const [genre, setGenre] = useState("剧情"); const [synopsis, setSynopsis] = useState("");
  const [file, setFile] = useState<File | null>(null); const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null); const loadId = useRef(0);
  const load = useCallback(async () => {
    const id = ++loadId.current; setLoading(true); setError("");
    try { const records = await api<Script[]>("/api/studio/scripts"); if (id === loadId.current) setScripts(records); }
    catch (failure) { if (id === loadId.current) setError(scriptError(failure)); }
    finally { if (id === loadId.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { loadId.current++; }; }, [load]);
  useEffect(() => { if (initialAction === "new" || initialAction === "import") { setModal(initialAction); setFormError(""); router.replace("/studio/scripts", { scroll: false }); } }, [initialAction, router]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(timer); }, [notice]);
  function open(action: "new" | "import") { setTitle(""); setSynopsis(""); setGenre("剧情"); setFile(null); setFormError(""); setModal(action); }
  function chooseFile(selected?: File) {
    if (!selected) return;
    if (!/\.(txt|md|markdown)$/i.test(selected.name)) { setFormError("请选择 TXT 或 Markdown 文件（.txt / .md / .markdown）"); return; }
    if (selected.size > 2 * 1024 * 1024) { setFormError("文件不能超过 2 MB，请拆分后再导入"); return; }
    setFile(selected); setFormError(""); if (!title) setTitle(selected.name.replace(/\.(txt|md|markdown)$/i, "").slice(0, 120));
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setFormError("");
    try {
      let created: Script;
      if (modal === "import") {
        if (!file) throw new Error("请先选择要导入的文件");
        const data = new FormData(); data.append("file", file); if (title.trim()) data.append("title", title.trim());
        const response = await fetch("/api/studio/scripts/import", { method: "POST", body: data });
        const result = await response.json();
        if (response.status === 401) { window.location.assign("/studio/login"); return; }
        if (!response.ok) throw new Error(result.error || "导入失败，请检查文件内容");
        created = result.data;
      } else created = await api<Script>("/api/studio/scripts", { method: "POST", body: JSON.stringify({ title: title.trim(), genre, synopsis, content: "", status: "草稿" }) });
      router.push(`/studio/scripts/${created.id}`);
    } catch (failure) { setFormError(scriptError(failure)); setBusy(false); }
  }
  async function remove() {
    if (!deleting) return; setBusy(true); setFormError("");
    try { await api(`/api/studio/scripts/${deleting.id}`, { method: "DELETE" }); setScripts(current => current.filter(item => item.id !== deleting.id)); setDeleting(null); setNotice("剧本已删除，人物档案已保留"); }
    catch (failure) { setFormError(scriptError(failure)); } finally { setBusy(false); }
  }
  const shown = scripts.filter(script => (filter === "全部" || script.status === filter) && `${script.title} ${script.genre} ${script.synopsis}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="sc-library">
    {notice && <div className="sc-toast" role="status"><Check size={17}/>{notice}</div>}
    <div className="sc-page-heading"><div><span className="sc-eyebrow">THE STORY STARTS HERE</span><h1>剧本库<span>.</span></h1><p>从一闪而过的灵感，到值得讲述的故事。</p></div><div className="sc-actions"><button className="sc-button sc-secondary" onClick={() => open("import")}><Upload size={17}/>导入剧本</button><button className="sc-button sc-primary" onClick={() => open("new")}><Plus size={18}/>新建剧本</button></div></div>
    <div className="sc-library-banner"><span className="sc-banner-icon"><BookOpenText size={27} strokeWidth={1.4}/></span><div><strong>你的故事，有自己的生长节奏。</strong><p>在线创作、整理人物、汇集视觉参考，把每个故事的世界留在这里。</p></div><span className="sc-banner-number">{scripts.length.toString().padStart(2,"0")}<small>部剧本</small></span></div>
    <div className="sc-library-toolbar"><div className="sc-tabs" aria-label="筛选剧本状态">{(["全部", ...scriptStatuses] as const).map(status => <button key={status} className={filter === status ? "active" : ""} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status}<span>{status === "全部" ? scripts.length : scripts.filter(script => script.status === status).length}</span></button>)}</div><label className="sc-search"><Search size={17}/><input placeholder="搜索标题、类型或故事梗概" aria-label="搜索剧本" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button aria-label="清除搜索" onClick={() => setQuery("")}><X size={14}/></button>}</label></div>
    {loading ? <div className="sc-empty" role="status"><LoaderCircle className="spin" size={30}/><h2>正在整理你的故事</h2></div> : error ? <div className="sc-empty" role="alert"><CircleAlert size={32}/><h2>剧本库暂时无法加载</h2><p>{error}</p><button className="sc-button sc-secondary" onClick={() => void load()}>重新加载</button></div> : !shown.length ? <div className="sc-empty"><span className="sc-empty-art"><FolderOpen size={44} strokeWidth={1.2}/></span><h2>{scripts.length ? "没有找到匹配的剧本" : "下一个故事，从这里开始"}</h2><p>{scripts.length ? "试试其他关键词，或切换剧本状态。" : "新建一部剧本开始写作，也可以导入已有的 TXT / Markdown 文稿。"}</p><div className="sc-actions">{scripts.length ? <button className="sc-button sc-secondary" onClick={() => { setQuery(""); setFilter("全部"); }}>清除筛选</button> : <><button className="sc-button sc-primary" onClick={() => open("new")}><Plus size={17}/>写下第一个故事</button><button className="sc-button sc-secondary" onClick={() => open("import")}><Upload size={16}/>导入已有文稿</button></>}</div></div> : <div className="sc-script-grid">{shown.map((script, index) => <article className="sc-script-card" key={script.id}><Link href={`/studio/scripts/${script.id}`} className={`sc-card-cover sc-cover-${index % 4}`} aria-label={`打开剧本：${script.title}`}><div className="sc-cover-lines"><i/><i/><i/><i/></div><BookOpenText size={31} strokeWidth={1.2}/><span className="sc-cover-title">{script.title}</span><span className="sc-cover-label">SCREENPLAY / {script.genre || "未分类"}</span><span className={`sc-status sc-status-${scriptStatusClass[script.status]}`}>{script.status}</span></Link><div className="sc-card-body"><div className="sc-card-title"><Link href={`/studio/scripts/${script.id}`}><h2>{script.title}</h2></Link><button className="sc-icon-button sc-delete" onClick={() => { setDeleting(script); setFormError(""); }} aria-label={`删除剧本 ${script.title}`}><Trash2 size={16}/></button></div><p className="sc-card-synopsis">{script.synopsis || "故事梗概还未写下，进入剧本补充你的创作构想。"}</p><div className="sc-card-meta"><span><FileText size={14}/>{script.wordCount.toLocaleString()} 字</span><span><UsersRound size={14}/>{script.characterCount} 位角色</span></div><div className="sc-card-footer"><span>{relativeTime(script.updatedAt)}更新</span><Link href={`/studio/scripts/${script.id}`}>继续创作 <ArrowRight size={15}/></Link></div></div></article>)}</div>}
    <p className="sc-library-footnote">共 {shown.length} 部剧本 · 文稿与人物资产持续保存在你的工作空间中</p>
    {modal && <ScriptDialog title={modal === "new" ? "新建剧本" : "导入剧本"} onClose={() => setModal(null)} busy={busy}><form onSubmit={create}><div className="sc-dialog-body">{modal === "import" && <><input ref={fileInput} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" hidden disabled={busy} onChange={event => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/><button type="button" className={`sc-dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`} disabled={busy} onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) chooseFile(event.dataTransfer.files[0]); }}>{file ? <FileText size={30}/> : <Upload size={30}/>}<strong>{file ? file.name : "点击选择，或将剧本拖到这里"}</strong><span>{file ? `${(file.size / 1024).toFixed(1)} KB · 点击更换文件` : "TXT / Markdown · 最大 2 MB · 建议 UTF-8 编码"}</span></button><p className="sc-field-help">正文将作为可编辑文本导入，Markdown 标记会保留。最多 20 万字符。</p></>}
    <label className="sc-field-label">剧本名称<input className="sc-field" required maxLength={120} data-autofocus value={title} onChange={event => setTitle(event.target.value)} placeholder="为这个故事取一个名字" disabled={busy}/></label>{modal === "new" && <><label className="sc-field-label">故事类型<input className="sc-field" value={genre} maxLength={40} onChange={event => setGenre(event.target.value)} placeholder="例如：剧情、悬疑、科幻、短剧" disabled={busy}/></label><label className="sc-field-label">故事梗概 <span className="sc-optional">可选</span><textarea className="sc-field" rows={4} value={synopsis} maxLength={2000} onChange={event => setSynopsis(event.target.value)} placeholder="一句话说说，这是什么样的故事？" disabled={busy}/></label></>}{formError && <p className="sc-error" role="alert">{formError}</p>}</div><footer className="sc-dialog-footer"><button type="button" className="sc-button sc-secondary" onClick={() => setModal(null)} disabled={busy}>取消</button><button className="sc-button sc-primary" disabled={busy || (modal === "import" && !file)}>{busy ? <LoaderCircle className="spin" size={17}/> : modal === "import" ? <Upload size={17}/> : <Plus size={17}/>} {busy ? "正在保存…" : modal === "import" ? "导入并开始编辑" : "创建并开始写作"}</button></footer></form></ScriptDialog>}
    {deleting && <ScriptDialog title="删除剧本" onClose={() => setDeleting(null)} busy={busy}><div className="sc-dialog-body"><p className="sc-delete-question">确定删除「{deleting.title}」吗？</p><p className="sc-field-help">剧本正文将被永久删除。关联的人物档案和图片会保留，但会解除与这部剧本的关联。</p>{formError && <p className="sc-error" role="alert">{formError}</p>}</div><footer className="sc-dialog-footer"><button className="sc-button sc-secondary" disabled={busy} onClick={() => setDeleting(null)}>取消</button><button className="sc-button sc-danger" disabled={busy} onClick={() => void remove()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Trash2 size={16}/>}确认删除</button></footer></ScriptDialog>}
  </div>;
}
