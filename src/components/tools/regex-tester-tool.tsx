"use client";

import { useMemo, useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Locale, getDictionary } from "@/lib/i18n";

type MatchResult = {
  index: number;
  value: string;
  groups: string[];
};

function buildRegex(pattern: string, flags: string) {
  const normalizedFlags = Array.from(new Set(flags.replace(/[^dgimsuvy]/g, "").split(""))).join("");
  const finalFlags = normalizedFlags.includes("g") ? normalizedFlags : `g${normalizedFlags}`;
  return new RegExp(pattern, finalFlags);
}

export function RegexTesterTool({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).toolUi;
  const text =
    locale === "zh"
      ? {
          description: "在浏览器里测试正则表达式，实时查看命中位置、完整匹配和捕获组。",
          pattern: "正则表达式",
          flags: "Flags",
          sample: "测试文本",
          output: "匹配结果",
          patternPlaceholder: "例如：(?<=id=)\\d+",
          flagsPlaceholder: "例如：gi",
          samplePlaceholder: "粘贴需要匹配的文本、日志或接口返回片段",
          invalid: "正则表达式无效",
          empty: "输入正则和测试文本后，这里会显示匹配详情。",
          noMatches: "没有匹配结果。",
          total: "匹配数量",
          at: "位置",
          fullMatch: "完整匹配",
          groups: "捕获组",
          none: "无",
          examples: "常用示例",
          clear: "清空",
          local: "Local processing"
        }
      : {
          description: "Test regular expressions in the browser and inspect match indexes, full matches, and capture groups instantly.",
          pattern: "Regular expression",
          flags: "Flags",
          sample: "Sample text",
          output: "Matches",
          patternPlaceholder: "Example: (?<=id=)\\d+",
          flagsPlaceholder: "Example: gi",
          samplePlaceholder: "Paste text, logs, or response fragments to test against",
          invalid: "Invalid regular expression",
          empty: "Enter a regex and sample text to inspect matches here.",
          noMatches: "No matches found.",
          total: "Total matches",
          at: "Index",
          fullMatch: "Full match",
          groups: "Capture groups",
          none: "None",
          examples: "Examples",
          clear: "Clear",
          local: "Local processing"
        };

  const [pattern, setPattern] = useState("\\b\\w+@\\w+\\.\\w+\\b");
  const [flags, setFlags] = useState("g");
  const [sample, setSample] = useState(
    "Contact alice@example.com or bob@example.org for the latest build."
  );

  const result = useMemo(() => {
    if (!pattern.trim() || !sample.trim()) {
      return {
        output: text.empty,
        error: null as string | null,
        matches: [] as MatchResult[]
      };
    }

    try {
      const regex = buildRegex(pattern, flags);
      const matches = Array.from(sample.matchAll(regex)).map((match) => ({
        index: match.index ?? 0,
        value: match[0],
        groups: match.slice(1)
      }));

      return {
        output:
          matches.length > 0
            ? JSON.stringify(
                {
                  pattern,
                  flags: regex.flags,
                  totalMatches: matches.length,
                  matches: matches.map((match) => ({
                    index: match.index,
                    value: match.value,
                    groups: match.groups
                  }))
                },
                null,
                2
              )
            : text.noMatches,
        error: null as string | null,
        matches
      };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : text.invalid,
        matches: [] as MatchResult[]
      };
    }
  }, [flags, pattern, sample, text.empty, text.invalid, text.noMatches]);

  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <div className="flex min-h-[600px] flex-col rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:min-h-[620px] sm:p-5">
        <div className="border-b border-white/8 pb-4">
          <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">Regex Tester</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{text.description}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{text.pattern}</label>
            <Input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder={text.patternPlaceholder} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{text.flags}</label>
            <Input value={flags} onChange={(event) => setFlags(event.target.value)} placeholder={text.flagsPlaceholder} />
          </div>
        </div>

        <div className="mt-4 mb-3 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-slate-300">{text.sample}</label>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{text.local}</span>
        </div>
        <div className="flex-1">
          <CodeEditor
            value={sample}
            onChange={setSample}
            placeholder={text.samplePlaceholder}
          />
        </div>

        <div className="mt-4 flex gap-2.5 border-t border-white/8 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPattern("");
              setFlags("g");
              setSample("");
            }}
          >
            {text.clear}
          </Button>
        </div>
        {result.error ? <p className="mt-4 text-sm text-rose-300">{result.error}</p> : null}
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
            onClick={() => navigator.clipboard.writeText(result.output)}
          >
            {copy.copy}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-0">
            <CodeEditor value={result.output || text.empty} readOnly />
          </div>
          <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-[#0a1226] p-4">
            <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{text.total}</span>
              <span className="text-lg font-semibold text-white">{result.matches.length}</span>
            </div>
            <div className="space-y-3">
              {result.matches.length > 0 ? (
                result.matches.map((match, index) => (
                  <div key={`${match.index}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {text.at} {match.index}
                    </p>
                    <p className="mt-2 break-all text-sm font-medium text-cyan-100">{match.value}</p>
                    <div className="mt-3 border-t border-white/8 pt-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{text.groups}</p>
                      <div className="mt-2 space-y-2">
                        {match.groups.length > 0 ? (
                          match.groups.map((group, groupIndex) => (
                            <div key={groupIndex} className="rounded-lg bg-slate-950/70 px-2.5 py-2 text-xs text-slate-300">
                              <span className="mr-2 text-slate-500">#{groupIndex + 1}</span>
                              {group || text.none}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg bg-slate-950/70 px-2.5 py-2 text-xs text-slate-500">
                            {text.none}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                  {result.error ? result.error : text.noMatches}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
