"use client";

import { json } from "@codemirror/lang-json";
import { useState } from "react";

import { ToolShell } from "@/components/tool-shell";
import { type Locale, getDictionary } from "@/lib/i18n";

export function JsonFormatterTool({ locale }: { locale: Locale }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = getDictionary(locale).toolUi;
  const text =
    locale === "zh"
      ? {
          description: "在浏览器内完成 JSON 格式化和校验，适合调试接口返回、配置文件和请求 payload。",
          inputLabel: "粘贴 JSON",
          outputLabel: "格式化结果",
          placeholder: '{"name":"codex","stack":["next","tailwind"]}',
          invalid: "无效的 JSON"
        }
      : {
          description:
            "Format and validate JSON locally in the browser. Useful for API debugging, config cleanup, and quick payload inspection.",
          inputLabel: "Paste JSON",
          outputLabel: "Formatted JSON",
          placeholder: '{"name":"codex","stack":["next","tailwind"]}',
          invalid: "Invalid JSON"
        };

  return (
    <ToolShell
      title="JSON Formatter"
      description={text.description}
      inputLabel={text.inputLabel}
      outputLabel={text.outputLabel}
      inputPlaceholder={text.placeholder}
      output={output}
      error={error}
      copy={copy}
      inputExtensions={[json()]}
      outputExtensions={[json()]}
      onTransform={(input) => {
        try {
          const parsed = JSON.parse(input);
          setOutput(JSON.stringify(parsed, null, 2));
          setError(null);
        } catch (err) {
          setOutput("");
          setError(err instanceof Error ? err.message : text.invalid);
        }
      }}
      onClear={() => {
        setOutput("");
        setError(null);
      }}
    />
  );
}
