import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";

marked.setOptions({
  gfm: true,
  breaks: true
});

marked.use(
  markedKatex({
    throwOnError: false,
    nonStandard: true
  })
);

interface Props {
  markdown: string;
  className?: string;
}

export function MarkdownContent({ markdown, className = "" }: Props) {
  const html = marked.parse(markdown || "") as string;

  return (
    <article
      className={`oj-markdown ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
