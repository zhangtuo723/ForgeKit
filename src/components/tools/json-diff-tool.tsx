"use client";

import { json } from "@codemirror/lang-json";
import { useMemo, useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";

import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/lib/i18n";

function formatJson(input: string) {
  return JSON.stringify(JSON.parse(input), null, 2);
}

export function JsonDiffTool({ locale }: { locale: Locale }) {
  const [left, setLeft] = useState('{"name":"ForgeKit","version":"1.0.0","features":["formatter","decoder"]}');
  const [right, setRight] = useState('{"name":"ForgeKit","version":"1.1.0","features":["formatter","decoder","json-diff"]}');
  const [error, setError] = useState<string | null>(null);

  const text =
    locale === "zh"
      ? {
          title: "JSON Diff",
          description: "把两个 JSON 文档并排比较，快速定位字段的新增、删除和修改。",
          leftLabel: "原始 JSON",
          rightLabel: "对比 JSON",
          diffLabel: "差异结果",
          auto: "自动对比",
          reset: "重置示例",
          leftPlaceholder: '{"name":"old"}',
          rightPlaceholder: '{"name":"new"}',
          empty: "输入两段合法 JSON 后，会在这里显示差异结果。",
          invalid: "请输入合法的 JSON"
        }
      : {
          title: "JSON Diff",
          description: "Compare two JSON documents side by side and inspect added, removed, and changed fields.",
          leftLabel: "Original JSON",
          rightLabel: "Updated JSON",
          diffLabel: "Diff Result",
          auto: "Live diff",
          reset: "Reset sample",
          leftPlaceholder: '{"name":"old"}',
          rightPlaceholder: '{"name":"new"}',
          empty: "Enter two valid JSON documents to see the diff here.",
          invalid: "Please provide valid JSON"
        };

  const diffData = useMemo(() => {
    if (!left.trim() || !right.trim()) {
      return null;
    }

    try {
      const oldValue = formatJson(left);
      const newValue = formatJson(right);
      setError(null);
      return { oldValue, newValue };
    } catch {
      setError(text.invalid);
      return null;
    }
  }, [left, right, text.invalid]);

  return (
    <section className="grid gap-4">
      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
        <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">{text.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{text.description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">{text.leftLabel}</label>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Base</span>
          </div>
          <CodeEditor
            value={left}
            onChange={setLeft}
            placeholder={text.leftPlaceholder}
            extensions={[json()]}
            minHeight="340px"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">{text.rightLabel}</label>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Target</span>
          </div>
          <CodeEditor
            value={right}
            onChange={setRight}
            placeholder={text.rightPlaceholder}
            extensions={[json()]}
            minHeight="340px"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex h-10 items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm text-cyan-100">
          {text.auto}
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setLeft('{"name":"ForgeKit","version":"1.0.0","features":["formatter","decoder"]}');
            setRight('{"name":"ForgeKit","version":"1.1.0","features":["formatter","decoder","json-diff"]}');
            setError(null);
          }}
        >
          {text.reset}
        </Button>
        {error ? <span className="text-sm text-rose-300">{error}</span> : null}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            {text.diffLabel}
          </h3>
        </div>
        {diffData ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1226]">
            <ReactDiffViewer
              oldValue={diffData.oldValue}
              newValue={diffData.newValue}
              splitView
              useDarkTheme
              hideLineNumbers={false}
              styles={{
                variables: {
                  dark: {
                    diffViewerBackground: "#0a1226",
                    diffViewerTitleBackground: "#0f172a",
                    diffViewerColor: "#e2e8f0",
                    addedBackground: "rgba(34,197,94,0.16)",
                    addedColor: "#dcfce7",
                    removedBackground: "rgba(239,68,68,0.16)",
                    removedColor: "#fee2e2",
                    wordAddedBackground: "rgba(34,197,94,0.28)",
                    wordRemovedBackground: "rgba(239,68,68,0.28)",
                    addedGutterBackground: "rgba(34,197,94,0.2)",
                    removedGutterBackground: "rgba(239,68,68,0.2)",
                    gutterBackground: "#0b1226",
                    gutterBackgroundDark: "#0b1226",
                    highlightBackground: "rgba(34,211,238,0.08)",
                    highlightGutterBackground: "rgba(34,211,238,0.08)",
                    codeFoldGutterBackground: "#0f172a",
                    codeFoldBackground: "#0f172a",
                    emptyLineBackground: "#0a1226",
                    gutterColor: "#64748b",
                    addedGutterColor: "#bbf7d0",
                    removedGutterColor: "#fecaca",
                    codeFoldContentColor: "#94a3b8"
                  }
                },
                diffContainer: {
                  fontSize: "13px",
                  fontFamily: '"SF Mono","JetBrains Mono","Fira Code",Consolas,monospace'
                },
                contentText: {
                  lineHeight: 1.6
                }
              }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
            {text.empty}
          </div>
        )}
      </div>
    </section>
  );
}
