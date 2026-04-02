import type { Metadata } from "next";

import { ToolCard } from "@/components/tool-card";
import { tools } from "@/data/tools";

export const metadata: Metadata = {
  title: "All Tools",
  description: "Browse formatter, decoder, converter, and generator tools for daily development work."
};

export default function ToolsPage() {
  return (
    <div className="space-y-8 pb-10">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">Tool Library</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Daily utilities for developers</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          The first release focuses on fast browser-side tools that solve high-frequency debugging and payload handling tasks.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </section>
    </div>
  );
}
