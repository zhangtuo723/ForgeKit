import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, isLocale, locales, type Locale } from "@/lib/i18n";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = getDictionary(locale);

  return {
    title: {
      default: copy.siteTitle,
      template: `%s | ${copy.siteTitle}`
    },
    description: copy.siteTagline
  };
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = getDictionary(locale as Locale);

  return (
    <>
      <SiteHeader locale={locale} copy={copy} />
      <main className="mx-auto w-full max-w-[1380px] px-4 py-8 sm:px-6 sm:py-10 xl:px-8">
        {children}
      </main>
      <SiteFooter left={copy.footer.left} right={copy.footer.right} />
    </>
  );
}
