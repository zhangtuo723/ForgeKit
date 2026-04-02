"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ToolCard } from "@/components/tool-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ToolDefinition } from "@/data/tools";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ToolWithLabel = ToolDefinition & { categoryLabel?: string };

export function ToolsCatalog({
  locale,
  tools,
  copy
}: {
  locale: Locale;
  tools: ToolWithLabel[];
  copy: {
    open: string;
    searchPlaceholder: string;
    allCategories: string;
    emptyTitle: string;
    emptyDescription: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = useMemo(
    () => ["all", ...new Set(tools.map((tool) => tool.categoryLabel ?? tool.category))],
    [tools]
  );

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return tools.filter((tool) => {
      const matchesCategory =
        selectedCategory === "all" || (tool.categoryLabel ?? tool.category) === selectedCategory;
      const matchesQuery =
        !normalized ||
        [tool.name, tool.description, ...tool.keywords]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory, tools]);

  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.4fr,0.6fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = selectedCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3 text-xs transition sm:text-sm",
                    active
                      ? "border-cyan-300/40 bg-cyan-300/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
                  )}
                >
                  {category === "all" ? copy.allCategories : category}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {filteredTools.length > 0 ? (
        <section className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} locale={locale} openLabel={copy.open} />
          ))}
        </section>
      ) : (
        <section className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <h2 className="text-lg font-semibold text-white">{copy.emptyTitle}</h2>
          <p className="mt-3 text-sm text-slate-400">{copy.emptyDescription}</p>
          <div className="mt-4 flex justify-center">
            <Badge>{query || selectedCategory}</Badge>
          </div>
        </section>
      )}
    </div>
  );
}
