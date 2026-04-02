import Link from "next/link";

import type { ToolDefinition } from "@/data/tools";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.06]"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
          {tool.category}
        </span>
        <span className="text-sm text-slate-500 transition group-hover:text-slate-300">
          Open
        </span>
      </div>
      <h3 className="text-xl font-semibold text-white">{tool.name}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{tool.description}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {tool.keywords.slice(0, 2).map((keyword) => (
          <span
            key={keyword}
            className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400"
          >
            {keyword}
          </span>
        ))}
      </div>
    </Link>
  );
}
