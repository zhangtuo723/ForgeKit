"use client";

import { json } from "@codemirror/lang-json";
import { useState } from "react";
import { parse, stringify } from "yaml";

import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";
import { type Locale, getDictionary } from "@/lib/i18n";

const jsonSample = `{
  "apiVersion": "v1",
  "kind": "ConfigMap",
  "metadata": {
    "name": "forgekit-config"
  },
  "data": {
    "theme": "dark",
    "region": "ap-southeast-1"
  }
}`;

const yamlSample = `apiVersion: v1
kind: ConfigMap
metadata:
  name: forgekit-config
data:
  theme: dark
  region: ap-southeast-1
`;

export function JsonYamlConverterTool({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).toolUi;
  const [mode, setMode] = useState<"json-to-yaml" | "yaml-to-json">("json-to-yaml");
  const [input, setInput] = useState(jsonSample);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const text =
    locale === "zh"
      ? {
          description: "在浏览器内完成 JSON 和 YAML 双向转换，适合处理配置文件、Kubernetes 片段和结构化文本。",
          inputLabel: `输入（${mode === "json-to-yaml" ? "JSON 转 YAML" : "YAML 转 JSON"}）`,
          outputLabel: "结果",
          jsonToYaml: "JSON -> YAML",
          yamlToJson: "YAML -> JSON",
          failed: "转换失败",
          invalidJson: "请输入合法的 JSON",
          invalidYaml: "请输入合法的 YAML",
          reset: "恢复示例"
        }
      : {
          description:
            "Convert between JSON and YAML locally in the browser for config files, Kubernetes snippets, and structured text cleanup.",
          inputLabel: `Input (${mode === "json-to-yaml" ? "JSON to YAML" : "YAML to JSON"})`,
          outputLabel: "Result",
          jsonToYaml: "JSON -> YAML",
          yamlToJson: "YAML -> JSON",
          failed: "Failed to convert content",
          invalidJson: "Please provide valid JSON",
          invalidYaml: "Please provide valid YAML",
          reset: "Reset sample"
        };

  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <div className="flex min-h-[600px] flex-col rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:min-h-[620px] sm:p-5">
        <div className="mb-4 border-b border-white/8 pb-4">
          <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">JSON YAML Converter</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{text.description}</p>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-slate-300">{text.inputLabel}</label>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Input</span>
        </div>
        <div className="flex-1">
          <CodeEditor
            value={input}
            onChange={setInput}
            extensions={mode === "json-to-yaml" ? [json()] : []}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
          <div className="flex flex-wrap gap-2.5">
            {(["json-to-yaml", "yaml-to-json"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={mode === option ? "default" : "secondary"}
                onClick={() => {
                  setMode(option);
                  setInput(option === "json-to-yaml" ? jsonSample : yamlSample);
                  setOutput("");
                  setError(null);
                }}
              >
                {option === "json-to-yaml" ? text.jsonToYaml : text.yamlToJson}
              </Button>
            ))}
            <Button
              type="button"
              onClick={() => {
                try {
                  if (mode === "json-to-yaml") {
                    const parsed = JSON.parse(input);
                    setOutput(stringify(parsed));
                  } else {
                    const parsed = parse(input);
                    setOutput(JSON.stringify(parsed, null, 2));
                  }
                  setError(null);
                } catch (err) {
                  setOutput("");
                  if (mode === "json-to-yaml") {
                    setError(err instanceof Error ? err.message : text.invalidJson);
                  } else {
                    setError(err instanceof Error ? err.message : text.invalidYaml);
                  }
                }
              }}
            >
              {copy.run}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setInput(mode === "json-to-yaml" ? jsonSample : yamlSample);
                setOutput("");
                setError(null);
              }}
            >
              {text.reset}
            </Button>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">Local processing</span>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>

      <div className="flex min-h-[600px] flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:min-h-[620px] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            {text.outputLabel}
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
            extensions={mode === "yaml-to-json" ? [json()] : []}
          />
        </div>
      </div>
    </section>
  );
}
