import { useCallback, useMemo, useRef } from "react";
import { handleCodeEditorKeyDown, normalizeCodeString } from "./code-editor-utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  tabSize?: number;
  readOnly?: boolean;
  placeholder?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = "C++",
  tabSize = 4,
  readOnly = false,
  placeholder
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const displayValue = useMemo(() => normalizeCodeString(value), [value]);
  const lineCount = useMemo(() => {
    const lines = displayValue.split("\n").length;
    return Math.max(lines, 12);
  }, [displayValue]);

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const gutter = gutterRef.current;
    if (textarea && gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
  }, []);

  return (
    <div className="oj-editor">
      <div className="oj-editor-bar">
        <span>{language}</span>
        <span className="muted">UTF-8 · Tab Size {tabSize}</span>
      </div>
      <div className="oj-editor-body">
        <div ref={gutterRef} className="oj-editor-gutter" aria-hidden>
          {Array.from({ length: lineCount }, (_, index) => (
            <div key={index + 1} className="oj-editor-line-number">
              {index + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={displayValue}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          className="oj-editor-area"
          placeholder={placeholder}
          onScroll={syncScroll}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (readOnly) return;
            handleCodeEditorKeyDown(event, displayValue, onChange);
          }}
        />
      </div>
    </div>
  );
}
