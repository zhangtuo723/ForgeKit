"use client";

import { useState } from "react";

import { ToolShell } from "@/components/tool-shell";

export function UrlEncoderTool() {
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  return (
    <ToolShell
      title="URL Encoder"
      description="Encode query params, redirect URLs, and reserved characters safely. Decode them back when you need to inspect production links."
      inputLabel={`Value (${mode})`}
      outputLabel="Encoded Result"
      inputPlaceholder="name=hello world&next=/dashboard"
      output={output}
      error={error}
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
              {option === "encode" ? "Encode" : "Decode"}
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
          setError(err instanceof Error ? err.message : "Failed to transform URL");
        }
      }}
      onClear={() => {
        setOutput("");
        setError(null);
      }}
    />
  );
}
