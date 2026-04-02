"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type Locale, locales } from "@/lib/i18n";

export function LanguageSwitcher({
  locale,
  labels
}: {
  locale: Locale;
  labels: Record<Locale, string>;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const rest = segments.slice(1).join("/");

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs text-slate-300">
      {locales.map((target) => (
        <Link
          key={target}
          href={`/${target}${rest ? `/${rest}` : ""}`}
          className={`rounded-xl px-3 py-2 transition ${
            locale === target
              ? "bg-cyan-300 text-slate-950"
              : "hover:bg-white/10 hover:text-white"
          }`}
        >
          {labels[target]}
        </Link>
      ))}
    </div>
  );
}
