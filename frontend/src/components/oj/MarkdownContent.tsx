import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true
});

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
