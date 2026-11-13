"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/client";
import { ListPagination, useStudioList } from "./studio-list";

type Choice = { id: string; title?: string; name?: string; scriptTitle?: string | null };
export function StudioRecordPicker({ resource, value, onChange, label, emptyLabel, allowUnlinked = false, disabled = false, scriptId = "" }: {
  resource: "scripts" | "characters"; value: string; onChange: (value: string) => void; label: string; emptyLabel: string; allowUnlinked?: boolean; disabled?: boolean; scriptId?: string;
}) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [selectedLabel, setSelectedLabel] = useState("");
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const list = useStudioList<Choice>(open ? `/api/studio/${resource}` : "", { q: query, scriptId }, 20);
  useEffect(() => {
    setSelectedLabel("");
    if (!value || value === "unlinked") return;
    const controller = new AbortController();
    api<Choice>(`/api/studio/${resource}/${encodeURIComponent(value)}`, { signal: controller.signal }).then(item => {
      if (!controller.signal.aborted) setSelectedLabel(item.title || item.name || "");
    }).catch(() => { if (!controller.signal.aborted) setSelectedLabel("所选记录不可用"); });
    return () => controller.abort();
  }, [resource, value]);
  useEffect(() => {
    if (!open) return;
    function outside(event: MouseEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("mousedown", outside); root.current?.addEventListener("keydown", escape);
    const element = root.current;
    return () => { document.removeEventListener("mousedown", outside); element?.removeEventListener("keydown", escape); };
  }, [open]);
  function choose(id: string) { onChange(id); setOpen(false); setQuery(""); trigger.current?.focus(); }
  return <div className="studio-picker" ref={root}>
    <button type="button" className="studio-picker-trigger" ref={trigger} disabled={disabled} aria-label={label} aria-expanded={open} onClick={() => setOpen(value => !value)}><span>{!value ? emptyLabel : value === "unlinked" ? "独立人物" : selectedLabel || "正在读取所选记录…"}</span><ChevronDown size={14}/></button>
    {open && <div className="studio-picker-popover"><input autoFocus aria-label={`检索${resource === "scripts" ? "剧本" : "人物名称"}`} placeholder={resource === "scripts" ? "搜索剧本名称…" : "搜索人物名称…"} value={query} maxLength={200} onChange={event => setQuery(event.target.value)}/>
      <div className="studio-picker-options"><button type="button" aria-pressed={!value} onClick={() => choose("")}>{emptyLabel}</button>{allowUnlinked && <button type="button" aria-pressed={value === "unlinked"} onClick={() => choose("unlinked")}>独立人物</button>}
        {list.loading ? <p role="status">正在检索…</p> : list.error ? <p role="alert">{list.error}<button type="button" onClick={list.reload}>重试</button></p> : list.items.length ? list.items.map(item => <button type="button" key={item.id} aria-pressed={value === item.id} onClick={() => choose(item.id)}>{item.title || item.name}{resource === "characters" && <small>{item.scriptTitle || "独立人物"}</small>}</button>) : <p>没有找到匹配记录</p>}
      </div><ListPagination pagination={list.pagination} disabled={list.loading} onPage={list.setPage}/>
    </div>}
  </div>;
}
