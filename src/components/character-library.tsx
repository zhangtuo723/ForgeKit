"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpRight, BookOpen, Check, CheckCircle2, CircleAlert, ClipboardPaste, ImagePlus, Images, LoaderCircle, Pencil, Plus, Search, Sparkles, Star, Trash2, UploadCloud, UserRound, UsersRound, X } from "lucide-react";
import { api, relativeTime } from "@/lib/client";
import type { Character, CharacterAsset, Script } from "@/lib/studio-types";
import { AssetImage, assetUrl } from "./asset-image";
import "./characters.css";

export { AssetImage, assetUrl } from "./asset-image";
export const assetError = (error: unknown) => error instanceof Error ? error.message : "操作失败，请稍后重试";
export const fileSize = (size: number) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;

export function useAssetNotice() {
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(timer); }, [notice]);
  return { notice, notify: setNotice };
}

export function AssetNotice({ message }: { message: string }) { return message ? <div className="ch-toast" role="status"><CheckCircle2 size={18}/>{message}</div> : null; }
export function AssetError({ message }: { message: string }) { return message ? <div className="ch-error" role="alert"><CircleAlert size={17}/><span>{message}</span></div> : null; }

export function StudioDialog({ title, description, children, onClose, busy = false, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const titleId = useId(); const descId = useId(); const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    (ref.current?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea") || ref.current)?.focus();
    function keyboard(event: KeyboardEvent) {
      const all = document.querySelectorAll(".ch-dialog"); if (all[all.length - 1] !== ref.current) return;
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(item => item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === ref.current)) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (document.activeElement === items[items.length - 1] || document.activeElement === ref.current)) { event.preventDefault(); items[0].focus(); }
    }
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keyboard); prior?.focus(); };
  }, []);
  return <div className="ch-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><div className={`ch-dialog ${wide ? "ch-dialog-wide" : ""}`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}><div className="ch-dialog-head"><div><h2 id={titleId}>{title}</h2>{description && <p id={descId}>{description}</p>}</div><button className="ch-icon" aria-label="关闭弹窗" onClick={onClose} disabled={busy}><X size={20}/></button></div>{children}</div></div>;
}

export function AssetUpload({ characterId, onUploaded, onBusy }: { characterId: string; onUploaded: () => void | Promise<void>; onBusy?: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const [readingClipboard, setReadingClipboard] = useState(false); const [clipboardError, setClipboardError] = useState("");
  const [progress, setProgress] = useState(""); const [failures, setFailures] = useState<string[]>([]); const [success, setSuccess] = useState(0);
  const lock = useRef(false);
  async function upload(files: File[]) {
    if (!files.length || lock.current) return;
    lock.current = true; setBusy(true); onBusy?.(true); setFailures([]); setSuccess(0); setClipboardError("");
    const failed: string[] = []; let count = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]; setProgress(`正在上传 ${i + 1} / ${files.length} · ${file.name}`);
        try {
          if (file.size > 10 * 1024 * 1024) throw new Error("超过 10 MB 限制");
          if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error("仅支持 PNG、JPG 和 WebP");
          const body = new FormData(); body.set("file", file); body.set("characterId", characterId);
          const response = await fetch("/api/studio/assets", { method: "POST", body });
          const result = await response.json().catch(() => ({ error: "服务响应异常" }));
          if (response.status === 401) window.location.assign("/studio/login");
          if (!response.ok) throw new Error(result.error || "上传失败");
          count++; setSuccess(count);
        } catch (failure) { failed.push(`${file.name}：${assetError(failure)}`); setFailures([...failed]); }
      }
      if (count) await onUploaded();
    } catch (failure) { failed.push(`刷新列表失败：${assetError(failure)}`); setFailures([...failed]); }
    finally { setProgress(""); setBusy(false); onBusy?.(false); lock.current = false; }
  }
  const clipboardTypes = ["image/png", "image/jpeg", "image/webp"];
  function clipboardFile(blob: Blob, type: string, index: number) {
    const extension = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
    return new File([blob], `clipboard-${Date.now()}-${index + 1}.${extension}`, { type });
  }
  function paste(event: ClipboardEvent<HTMLDivElement>) {
    // Only this focused upload area handles paste; text fields keep normal paste.
    let items = Array.from(event.clipboardData.files);
    if (!items.length) items = Array.from(event.clipboardData.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => file !== null);
    const images = items.filter(file => file.type.startsWith("image/"));
    if (!images.length) return;
    event.preventDefault();
    if (lock.current) return;
    const supported = images.filter(file => clipboardTypes.includes(file.type));
    if (!supported.length) { setClipboardError("粘贴的图片格式不支持，请使用 PNG、JPG、WebP 图片，或选择图片文件。"); return; }
    void upload(supported.map((file, index) => clipboardFile(file, file.type, index)));
  }
  async function readClipboard() {
    if (lock.current) return;
    setClipboardError("");
    if (!navigator.clipboard?.read) { setClipboardError("此浏览器暂不支持直接读取剪贴板。请在上传区域按 Ctrl+V（Mac 为 ⌘V），或选择图片文件。"); return; }
    lock.current = true; setReadingClipboard(true); onBusy?.(true);
    const files: File[] = [];
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        // One representation per item avoids uploading the same image twice.
        const type = clipboardTypes.find(candidate => item.types.includes(candidate));
        if (type) files.push(clipboardFile(await item.getType(type), type, files.length));
      }
      if (!files.length) setClipboardError("剪贴板中没有可上传的图片。请先复制截图或 PNG、JPG、WebP 图片，再点击粘贴。");
    } catch {
      files.length = 0;
      setClipboardError("无法读取剪贴板，可能尚未获得浏览器授权。请在上传区域按 Ctrl+V（Mac 为 ⌘V），或选择图片文件。");
    } finally { lock.current = false; setReadingClipboard(false); onBusy?.(false); }
    if (files.length) await upload(files);
  }
  const occupied = busy || readingClipboard;
  return <div className="ch-upload-area" tabIndex={0} onPaste={paste} aria-label="人物图片上传区域，可按 Ctrl+V 粘贴图片"><input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple hidden onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} disabled={occupied}/><button type="button" className={`ch-dropzone ${drag ? "dragging" : ""}`} disabled={occupied} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); if (!occupied) setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={event => { event.preventDefault(); setDrag(false); if (!occupied) void upload(Array.from(event.dataTransfer.files)); }}>{occupied ? <LoaderCircle size={26} className="ch-spin"/> : <UploadCloud size={29}/>}<strong>{readingClipboard ? "正在读取剪贴板图片" : busy ? "正在保存人物资产" : "点击上传，或将图片拖到这里"}</strong><span>{busy ? progress : "支持多张 PNG、JPG、WebP，每张不超过 10 MB"}</span></button><div className="ch-clipboard-row"><button type="button" className="ch-button ch-button-light" onClick={() => void readClipboard()} disabled={occupied}>{readingClipboard ? <LoaderCircle className="ch-spin" size={16}/> : <ClipboardPaste size={16}/>}粘贴图片</button><span>聚焦上传区域后 Ctrl+V / ⌘V<br/>也可点击「粘贴图片」</span></div><div className="ch-upload-note">图片会转换为 WebP 保存，便于浏览与下载。</div><AssetError message={clipboardError}/>{success > 0 && !occupied && <p className="ch-success" role="status"><CheckCircle2 size={15}/>已保存 {success} 张图片</p>}{failures.length > 0 && <div className="ch-error-list" role="alert">{failures.map((failure, index) => <p key={index}>{failure}</p>)}</div>}</div>;
}

export function AssetPreview({ asset, coverId, onClose, onChanged, onSetCover }: { asset: CharacterAsset; coverId?: string | null; onClose: () => void; onChanged: () => void | Promise<void>; onSetCover?: (id: string) => Promise<void> }) {
  const [name, setName] = useState(asset.name); const [savedName, setSavedName] = useState(asset.name); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function run(work: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await work(); } catch (failure) { setError(assetError(failure)); } finally { setBusy(false); } }
  async function rename(event: FormEvent) { event.preventDefault(); await run(async () => { await api(`/api/studio/assets/${asset.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) }); setSavedName(name.trim()); setNotice("图片名称已更新"); await onChanged(); }); }
  async function download() { await run(async () => { const response = await fetch(assetUrl(asset.id)); if (!response.ok) throw new Error("下载失败，请重新登录后重试"); const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `${savedName.replace(/[\\/:*?"<>|]/g, "_").replace(/\.(jpg|jpeg|png|webp)$/i, "")}.webp`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }); }
  function remove() { if (!window.confirm(`确定删除图片「${savedName}」？删除后无法恢复。`)) return; void run(async () => { await api(`/api/studio/assets/${asset.id}`, { method: "DELETE" }); await onChanged(); onClose(); }); }
  return <StudioDialog title="人物资产预览" description={`${asset.characterName} · ${asset.scriptTitle || "独立人物档案"}`} onClose={onClose} busy={busy} wide><div className="ch-preview-layout"><div className="ch-preview-image"><AssetImage id={asset.id} name={savedName}/></div><div className="ch-preview-info"><span className="ch-eyebrow">CHARACTER ASSET</span><h3>{savedName}</h3><dl><div><dt>所属人物</dt><dd>{asset.characterName}</dd></div><div><dt>关联剧本</dt><dd>{asset.scriptTitle || "未关联"}</dd></div><div><dt>图片尺寸</dt><dd>{asset.width} × {asset.height}</dd></div><div><dt>文件大小</dt><dd>{fileSize(asset.size)}</dd></div><div><dt>原始文件</dt><dd>{asset.originalName}</dd></div></dl><form onSubmit={rename}><label className="ch-field">图片名称<input value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={busy}/></label><button className="ch-button ch-button-light" disabled={busy || !name.trim() || name.trim() === savedName}><Check size={15}/>保存名称</button></form><AssetError message={error}/>{notice && <p className="ch-success" role="status">{notice}</p>}<div className="ch-preview-actions">{onSetCover && <button className="ch-button ch-button-light" disabled={busy || coverId === asset.id} onClick={() => void run(async () => { await onSetCover(asset.id); setNotice("已设为人物封面"); })}><Star size={15}/>{coverId === asset.id ? "当前人物封面" : "设为人物封面"}</button>}<button className="ch-button ch-button-primary" onClick={() => void download()} disabled={busy}><ArrowDownToLine size={16}/>下载图片</button><button className="ch-button ch-button-danger-text" onClick={remove} disabled={busy}><Trash2 size={15}/>删除图片</button></div></div></div></StudioDialog>;
}

type CharacterDraft = Pick<Character, "name" | "scriptId" | "role" | "description" | "appearance" | "personality">;
const draftOf = (value?: Character, scriptId?: string): CharacterDraft => ({ name: value?.name || "", scriptId: value?.scriptId ?? scriptId ?? null, role: value?.role || "主角", description: value?.description || "", appearance: value?.appearance || "", personality: value?.personality || "" });

function CharacterEditor({ character, scriptId, scripts, onClose, onChanged }: { character?: Character; scriptId?: string; scripts: Script[]; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const [record, setRecord] = useState(character); const [draft, setDraft] = useState<CharacterDraft>(() => draftOf(character, scriptId)); const [saved, setSaved] = useState(() => JSON.stringify(draftOf(character, scriptId)));
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [assets, setAssets] = useState<CharacterAsset[]>([]); const [assetLoading, setAssetLoading] = useState(false); const [assetFailure, setAssetFailure] = useState(""); const [preview, setPreview] = useState<CharacterAsset | null>(null);
  const dirty = JSON.stringify(draft) !== saved;
  const reloadAssets = useCallback(async () => {
    if (!record?.id) return;
    setAssetLoading(true); setAssetFailure("");
    try { const [items, current] = await Promise.all([api<CharacterAsset[]>(`/api/studio/assets?characterId=${encodeURIComponent(record.id)}`), api<Character>(`/api/studio/characters/${record.id}`)]); setAssets(items); setRecord(current); }
    catch (failure) { setAssetFailure(assetError(failure)); }
    finally { setAssetLoading(false); }
  }, [record?.id]);
  useEffect(() => { void reloadAssets(); }, [reloadAssets]);
  useEffect(() => { if (!dirty && !uploading) return; const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent); }, [dirty, uploading]);
  function close() { if ((dirty && !window.confirm("人物资料有未保存的修改，确定离开吗？")) || busy || uploading) return; onClose(); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const current = await api<Character>(record ? `/api/studio/characters/${record.id}` : "/api/studio/characters", { method: record ? "PATCH" : "POST", body: JSON.stringify(draft) }); setRecord(current); setDraft(draftOf(current)); setSaved(JSON.stringify(draftOf(current))); setNotice(record ? "人物资料已保存" : "人物已创建，现在可以上传参考图"); await onChanged(); }
    catch (failure) { setError(assetError(failure)); } finally { setBusy(false); }
  }
  async function changedAssets() { await reloadAssets(); await onChanged(); }
  async function setCover(id: string) { if (!record) return; const current = await api<Character>(`/api/studio/characters/${record.id}`, { method: "PATCH", body: JSON.stringify({ coverAssetId: id }) }); setRecord(current); await onChanged(); }
  function field(key: keyof CharacterDraft, value: string | null) { setDraft(current => ({ ...current, [key]: value })); setNotice(""); }
  return <><StudioDialog title={record ? `人物档案 · ${record.name}` : "新建人物档案"} description="把人物设定和视觉参考放在一起，让角色形象保持一致。" onClose={close} busy={busy || uploading} wide><div className="ch-editor-layout"><form onSubmit={save} className="ch-profile-form"><div className="ch-section-title"><UserRound size={18}/><h3>人物设定</h3>{dirty && <span>未保存</span>}</div><div className="ch-fields-two"><label className="ch-field">人物名称 <em>*</em><input data-autofocus required maxLength={80} value={draft.name} onChange={event => field("name", event.target.value)} placeholder="例如：沈知夏" disabled={busy}/></label><label className="ch-field">角色定位<input maxLength={40} value={draft.role} onChange={event => field("role", event.target.value)} placeholder="主角 / 配角 / 反派" disabled={busy}/></label></div><label className="ch-field">关联剧本<select value={draft.scriptId || ""} onChange={event => field("scriptId", event.target.value || null)} disabled={busy}><option value="">独立人物 · 暂不关联</option>{scripts.map(script => <option key={script.id} value={script.id}>{script.title}</option>)}</select></label><label className="ch-field">人物小传<textarea rows={4} maxLength={2000} value={draft.description} onChange={event => field("description", event.target.value)} placeholder="人物经历、目标、与其他角色的关系…" disabled={busy}/></label><label className="ch-field">外貌与造型<textarea rows={3} maxLength={2000} value={draft.appearance} onChange={event => field("appearance", event.target.value)} placeholder="年龄、发型、服装、具有辨识度的特征…" disabled={busy}/></label><label className="ch-field">性格与表达<textarea rows={3} maxLength={2000} value={draft.personality} onChange={event => field("personality", event.target.value)} placeholder="性格、口头禅、动作习惯、情绪表达…" disabled={busy}/></label><AssetError message={error}/>{notice && <p className="ch-success" role="status"><CheckCircle2 size={15}/>{notice}</p>}<div className="ch-form-footer"><button type="button" className="ch-button ch-button-light" onClick={close} disabled={busy || uploading}>关闭</button><button className="ch-button ch-button-primary" disabled={busy || uploading || (!!record && !dirty)}>{busy ? <LoaderCircle size={16} className="ch-spin"/> : <Check size={16}/>} {record ? "保存人物资料" : "创建人物并上传图片"}</button></div></form><div className="ch-character-assets"><div className="ch-section-title"><Images size={18}/><h3>人物资产图</h3><span>{assets.length} 张</span></div>{record ? <><AssetUpload characterId={record.id} onUploaded={changedAssets} onBusy={setUploading}/><AssetError message={assetFailure}/>{assetFailure && <button type="button" className="ch-button ch-button-light" onClick={() => void reloadAssets()}>重新加载图片</button>}{assetLoading && <p className="ch-loading-line"><LoaderCircle size={16} className="ch-spin"/>正在加载图片</p>}<div className="ch-detail-gallery">{assets.map(asset => <button type="button" key={asset.id} className="ch-detail-asset" disabled={uploading || busy} onClick={() => setPreview(asset)}><span className="ch-detail-image"><AssetImage id={asset.id} name={asset.name}/></span><span className="ch-detail-caption"><span className="ch-detail-name">{asset.name}</span>{record.coverAssetId === asset.id && <span className="ch-cover-badge"><Star size={10}/>封面</span>}</span></button>)}</div>{!assetLoading && !assetFailure && !assets.length && <div className="ch-assets-empty"><ImagePlus size={32}/><strong>还没有人物参考图</strong><p>上传定妆照、三视图或表情参考，<br/>逐步建立这个人物的视觉档案。</p></div>}</> : <div className="ch-assets-empty ch-create-first"><Sparkles size={34}/><strong>先创建人物，再上传参考图</strong><p>填写左侧人物信息并保存，<br/>图片会自动归档到该人物。</p></div>}</div></div></StudioDialog>{preview && <AssetPreview asset={preview} coverId={record?.coverAssetId} onClose={() => setPreview(null)} onChanged={changedAssets} onSetCover={setCover}/>}</>;
}

export function CharacterLibrary({ initialScriptId = "", initialCharacterId = "", initialQuery = "" }: { initialScriptId?: string; initialCharacterId?: string; initialQuery?: string }) {
  const [characters, setCharacters] = useState<Character[]>([]); const [scripts, setScripts] = useState<Script[]>([]); const [query, setQuery] = useState(initialQuery); const [scriptFilter, setScriptFilter] = useState(initialScriptId);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [editor, setEditor] = useState<Character | "new" | null>(null); const [deleting, setDeleting] = useState<Character | null>(null); const [deleteBusy, setDeleteBusy] = useState(false); const [deleteError, setDeleteError] = useState("");
  const { notice, notify } = useAssetNotice();
  const openedCharacterId = useRef("");
  const reload = useCallback(async () => { setError(""); try { const [items, scriptItems] = await Promise.all([api<Character[]>("/api/studio/characters"), api<Script[]>("/api/studio/scripts")]); setCharacters(items); setScripts(scriptItems); } catch (failure) { setError(assetError(failure)); } finally { setLoading(false); } }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { setScriptFilter(initialScriptId); setQuery(initialQuery); }, [initialScriptId, initialQuery]);
  useEffect(() => {
    if (!initialCharacterId) { openedCharacterId.current = ""; return; }
    if (loading || error || openedCharacterId.current === initialCharacterId) return;
    openedCharacterId.current = initialCharacterId;
    const target = characters.find(character => character.id === initialCharacterId);
    if (target) setEditor(target);
    else notify("未找到链接中的人物，该档案可能已被删除");
  }, [initialCharacterId, loading, error, characters, notify]);
  const shown = useMemo(() => characters.filter(character => (!scriptFilter || (scriptFilter === "unlinked" ? !character.scriptId : character.scriptId === scriptFilter)) && `${character.name} ${character.role} ${character.description} ${character.scriptTitle || ""}`.toLowerCase().includes(query.trim().toLowerCase())), [characters, scriptFilter, query]);
  async function remove() { if (!deleting) return; setDeleteBusy(true); setDeleteError(""); try { await api(`/api/studio/characters/${deleting.id}`, { method: "DELETE" }); setDeleting(null); notify("人物及其关联图片已删除"); await reload(); } catch (failure) { setDeleteError(assetError(failure)); } finally { setDeleteBusy(false); } }
  return <div className="ch-page"><AssetNotice message={notice}/><div className="ch-page-heading"><div><span className="ch-eyebrow">CHARACTER BIBLE</span><h1>人物档案<span>{characters.length}</span></h1><p>赋予角色性格，保留每一处视觉细节。</p></div><button className="ch-button ch-button-primary" onClick={() => setEditor("new")}><Plus size={18}/>新建人物</button></div><div className="ch-intro"><div className="ch-intro-symbol"><UsersRound size={29}/></div><div><strong>让每一个人物，都有迹可循。</strong><p>小传、外貌、性格与参考图，在同一个档案中持续完善。</p></div><Link href="/studio/assets" className="ch-intro-link">浏览全部资产 <ArrowUpRight size={17}/></Link></div><div className="ch-toolbar"><label className="ch-search"><Search size={17}/><input aria-label="搜索人物" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索人物、定位或剧本…"/>{query && <button aria-label="清空搜索" onClick={() => setQuery("")}><X size={14}/></button>}</label><div className="ch-filter-row"><select aria-label="按剧本筛选人物" value={scriptFilter} onChange={event => setScriptFilter(event.target.value)}><option value="">全部剧本</option><option value="unlinked">独立人物</option>{scripts.map(script => <option key={script.id} value={script.id}>{script.title}</option>)}</select><span>{shown.length} 位人物</span></div></div><AssetError message={error}/>{error && <button className="ch-button ch-button-light ch-self-start" onClick={() => void reload()}>重新加载</button>}{loading ? <div className="ch-empty"><LoaderCircle className="ch-spin" size={30}/><h2>正在加载人物档案</h2></div> : !error && !shown.length ? <div className="ch-empty"><div className="ch-empty-art"><UserRound size={42}/><span><Plus size={17}/></span></div><h2>{characters.length ? "没有找到匹配的人物" : "故事，从一个鲜活的人物开始"}</h2><p>{characters.length ? "试试其他关键词，或切换关联剧本。" : "创建你的第一个角色，记录人物设定，上传视觉参考。"}</p><button className="ch-button ch-button-primary" onClick={() => setEditor("new")}><Plus size={17}/>创建人物档案</button></div> : <div className="ch-character-grid">{shown.map(character => <article className="ch-character-card" key={character.id}><button className="ch-character-portrait" onClick={() => setEditor(character)} aria-label={`查看 ${character.name} 的人物档案`}>{character.coverAssetId ? <AssetImage id={character.coverAssetId} name={`${character.name} 人物封面`}/> : <div className="ch-portrait-empty"><UserRound size={52} strokeWidth={1}/><span>等待人物定妆</span></div>}</button><div className="ch-character-copy"><div className="ch-character-meta"><span className="ch-role-badge">{character.role || "角色"}</span><span className="ch-asset-badge"><Images size={12}/>{character.assetCount} 张图片</span></div><div className="ch-character-title"><button onClick={() => setEditor(character)}><h2>{character.name}</h2></button><button className="ch-icon" aria-label={`编辑 ${character.name}`} onClick={() => setEditor(character)}><Pencil size={15}/></button></div><p className="ch-character-desc">{character.description || "还没有人物小传，补充这个角色的故事。"}</p><div className="ch-character-script"><BookOpen size={13}/><span>{character.scriptTitle || "独立人物档案"}</span></div><div className="ch-character-footer"><span>{relativeTime(character.updatedAt)}更新</span><button className="ch-icon ch-icon-danger" aria-label={`删除 ${character.name}`} onClick={() => { setDeleteError(""); setDeleting(character); }}><Trash2 size={14}/></button></div></div></article>)}</div>}<p className="ch-bottom-note"><Star size={13}/>第一张上传的图片会成为人物封面，也可以在预览中重新指定。</p>{editor && <CharacterEditor key={editor === "new" ? "new" : editor.id} character={editor === "new" ? undefined : editor} scriptId={scriptFilter && scriptFilter !== "unlinked" ? scriptFilter : undefined} scripts={scripts} onClose={() => setEditor(null)} onChanged={reload}/>} {deleting && <StudioDialog title="删除人物档案" description="这个操作无法撤销。" onClose={() => setDeleting(null)} busy={deleteBusy}><div className="ch-confirm"><Trash2 size={30}/><p>确定删除 <strong>「{deleting.name}」</strong> 吗？</p><span>人物资料及其 {deleting.assetCount} 张关联图片都会删除，剧本正文不会改变。</span><AssetError message={deleteError}/></div><div className="ch-dialog-footer"><button className="ch-button ch-button-light" onClick={() => setDeleting(null)} disabled={deleteBusy}>取消</button><button className="ch-button ch-button-danger" onClick={() => void remove()} disabled={deleteBusy}>{deleteBusy ? <LoaderCircle size={16} className="ch-spin"/> : <Trash2 size={16}/>}确认删除</button></div></StudioDialog>}</div>;
}
