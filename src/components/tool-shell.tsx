"use client";

import type { Extension } from "@codemirror/state";
import type { ReactNode } from "react";
import { useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";

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
  extras,
  copy,
  inputExtensions,
  outputExtensions
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
  copy: {
    run: string;
    clear: string;
    copy: string;
    resultPlaceholder: string;
  };
  inputExtensions?: Extension[];
  outputExtensions?: Extension[];
}) {
  const [input, setInput] = useState("");

  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <div className="flex min-h-[600px] flex-col rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:min-h-[620px] sm:p-5">
        <div className="mb-4 border-b border-white/8 pb-4">
          <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {description}
          </p>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-slate-300">{inputLabel}</label>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Input</span>
        </div>
        <div className="flex-1">
          <CodeEditor
            value={input}
            onChange={setInput}
            placeholder={inputPlaceholder}
            extensions={inputExtensions}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
          <div className="flex flex-wrap gap-2.5">
          <Button type="button" onClick={() => onTransform(input)}>
            {copy.run}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setInput("");
              onClear();
            }}
            variant="secondary"
          >
            {copy.clear}
          </Button>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">Local processing</span>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>

      <div className="flex min-h-[600px] flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:min-h-[620px] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            {outputLabel}
          </h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(output)}
          >
            {copy.copy}
          </Button>
        </div>
        <div className="flex-1">
          <CodeEditor
            value={output || copy.resultPlaceholder}
            readOnly
            extensions={outputExtensions}
          />
        </div>
        {extras ? <div className="mt-5 border-t border-white/8 pt-4">{extras}</div> : null}
      </div>
    </section>
  );
}
