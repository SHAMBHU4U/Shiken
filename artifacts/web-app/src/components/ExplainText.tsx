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

  // Strip any stray asterisks or hashes that slip through
  html = html.replace(/\*\*(.+?)\*\*/g, "$1");
  html = html.replace(/\*(.+?)\*/g, "$1");
  html = html.replace(/^#+\s*/gm, "");

  // Arrow bullets → at line start
  html = html.replace(/^→\s(.+)$/gm, '<span class="flex gap-1.5 mt-0.5"><span class="text-indigo-400 shrink-0">→</span><span>$1</span></span>');

  // Section header lines (e.g. "हल:", "Formula / Theory:", "Notes:") — style them
  html = html.replace(/^(सही जवाब:.+)$/gm, '<div class="mt-1 mb-1 font-semibold text-green-400">$1</div>');
  html = html.replace(/^(हल:|Formula \/ Theory:|Notes:|Formula:|Theory:)\s*$/gm, '<div class="mt-3 mb-1 font-semibold text-white/70 text-xs uppercase tracking-wide">$1</div>');

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
