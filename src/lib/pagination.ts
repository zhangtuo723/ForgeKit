import { ApiError } from "./api";
import type { Pagination } from "./studio-types";

export type ListOptions = { page: number; pageSize: number; q: string; status: string; scriptId: string };
export function listOptions(query: URLSearchParams): ListOptions {
  function integer(name: string, fallback: number, max: number) {
    const raw = query.get(name);
    if (raw === null) return fallback;
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) throw new ApiError(400, `${name} 必须是 1 到 ${max} 的整数`);
    return Number(raw);
  }
  const q = (query.get("q") || "").trim();
  const status = query.get("status") || "";
  const scriptId = query.get("scriptId") || "";
  if (q.length > 200) throw new ApiError(400, "检索关键词最多 200 个字符");
  if (status && !["草稿", "创作中", "已定稿", "已归档"].includes(status)) throw new ApiError(400, "剧本状态无效");
  if (scriptId.length > 64) throw new ApiError(400, "剧本 ID 无效");
  return { page: integer("page", 1, 1000000), pageSize: integer("pageSize", 12, 100), q, status, scriptId };
}
export function paginationFor(total: number, options: Pick<ListOptions, "page" | "pageSize">): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  return { page: Math.min(options.page, totalPages), pageSize: options.pageSize, total, totalPages };
}
// A dedicated LIKE escape character keeps %, _ and ! literal, including under NO_BACKSLASH_ESCAPES.
export const containsPattern = (value: string) => `%${value.replace(/[!%_]/g, "!$&")}%`;
