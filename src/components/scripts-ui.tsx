"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { ScriptStatus } from "@/lib/studio-types";

export const scriptStatuses: ScriptStatus[] = ["草稿", "创作中", "已定稿", "已归档"];
export const scriptStatusClass: Record<ScriptStatus, string> = { 草稿: "draft", 创作中: "writing", 已定稿: "final", 已归档: "archived" };
export const scriptError = (error: unknown) => error instanceof Error ? error.message : "操作失败，请稍后重试";

export function ScriptDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    (dialog.current?.querySelector<HTMLElement>("[data-autofocus],input,textarea,select") || dialog.current)?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !dialog.current) return;
      const elements = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')).filter(item => item.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; prior?.focus(); };
  }, []);
  return <div className="sc-dialog-shade" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className="sc-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><header><h2 id={titleId}>{title}</h2><button className="sc-icon-button" type="button" aria-label="关闭弹窗" disabled={busy} onClick={onClose}><X size={20}/></button></header>{children}</div></div>;
}

export function downloadText(content: string, title: string, format: "txt" | "md") {
  const blob = new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `${(title || "未命名剧本").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100)}.${format}`;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
