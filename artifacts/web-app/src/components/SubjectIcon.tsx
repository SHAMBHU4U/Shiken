import React from "react";

const SIZE_MAP = {
  sm:  "w-4 h-4",
  md:  "w-7 h-7",
  lg:  "w-12 h-12",
  xl:  "w-14 h-14",
};

export function SubjectIcon({
  id,
  color,
  size = "md",
  className = "",
}: {
  id: string;
  color: string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}) {
  const cls = `${SIZE_MAP[size]} ${className}`.trim();
  const sw: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24", fill: "none", stroke: color,
    strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round",
    className: cls,
  };

  if (id === "maths") return (
    <svg {...sw}>
      <path d="M3 8h18" /><path d="M8.5 8v10" />
      <path d="M15.5 8v6c0 2 2.5 2 2.5 4" />
    </svg>
  );
  if (id === "english") return (
    <svg {...sw}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h5" />
    </svg>
  );
  if (id === "hindi") return (
    <svg viewBox="0 0 24 24" className={cls}>
      <text x="12" y="17" textAnchor="middle"
        fontSize={size === "lg" || size === "xl" ? "13" : size === "sm" ? "11" : "15"}
        fontWeight="800" fill={color} fontFamily="system-ui,sans-serif">अ</text>
    </svg>
  );
  if (id === "science") return (
    <svg {...{ ...sw, strokeWidth: "1.5" }}>
      <circle cx="12" cy="12" r="2.5" fill={color} stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)" />
    </svg>
  );
  if (id === "social") return (
    <svg {...{ ...sw, strokeWidth: "1.5" }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 3.5 9 14 14 0 0 1-3.5 9 14 14 0 0 1-3.5-9A14 14 0 0 1 12 3z" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" className={cls}>
      <text x="12" y="17" textAnchor="middle"
        fontSize={size === "lg" || size === "xl" ? "13" : size === "sm" ? "11" : "14"}
        fontWeight="800" fill={color} fontFamily="system-ui,sans-serif">ॐ</text>
    </svg>
  );
}
