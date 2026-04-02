"use client";

import { useEffect, useState } from "react";

function createUuids(count: number) {
  return Array.from({ length: count }, () => crypto.randomUUID()).join("\n");
}

export function UuidGeneratorTool() {
  const [count, setCount] = useState(10);
  const [uuids, setUuids] = useState("");

  useEffect(() => {
    setUuids(createUuids(count));
  }, [count]);

  return (
    <section className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-2xl font-semibold text-white">UUID Generator</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Generate batches of UUID v4 values for fixtures, IDs, and local testing.
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-300">How many?</label>
        <input
          type="range"
          min={1}
          max={50}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          className="mt-4 w-full accent-cyan-300"
        />
        <div className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-3xl font-semibold text-white">
          {count}
        </div>
        <button
          type="button"
          onClick={() => setUuids(createUuids(count))}
          className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Regenerate
        </button>
      </div>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
            Generated UUIDs
          </h3>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(uuids)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
          >
            Copy
          </button>
        </div>
        <pre className="min-h-[280px] overflow-auto rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
          {uuids}
        </pre>
      </div>
    </section>
  );
}
