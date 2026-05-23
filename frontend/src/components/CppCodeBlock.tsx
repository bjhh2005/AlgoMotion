import { useMemo } from "react";
import "highlight.js/styles/atom-one-dark.min.css";
import { highlightCpp } from "../utils/highlightCpp";

interface Props {
  code: string;
  className?: string;
}

export function CppCodeBlock({ code, className = "" }: Props) {
  const highlighted = useMemo(() => highlightCpp(code), [code]);

  return (
    <pre className={`detail-code-block ${className}`.trim()}>
      <code
        className="language-cpp hljs"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}
