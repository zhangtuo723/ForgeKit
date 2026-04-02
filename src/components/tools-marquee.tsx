"use client";

import { useMemo } from "react";

import { ToolCard } from "@/components/tool-card";
import type { ToolDefinition } from "@/data/tools";
import type { Locale } from "@/lib/i18n";

type ToolWithLabel = ToolDefinition & { categoryLabel?: string };

export function ToolsMarquee({
  tools,
  locale,
  openLabel
}: {
  tools: ToolWithLabel[];
  locale: Locale;
  openLabel: string;
}) {
  const marqueeTools = useMemo(() => [...tools, ...tools], [tools]);

  return (
    <div className="tools-marquee-shell">
      <div className="tools-marquee-track">
        {marqueeTools.map((tool, index) => (
          <div key={`${tool.slug}-${index}`} className="tools-marquee-item">
            <ToolCard
              tool={tool}
              locale={locale}
              openLabel={openLabel}
              className="h-full rounded-xl p-5 sm:rounded-2xl"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
