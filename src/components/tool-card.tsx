import Link from "next/link";

import type { ToolDefinition } from "@/data/tools";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ToolCard({
  tool,
  locale,
  openLabel,
  className
}: {
  tool: ToolDefinition & { categoryLabel?: string };
  locale: Locale;
  openLabel: string;
  className?: string;
}) {
  return (
    <Link
      href={`/${locale}/tools/${tool.slug}`}
      className={cn(
        "group block h-full w-full rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 transition hover:border-cyan-300/40 hover:bg-white/[0.06] hover:shadow-[0_14px_40px_rgba(8,145,178,0.16)] sm:rounded-3xl sm:p-6",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
          {tool.categoryLabel ?? tool.category}
        </span>
        <span className="text-xs text-slate-500 transition group-hover:text-slate-300 sm:text-sm">
          {openLabel}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white sm:text-xl">{tool.name}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-[0.95rem]">{tool.description}</p>
      <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
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
