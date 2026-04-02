import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 text-sm font-semibold text-cyan-300">
            DT
          </span>
          <span>
            <span className="block text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Dev Toolbox
            </span>
            <span className="block text-sm text-slate-400">
              Fast tools for frontend and API work
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm text-slate-300">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
