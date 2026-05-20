export const TAB_SIZE = 4;
export const TAB_SPACES = " ".repeat(TAB_SIZE);

/**
 * 规范化代码/判题 I/O 字符串：
 * 1. 将 JSON/API 中的字面量 \\n \\t \\r 转为真实换行与制表符
 * 2. 将 CRLF、单独 CR 统一为 LF（\\n）
 */
export function normalizeCodeString(source: string): string {
  if (!source) return "";

  return source
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function getLineIndent(line: string) {
  const match = line.match(/^\s*/);
  return match?.[0] ?? "";
}

function indentBlock(text: string, spaces: string) {
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? spaces + line : line))
    .join("\n");
}

function outdentBlock(text: string) {
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith(TAB_SPACES)) return line.slice(TAB_SPACES.length);
      if (line.startsWith("\t")) return line.slice(1);
      return line.replace(/^ {1,2}/, "");
    })
    .join("\n");
}

export function handleCodeEditorKeyDown(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (next: string) => void
) {
  const element = event.currentTarget;
  const start = element.selectionStart;
  const end = element.selectionEnd;

  if (event.key === "Tab") {
    event.preventDefault();
    const selected = value.slice(start, end);
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
    const block = value.slice(lineStart, blockEnd);

    if (start !== end || block.includes("\n")) {
      const updated = event.shiftKey ? outdentBlock(block) : indentBlock(block, TAB_SPACES);
      const next = value.slice(0, lineStart) + updated + value.slice(blockEnd);
      onChange(next);
      const offset = event.shiftKey ? -TAB_SPACES.length : TAB_SPACES.length;
      requestAnimationFrame(() => {
        element.selectionStart = lineStart;
        element.selectionEnd = blockEnd + (updated.length - block.length);
        if (start === end && !block.includes("\n")) {
          element.selectionStart = element.selectionEnd = Math.max(lineStart, start + offset);
        }
      });
      return;
    }

    const next = value.slice(0, start) + TAB_SPACES + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      element.selectionStart = element.selectionEnd = start + TAB_SPACES.length;
    });
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lineStart = before.lastIndexOf("\n") + 1;
    const currentLine = before.slice(lineStart);
    const indent = getLineIndent(currentLine);
    const trimmed = currentLine.trimEnd();
    const extra =
      trimmed.endsWith("{") || trimmed.endsWith(":") ? TAB_SPACES : "";
    const insert = `\n${indent}${extra}`;
    const next = before + insert + after;
    onChange(next);
    const cursor = start + insert.length;
    requestAnimationFrame(() => {
      element.selectionStart = element.selectionEnd = cursor;
    });
  }
}
