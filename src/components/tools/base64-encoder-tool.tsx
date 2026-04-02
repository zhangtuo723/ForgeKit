"use client";

import { useState } from "react";

import { ToolShell } from "@/components/tool-shell";

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

export function Base64EncoderTool() {
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  return (
    <ToolShell
      title="Base64 Encoder"
      description="Encode and decode Base64 locally. Good for debugging payloads, headers, and browser-side transformations."
      inputLabel={`Input (${mode})`}
      outputLabel="Result"
      inputPlaceholder="Paste plain text or Base64 content"
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
          setOutput(mode === "encode" ? encodeUnicode(input) : decodeUnicode(input));
          setError(null);
        } catch (err) {
          setOutput("");
          setError(err instanceof Error ? err.message : "Failed to transform content");
        }
      }}
      onClear={() => {
        setOutput("");
        setError(null);
      }}
    />
  );
}
