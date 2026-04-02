"use client";

import { useEffect, useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";
import { type Locale, getDictionary } from "@/lib/i18n";

function createUuids(count: number) {
  return Array.from({ length: count }, () => crypto.randomUUID()).join("\n");
}

export function UuidGeneratorTool({ locale }: { locale: Locale }) {
  const [count, setCount] = useState(10);
  const [uuids, setUuids] = useState("");
  const copy = getDictionary(locale).toolUi;
  const text =
    locale === "zh"
      ? {
          description: "批量生成 UUID v4，适合 fixture、测试数据和请求标识。",
          count: "生成数量",
          output: "生成结果",
          regenerate: "重新生成"
        }
      : {
          description: "Generate batches of UUID v4 values for fixtures, IDs, and local testing.",
          count: "How many?",
          output: "Generated UUIDs",
          regenerate: "Regenerate"
        };

  useEffect(() => {
    setUuids(createUuids(count));
  }, [count]);

  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(520px,1.22fr)]">
      <div className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:h-[620px] sm:p-5">
        <div className="border-b border-white/8 pb-4">
          <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">UUID Generator</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{text.description}</p>
        </div>

        <div className="mt-5 flex flex-1 flex-col">
          <label className="mb-3 block text-sm font-medium text-slate-300">{text.count}</label>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <input
              type="range"
              min={1}
              max={50}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="w-full accent-cyan-300"
            />
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0a1226] px-4 py-4 text-4xl font-semibold leading-none text-white">
              {count}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <span className="text-xs text-slate-500">UUID v4</span>
            <Button type="button" onClick={() => setUuids(createUuids(count))}>
              {text.regenerate}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:h-[620px] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            {text.output}
          </h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(uuids)}
          >
            {copy.copy}
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor value={uuids} readOnly minHeight="520px" />
        </div>
      </div>
    </section>
  );
}
