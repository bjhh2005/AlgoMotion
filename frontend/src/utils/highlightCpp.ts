import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";

hljs.registerLanguage("cpp", cpp);

export function highlightCpp(code: string): string {
  return hljs.highlight(code, { language: "cpp" }).value;
}
