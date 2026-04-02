import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolRenderer } from "@/components/tool-renderer";
import { tools } from "@/data/tools";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params
}: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = tools.find((entry) => entry.slug === slug);

  if (!tool) {
    return {};
  }

  return {
    title: tool.name,
    description: tool.description
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = tools.find((entry) => entry.slug === slug);

  if (!tool) {
    notFound();
  }

  return (
    <div className="space-y-8 pb-10">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
            {tool.category}
          </span>
          {tool.keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300"
            >
              {keyword}
            </span>
          ))}
        </div>
        <h1 className="mt-5 text-4xl font-semibold text-white">{tool.name}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{tool.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {tool.useCases.map((useCase) => (
            <span
              key={useCase}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm text-slate-300"
            >
              {useCase}
            </span>
          ))}
        </div>
      </section>

      <ToolRenderer slug={tool.slug} />
    </div>
  );
}
