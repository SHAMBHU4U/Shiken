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
      return `<code class="text-indigo-300 text-xs bg-indigo-950/40 px-1 rounded">${math}</code>`;
    }
  });

  // Inline math $...$
  html = html.replace(/\$([^$\n]+?)\$/g, (_m, math: string) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: "html" });
    } catch {
      return `<code class="text-indigo-300 text-xs bg-indigo-950/40 px-1 rounded">${math}</code>`;
    }
  });

  // Strip stray markdown artifacts
  html = html.replace(/\*\*(.+?)\*\*/g, "$1");
  html = html.replace(/\*(.+?)\*/g, "$1");
  html = html.replace(/^#+\s*/gm, "");

  // Correct answer line — green highlight
  html = html.replace(
    /^(सही जवाब:.+|Correct Answer:.+)$/gm,
    '<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-2 font-semibold text-green-300" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25)">$1</div>'
  );

  // Section headers — Hindi and English variants
  html = html.replace(
    /^(हल:|Solution:|सूत्र \/ सिद्धांत:|Formula \/ Theory:|Formula:|याद रखो:|Remember:)\s*$/gm,
    '<div class="mt-3.5 mb-1.5 text-xs font-bold tracking-widest uppercase" style="color:rgba(165,180,252,0.6)">$1</div>'
  );

  // Bullet points • at line start — styled
  html = html.replace(
    /^•\s(.+)$/gm,
    '<div class="flex gap-2 mt-1.5"><span class="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" style="margin-top:5px"></span><span>$1</span></div>'
  );

  // Arrow → sub-points
  html = html.replace(
    /^→\s(.+)$/gm,
    '<div class="flex gap-1.5 mt-1 ml-4"><span class="text-indigo-400 shrink-0">→</span><span>$1</span></div>'
  );

  // Newlines → line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

export default function ExplainText({ text, loading = false }: { text: string; loading?: boolean }) {
  const html = useMemo(() => renderExplain(text), [text]);
  return (
    <div className="text-xs leading-relaxed text-white/80">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {loading && (
        <span
          className="inline-block w-1 h-3 bg-indigo-400 rounded-sm ml-0.5 align-middle"
          style={{ animation: "blink 0.8s step-start infinite" }}
        />
      )}
    </div>
  );
}
