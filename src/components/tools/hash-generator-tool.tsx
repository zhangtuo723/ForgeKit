"use client";

import { useEffect, useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";
import { type Locale, getDictionary } from "@/lib/i18n";

const algorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

async function createHash(input: string, algorithm: (typeof algorithms)[number]) {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest(algorithm, encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function HashGeneratorTool({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).toolUi;
  const text =
    locale === "zh"
      ? {
          description: "使用浏览器内置 Web Crypto 为文本生成哈希值，适合做内容校验和快速比对。",
          input: "输入文本",
          output: "哈希结果",
          algorithm: "算法",
          placeholder: "粘贴需要生成哈希的文本、配置或请求体",
          empty: "输入文本后会自动生成哈希结果。",
          failed: "生成哈希失败",
          length: "长度",
          local: "Local processing"
        }
      : {
          description: "Generate hashes for text using the browser's Web Crypto API for quick integrity checks and comparisons.",
          input: "Input text",
          output: "Hash output",
          algorithm: "Algorithm",
          placeholder: "Paste text, config, or payload content to hash",
          empty: "Enter text to generate a hash automatically.",
          failed: "Failed to generate hash",
          length: "Length",
          local: "Local processing"
        };

  const [input, setInput] = useState("");
  const [algorithm, setAlgorithm] = useState<(typeof algorithms)[number]>("SHA-256");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!input) {
        setOutput("");
        setError(null);
        return;
      }

      try {
        const hash = await createHash(input, algorithm);
        if (cancelled) return;
        setOutput(hash);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setOutput("");
        setError(err instanceof Error ? err.message : text.failed);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [algorithm, input, text.failed]);

  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
      <div className="flex min-h-[600px] flex-col rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:min-h-[620px] sm:p-5">
        <div className="border-b border-white/8 pb-4">
          <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">Hash Generator</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{text.description}</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">{text.input}</label>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{text.local}</span>
        </div>

        <div className="mt-3 flex-1">
          <CodeEditor value={input} onChange={setInput} placeholder={text.placeholder} />
        </div>

        <div className="mt-4 border-t border-white/8 pt-4">
          <p className="mb-3 text-sm font-medium text-slate-300">{text.algorithm}</p>
          <div className="flex flex-wrap gap-2.5">
            {algorithms.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAlgorithm(option)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  algorithm === option
                    ? "bg-cyan-300 text-slate-950"
                    : "border border-white/10 text-slate-300 hover:border-white/20"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-[600px] flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:min-h-[620px] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            {text.output}
          </h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(output)}
            disabled={!output}
          >
            {copy.copy}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4">
          <div className="min-h-0">
            <CodeEditor value={output || text.empty} readOnly minHeight="280px" />
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0a1226] p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{text.algorithm}</span>
              <span className="text-sm font-medium text-cyan-100">{algorithm}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/8 pt-3">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{text.length}</span>
              <span className="text-sm font-medium text-white">{output.length || 0}</span>
            </div>
            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
