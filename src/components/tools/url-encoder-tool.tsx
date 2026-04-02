"use client";

import { useState } from "react";

import { ToolShell } from "@/components/tool-shell";
import { type Locale, getDictionary } from "@/lib/i18n";

export function UrlEncoderTool({ locale }: { locale: Locale }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const copy = getDictionary(locale).toolUi;
  const text =
    locale === "zh"
      ? {
          description: "编码或解码 query 参数、跳转链接和 URL 特殊字符，适合接口联调与前端拼接链接。",
          inputLabel: `值（${mode === "encode" ? "编码" : "解码"}）`,
          outputLabel: "转换结果",
          placeholder: "name=hello world&next=/dashboard",
          encode: "编码",
          decode: "解码",
          failed: "URL 转换失败"
        }
      : {
          description:
            "Encode query params, redirect URLs, and reserved characters safely. Decode them back when you need to inspect production links.",
          inputLabel: `Value (${mode})`,
          outputLabel: "Encoded Result",
          placeholder: "name=hello world&next=/dashboard",
          encode: "Encode",
          decode: "Decode",
          failed: "Failed to transform URL"
        };

  return (
    <ToolShell
      title="URL Encoder"
      description={text.description}
      inputLabel={text.inputLabel}
      outputLabel={text.outputLabel}
      inputPlaceholder={text.placeholder}
      output={output}
      error={error}
      copy={copy}
      extras={
        <div className="flex gap-3">
          {(["encode", "decode"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                mode === option
                  ? "bg-cyan-300 text-slate-950"
                  : "border border-white/10 text-slate-300 hover:border-white/20"
              }`}
            >
              {option === "encode" ? text.encode : text.decode}
            </button>
          ))}
        </div>
      }
      onTransform={(input) => {
        try {
          setOutput(mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input));
          setError(null);
        } catch (err) {
          setOutput("");
          setError(err instanceof Error ? err.message : text.failed);
        }
      }}
      onClear={() => {
        setOutput("");
        setError(null);
      }}
    />
  );
}
