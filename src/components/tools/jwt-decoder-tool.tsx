"use client";

import { useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";
import { type Locale, getDictionary } from "@/lib/i18n";

function decodeJwtSegment(segment: string) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
}

export function JwtDecoderTool({ locale }: { locale: Locale }) {
  const [token, setToken] = useState("");
  const copy = getDictionary(locale).toolUi;
  const text =
    locale === "zh"
      ? {
        description: "在本地解码 token 的 header 和 payload，不会把内容上传到任何服务端。",
        placeholder: "eyJhbGciOi...",
          output: "解码结果",
          copy: copy.copy,
          empty: "粘贴一个 JWT 以查看 header 和 payload。",
          invalid: "JWT 至少需要 header.payload.signature 三段。"
        }
      : {
        description: "Decode token headers and payloads locally. Nothing leaves the browser.",
        placeholder: "eyJhbGciOi...",
          output: "Decoded JSON",
          copy: copy.copy,
          empty: "Paste a JWT to inspect header and payload.",
          invalid: "A JWT must have at least header.payload.signature."
        };

  const result = (() => {
    if (!token.trim()) {
      return { output: text.empty, error: null as string | null };
    }

    const parts = token.trim().split(".");
    if (parts.length < 2) {
      return { output: "", error: text.invalid };
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
        <p className="mt-2 text-sm leading-6 text-slate-300">{text.description}</p>
        <div className="mt-4">
          <CodeEditor value={token} onChange={setToken} placeholder={text.placeholder} />
        </div>
        {result.error ? <p className="mt-4 text-sm text-rose-300">{result.error}</p> : null}
      </div>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
            {text.output}
          </h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(result.output)}
          >
            {text.copy}
          </Button>
        </div>
        <CodeEditor value={result.output || text.empty} readOnly />
      </div>
    </section>
  );
}
