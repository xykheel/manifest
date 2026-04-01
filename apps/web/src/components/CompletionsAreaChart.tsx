import { useId, useState } from "react";

export type CompletionsTimelineRow = { label: string; count: number };

type Props = {
  data: CompletionsTimelineRow[];
  ariaLabel?: string;
  /** Noun phrase after the count in the tooltip, e.g. "completion(s)" or "organisation completions". */
  countLabel?: string;
};

export function CompletionsAreaChart({
  data,
  ariaLabel = "Completions over time",
  countLabel = "completion(s)",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const gradId = `area-fill-${uid}`;
  const [hover, setHover] = useState<{ label: string; count: number } | null>(null);
  const w = 640;
  const h = 220;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxY = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const stepX = n <= 1 ? 0 : innerW / (n - 1);

  const points = data.map((d, i) => {
    const x = padL + (n <= 1 ? innerW / 2 : i * stepX);
    const y = padT + innerH - (d.count / maxY) * innerH;
    return { x, y, ...d };
  });

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD =
    points.length > 0
      ? `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : "";

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + innerH * (1 - t));
  /** When maxY is 1, ceil(maxY/2) and maxY are both 1 — dedupe so keys and labels stay unique. */
  const yAxisTicks = Array.from(new Set([0, Math.ceil(maxY / 2), maxY]));

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[280px] w-full text-slate-500 dark:text-slate-400"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00A3AD" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00A3AD" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {gridYs.map((gy, i) => (
          <line
            key={`grid-${i}-${gy.toFixed(2)}`}
            x1={padL}
            y1={gy}
            x2={w - padR}
            y2={gy}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeDasharray="4 6"
            strokeWidth={1}
          />
        ))}
        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}
        {lineD && (
          <path
            d={lineD}
            fill="none"
            stroke="#00A3AD"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={`pt-${i}-${p.label}`}
            cx={p.x}
            cy={p.y}
            r={6}
            fill="#00A3AD"
            className="cursor-pointer"
            onMouseEnter={() => setHover({ label: p.label, count: p.count })}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {points.map((p, i) => (
          <text
            key={`tx-${i}-${p.label}`}
            x={p.x}
            y={h - 8}
            textAnchor="middle"
            className="fill-current text-[10px]"
          >
            {p.label}
          </text>
        ))}
        {yAxisTicks.map((tick, i) => {
          const gy = padT + innerH - (tick / maxY) * innerH;
          return (
            <text key={`y-tick-${i}-${tick}`} x={4} y={gy + 4} className="fill-current text-[10px]">
              {tick}
            </text>
          );
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-slate-600 dark:bg-slate-800">
          <div className="font-medium text-slate-800 dark:text-slate-100">{hover.label}</div>
          <div className="text-slate-600 dark:text-slate-300">
            {hover.count} {countLabel}
          </div>
        </div>
      )}
    </div>
  );
}
