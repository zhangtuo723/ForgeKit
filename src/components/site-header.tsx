import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { type Locale } from "@/lib/i18n";

export function SiteHeader({
  locale,
  copy
}: {
  locale: Locale;
  copy: {
    siteTitle: string;
    siteTagline: string;
    nav: { home: string; tools: string };
    localeSwitch: Record<Locale, string>;
  };
}) {
  const navItems = [
    { href: `/${locale}`, label: copy.nav.home },
    { href: `/${locale}/tools`, label: copy.nav.tools }
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:px-8">
        <Link href={`/${locale}`} className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-xs font-semibold text-cyan-300 sm:h-10 sm:w-10">
            DT
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300 sm:text-sm">
              {copy.siteTitle}
            </span>
            <span className="block truncate text-xs text-slate-400 sm:text-sm">{copy.siteTagline}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs text-slate-300 sm:gap-2 sm:text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-1.5 transition hover:bg-white/10 hover:text-white sm:px-4 sm:py-2"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <LanguageSwitcher
            locale={locale}
            labels={copy.localeSwitch}
          />
        </div>
      </div>
    </header>
  );
}
