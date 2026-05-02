import katex from "katex";
import { useMemo } from "react";

function renderExplain(raw: string): string {
  if (!raw) return "";

  let html = raw;

  // Display math $$...$$ — block centered
  html = html.replace(/\$\$([^$]+?)\$\$/g, (_m, math: string) => {
    try {
      return `<div class="my-2 overflow-x-auto text-center">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, output: "html" })}</div>`;
    } catch {
      return `<code class="text-indigo-300 text-xs">${math}</code>`;
    }
  });

  // Inline math $...$
  html = html.replace(/\$([^$\n]+?)\$/g, (_m, math: string) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: "html" });
    } catch {
      return `<code class="text-indigo-300 text-xs">${math}</code>`;
    }
  });

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');

  // Arrow bullets → at line start
  html = html.replace(/^→\s(.+)$/gm, '<span class="flex gap-1.5 mt-0.5"><span class="text-indigo-400 shrink-0">→</span><span>$1</span></span>');

  // Emoji section headers (lines starting with emoji + text, no colon needed)
  html = html.replace(/^([\u{1F300}-\u{1FAFF}✅📐💡🎯⚠️🔑📝])\s(.+)$/gmu,
    '<div class="mt-2.5 mb-0.5 font-semibold text-white/90 flex gap-1.5"><span>$1</span><span>$2</span></div>');

  // Newlines → line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

export default function ExplainText({ text, loading = false }: { text: string; loading?: boolean }) {
  const html = useMemo(() => renderExplain(text), [text]);
  return (
    <div className="text-xs leading-relaxed text-white/78 space-y-0.5">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {loading && (
        <span
          className="inline-block w-1 h-3 bg-indigo-400 rounded-sm ml-0.5 align-middle animate-pulse"
          style={{ animation: "blink 0.8s step-start infinite" }}
        />
      )}
    </div>
  );
}
