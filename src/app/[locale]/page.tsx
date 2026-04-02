import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolsMarquee } from "@/components/tools-marquee";
import { tools } from "@/data/tools";
import {
  getDictionary,
  isLocale,
  localizeTool,
  locales,
  type Locale
} from "@/lib/i18n";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = getDictionary(locale);

  return {
    title: copy.siteTitle,
    description: copy.home.description
  };
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = getDictionary(locale as Locale);
  const localizedTools = tools.map((tool) => localizeTool(tool, locale));

  return (
    <div className="space-y-12 pb-8 sm:space-y-16 sm:pb-10">
      <section>
        <div>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[3.5rem] lg:leading-[1.08]">
            {copy.home.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:mt-6 sm:text-lg sm:leading-8">
            {copy.home.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-8 sm:gap-4">
            <Link
              href={`/${locale}/tools`}
              className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 sm:px-6 sm:py-3"
            >
              {copy.home.browse}
            </Link>
            <Link
              href={`/${locale}/tools/json-formatter`}
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-slate-200 transition hover:border-white/20 hover:text-white sm:px-6 sm:py-3"
            >
              {copy.home.openFeatured}
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200 sm:text-sm">{copy.home.featured}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{copy.home.featuredTitle}</h2>
          </div>
          <Link
            href={`/${locale}/tools`}
            className="text-xs text-slate-300 transition hover:text-white sm:text-sm"
          >
            {copy.home.viewAll}
          </Link>
        </div>
        <ToolsMarquee tools={localizedTools} locale={locale} openLabel={copy.toolCard.open} />
      </section>
    </div>
  );
}
