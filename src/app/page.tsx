import Link from "next/link";

import { ToolCard } from "@/components/tool-card";
import { categories, featuredSlugs, tools } from "@/data/tools";

const featuredTools = tools.filter((tool) => featuredSlugs.includes(tool.slug));

export default function HomePage() {
  return (
    <div className="space-y-16 pb-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr] lg:items-end">
        <div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
            Developer Utility Site MVP
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            A focused toolbox for frontend, API, and debugging work.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Start with high-frequency utilities that developers actually bookmark. Then add search, usage history, premium workflows, and API access.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/tools"
              className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Browse Tools
            </Link>
            <Link
              href="/tools/json-formatter"
              className="rounded-full border border-white/10 px-6 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
            >
              Open JSON Formatter
            </Link>
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Launch path", "Core tools -> SEO pages -> account features -> premium"],
              ["Target users", "Frontend developers, indie hackers, API consumers"],
              ["Monetization", "Ads later, then premium workflows and API credits"],
              ["Deployment", "Static-first Next.js with optional lightweight APIs"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">Featured</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Start with bookmark-worthy utilities</h2>
          </div>
          <Link href="/tools" className="text-sm text-slate-300 transition hover:text-white">
            View all tools
          </Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {featuredTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-5">
        {categories.map((category) => (
          <div key={category.name} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
              {category.name}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-300">{category.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
