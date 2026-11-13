"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiPage } from "@/lib/client";
import type { PageResult, Pagination } from "@/lib/studio-types";
import "./studio-list.css";

export function useStudioList<T>(endpoint: string, filters: Record<string, string>, defaultPageSize = 12) {
  const filterKey = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const [position, setPosition] = useState({ filterKey, page: 1 });
  const page = position.filterKey === filterKey ? position.page : 1;
  const [pageSize, setSize] = useState(defaultPageSize);
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<PageResult<T>["summary"]>();
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const previousFilter = useRef(filterKey);
  useEffect(() => {
    if (!endpoint) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    const delay = previousFilter.current === filterKey ? 0 : 250;
    previousFilter.current = filterKey;
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams(filterKey);
        query.set("page", String(page)); query.set("pageSize", String(pageSize));
        const result = await apiPage<T>(`${endpoint}?${query}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(result.data); setPagination(result.pagination); setSummary(result.summary);
        if (result.pagination.page !== page) setPosition({ filterKey, page: result.pagination.page });
      } catch (failure) { if (!controller.signal.aborted) { setItems([]); setError(failure instanceof Error ? failure.message : "列表加载失败"); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [endpoint, filterKey, page, pageSize, refresh]);
  return {
    items, pagination, summary, loading, error,
    reload: useCallback(() => setRefresh(value => value + 1), []),
    setPage: (value: number) => setPosition({ filterKey, page: value }),
    setPageSize: (value: number) => { setSize(value); setPosition({ filterKey, page: 1 }); },
  };
}

export function ListPagination({ pagination, disabled, onPage, onPageSize }: { pagination: Pagination; disabled?: boolean; onPage: (page: number) => void; onPageSize?: (size: number) => void }) {
  const { page, pageSize, total, totalPages } = pagination;
  const pages = [...new Set([1, ...Array.from({ length: 5 }, (_, i) => page - 2 + i), totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a,b) => a-b);
  return <nav className="studio-pagination" aria-label="列表分页">
    <span role="status">共 {total} 条{total > 0 && ` · ${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)} 条`}</span>
    <div>{onPageSize && <label>每页 <select aria-label="每页数量" disabled={disabled} value={pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[12,24,48].map(size => <option key={size} value={size}>{size} 条</option>)}</select></label>}
      <button type="button" aria-label="上一页" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15}/></button>
      {pages.map((value, index) => <span key={value}>{index > 0 && value - pages[index - 1] > 1 && <i>…</i>}<button type="button" aria-label={`第 ${value} 页`} aria-current={value === page ? "page" : undefined} disabled={disabled} onClick={() => onPage(value)}>{value}</button></span>)}
      <button type="button" aria-label="下一页" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight size={15}/></button>
    </div>
  </nav>;
}
