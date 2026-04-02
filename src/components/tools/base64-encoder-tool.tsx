"use client";

import { useState } from "react";

import { ToolShell } from "@/components/tool-shell";
import { type Locale, getDictionary } from "@/lib/i18n";

function encodeUnicode(input: string) {
  const bytes = new TextEncoder().encode(input);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
}

function decodeUnicode(input: string) {
  const binary = atob(input);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function Base64EncoderTool({ locale }: { locale: Locale }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const copy = getDictionary(locale).toolUi;
  const text =
    locale === "zh"
      ? {
          description: "在浏览器内进行 Base64 编码和解码，适合调试 payload、header 和文本转换。",
          inputLabel: `输入（${mode === "encode" ? "编码" : "解码"}）`,
          outputLabel: "结果",
          placeholder: "粘贴普通文本或 Base64 内容",
          encode: "编码",
          decode: "解码",
          failed: "转换失败"
        }
      : {
          description:
            "Encode and decode Base64 locally. Good for debugging payloads, headers, and browser-side transformations.",
          inputLabel: `Input (${mode})`,
          outputLabel: "Result",
          placeholder: "Paste plain text or Base64 content",
          encode: "Encode",
          decode: "Decode",
          failed: "Failed to transform content"
        };

  return (
    <ToolShell
      title="Base64 Encoder"
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
          setOutput(mode === "encode" ? encodeUnicode(input) : decodeUnicode(input));
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
