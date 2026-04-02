"use client";

import CodeMirror from "@uiw/react-codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

export function CodeEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  extensions = [],
  minHeight = "420px"
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  extensions?: Extension[];
  minHeight?: string;
}) {
  const editorExtensions = [
    EditorView.lineWrapping,
    ...extensions,
    ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [])
  ];

  return (
    <div className="h-full overflow-hidden rounded-xl border border-white/10 bg-[#0a1226] shadow-[0_12px_36px_rgba(2,6,23,0.26)] sm:rounded-2xl">
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={oneDark}
        placeholder={placeholder}
        basicSetup={{
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: !readOnly,
          highlightSelectionMatches: false,
          lineNumbers: true
        }}
        editable={!readOnly}
        extensions={editorExtensions}
        style={{ fontSize: "13px", minHeight, height: "100%" }}
      />
    </div>
  );
}
