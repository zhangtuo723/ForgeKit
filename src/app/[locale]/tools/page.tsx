import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolsCatalog } from "@/components/tools-catalog";
import { tools } from "@/data/tools";
import { getDictionary, isLocale, localizeTool, locales, type Locale } from "@/lib/i18n";

type ToolsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params
}: ToolsPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = getDictionary(locale);

  return {
    title: copy.toolsPage.title,
    description: copy.toolsPage.description
  };
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function ToolsPage({ params }: ToolsPageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = getDictionary(locale as Locale);
  const localizedTools = tools.map((tool) => localizeTool(tool, locale));

  return (
    <div className="space-y-6 pb-8 sm:space-y-8 sm:pb-10">
      <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 sm:rounded-[2rem] sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200 sm:text-sm">{copy.toolsPage.badge}</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{copy.toolsPage.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
          {copy.toolsPage.description}
        </p>
      </section>

      <ToolsCatalog
        locale={locale}
        tools={localizedTools}
        copy={{
          open: copy.toolCard.open,
          searchPlaceholder: copy.toolsPage.searchPlaceholder,
          allCategories: copy.toolsPage.allCategories,
          emptyTitle: copy.toolsPage.emptyTitle,
          emptyDescription: copy.toolsPage.emptyDescription
        }}
      />
    </div>
  );
}
