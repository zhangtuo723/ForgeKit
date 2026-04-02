"use client";

import { useState } from "react";

function decodeJwtSegment(segment: string) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
}

export function JwtDecoderTool() {
  const [token, setToken] = useState("");

  const result = (() => {
    if (!token.trim()) {
      return { output: "Paste a JWT to inspect header and payload.", error: null as string | null };
    }

    const parts = token.trim().split(".");
    if (parts.length < 2) {
      return { output: "", error: "A JWT must have at least header.payload.signature." };
    }

    try {
      const header = decodeJwtSegment(parts[0]);
      const payload = decodeJwtSegment(parts[1]);

      return {
        output: JSON.stringify(
          {
            header,
            payload
          },
          null,
          2
        ),
        error: null
      };
    } catch (err) {
      return {
        output: "",
        error: err instanceof Error ? err.message : "Failed to decode JWT"
      };
    }
  })();

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-2xl font-semibold text-white">JWT Decoder</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Decode token headers and payloads locally. Nothing leaves the browser.
        </p>
        <textarea
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="eyJhbGciOi..."
          className="mt-4 min-h-[280px] w-full rounded-3xl border border-white/10 bg-slate-950 px-4 py-4 text-sm leading-6 text-white outline-none focus:border-cyan-300/50"
        />
        {result.error ? <p className="mt-4 text-sm text-rose-300">{result.error}</p> : null}
      </div>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
            Decoded JSON
          </h3>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(result.output)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
          >
            Copy
          </button>
        </div>
        <pre className="min-h-[280px] overflow-auto rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
          {result.output || "Decoded header and payload will appear here."}
        </pre>
      </div>
    </section>
  );
}
