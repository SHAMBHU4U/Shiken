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
      return `<code class="text-indigo-800 text-xs bg-indigo-100 px-1 rounded">${math}</code>`;
    }
  });

  // Inline math $...$
  html = html.replace(/\$([^$\n]+?)\$/g, (_m, math: string) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: "html" });
    } catch {
      return `<code class="text-indigo-800 text-xs bg-indigo-100 px-1 rounded">${math}</code>`;
    }
  });

  // Strip stray markdown artifacts
  html = html.replace(/\*\*(.+?)\*\*/g, "$1");
  html = html.replace(/\*(.+?)\*/g, "$1");
  html = html.replace(/^#+\s*/gm, "");

  // Correct answer line — green highlight
  html = html.replace(
    /^(सही जवाब:.+|Correct Answer:.+)$/gm,
    '<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-2 font-semibold text-green-800" style="background:#dcfce7;border:1px solid #86efac">$1</div>'
  );

  // Section headers — Hindi and English variants
  html = html.replace(
    /^(हल:|Solution:|सूत्र \/ सिद्धांत:|Formula \/ Theory:|Formula:|याद रखो:|Remember:)\s*$/gm,
    '<div class="mt-3.5 mb-1.5 text-xs font-bold tracking-widest uppercase" style="color:#3730a3">$1</div>'
  );

  // Bullet points • at line start — styled vertical block
  html = html.replace(
    /^•\s(.+)$/gm,
    '<div class="flex gap-2 mt-1.5" style="align-items:flex-start"><span class="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-700 inline-block" style="margin-top:4px"></span><span style="flex:1;min-width:0;word-break:break-word">$1</span></div>'
  );

  // Arrow → sub-points
  html = html.replace(
    /^→\s(.+)$/gm,
    '<div class="flex gap-1.5 mt-1 ml-4" style="align-items:flex-start"><span class="text-indigo-700 shrink-0">→</span><span style="flex:1;min-width:0;word-break:break-word">$1</span></div>'
  );

  // Only convert newlines that are between plain text — NOT between HTML tags.
  // This prevents <br> being injected between </div> and <div> which breaks vertical stacking.
  html = html.replace(/(?<!>)\n(?!<)/g, "<br>");

  // Clean up any bare newlines left between block elements (no visible output needed)
  html = html.replace(/>\n</g, "><");

  return html;
}

export default function ExplainText({ text, loading = false }: { text: string; loading?: boolean }) {
  const html = useMemo(() => renderExplain(text), [text]);
  return (
    <div
      className="text-sm leading-relaxed text-slate-800"
      style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
    >
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
