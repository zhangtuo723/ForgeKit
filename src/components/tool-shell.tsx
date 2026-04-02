"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export function ToolShell({
  title,
  description,
  inputLabel,
  outputLabel,
  inputPlaceholder,
  output,
  onTransform,
  onClear,
  error,
  extras
}: {
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  inputPlaceholder: string;
  output: string;
  onTransform: (input: string) => void;
  onClear: () => void;
  error?: string | null;
  extras?: ReactNode;
}) {
  const [input, setInput] = useState("");

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {description}
          </p>
        </div>
        <label className="mb-3 block text-sm font-medium text-slate-300">{inputLabel}</label>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={inputPlaceholder}
          className="min-h-[280px] w-full rounded-3xl border border-white/10 bg-slate-950 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onTransform(input)}
            className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Run
          </button>
          <button
            type="button"
            onClick={() => {
              setInput("");
              onClear();
            }}
            className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Clear
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
            {outputLabel}
          </h3>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(output)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
          >
            Copy
          </button>
        </div>
        <pre className="min-h-[280px] overflow-auto rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
          {output || "Result will appear here."}
        </pre>
        {extras ? <div className="mt-6">{extras}</div> : null}
      </div>
    </section>
  );
}
