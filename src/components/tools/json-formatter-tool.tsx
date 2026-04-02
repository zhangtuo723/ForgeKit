"use client";

import { useState } from "react";

import { ToolShell } from "@/components/tool-shell";

export function JsonFormatterTool() {
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <ToolShell
      title="JSON Formatter"
      description="Format and validate JSON locally in the browser. Useful for API debugging, config cleanup, and quick payload inspection."
      inputLabel="Paste JSON"
      outputLabel="Formatted JSON"
      inputPlaceholder='{"name":"codex","stack":["next","tailwind"]}'
      output={output}
      error={error}
      onTransform={(input) => {
        try {
          const parsed = JSON.parse(input);
          setOutput(JSON.stringify(parsed, null, 2));
          setError(null);
        } catch (err) {
          setOutput("");
          setError(err instanceof Error ? err.message : "Invalid JSON");
        }
      }}
      onClear={() => {
        setOutput("");
        setError(null);
      }}
    />
  );
}
