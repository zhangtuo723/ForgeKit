export function SiteFooter({ left, right }: { left: string; right: string }) {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>{left}</p>
        <p>{right}</p>
      </div>
    </footer>
  );
}
