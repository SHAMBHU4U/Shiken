import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

interface MathTextProps {
  text: string;
  className?: string;
  block?: boolean;
}

function renderMath(raw: string): string {
  if (!raw) return "";

  // Process display math first: $$...$$ → block
  let result = raw.replace(/\$\$([^$]+?)\$\$/g, (_match, math: string) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, output: "html" });
    } catch {
      return `<span class="math-error">${math}</span>`;
    }
  });

  // Then inline math: $...$
  result = result.replace(/\$([^$\n]+?)\$/g, (_match, math: string) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: "html" });
    } catch {
      return `<span class="math-error">${math}</span>`;
    }
  });

  return result;
}

export default function MathText({ text, className = "", block = false }: MathTextProps) {
  const html = useMemo(() => renderMath(text), [text]);
  const Tag = block ? "div" : "span";
  return (
    <Tag
      className={`math-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
