import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolRenderer } from "@/components/tool-renderer";
import { tools } from "@/data/tools";
import { isLocale, localizeTool, locales } from "@/lib/i18n";

type ToolPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  return locales.flatMap((locale) => tools.map((tool) => ({ locale, slug: tool.slug })));
}

export async function generateMetadata({
  params
}: ToolPageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const tool = tools.find((entry) => entry.slug === slug);

  if (!tool) {
    return {};
  }

  const localizedTool = localizeTool(tool, locale);

  return {
    title: localizedTool.name,
    description: localizedTool.description
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const tool = tools.find((entry) => entry.slug === slug);

  if (!tool) {
    notFound();
  }

  return (
    <div className="pb-8 sm:pb-10">
      <ToolRenderer slug={tool.slug} locale={locale} />
    </div>
  );
}
