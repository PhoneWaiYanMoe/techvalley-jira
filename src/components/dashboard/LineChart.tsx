"use client";

import type { StatsTrendPoint } from "@/types/api";
import { useI18n } from "@/lib/i18n/client";

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function LineChart({
  points,
  color,
}: {
  points: StatsTrendPoint[];
  color: string;
}) {
  const { t } = useI18n();
  const total = points.reduce((sum, p) => sum + p.count, 0);

  if (points.length === 0 || total === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center">
        <p className="text-xs text-neutral-400">{t("stats.noActivity")}</p>
      </div>
    );
  }

  const max = Math.max(1, ...points.map((p) => p.count));
  const w = 100;
  const h = 36;
  const step = points.length > 1 ? w / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: points.length > 1 ? i * step : w / 2,
    y: h - (p.count / max) * (h - 4) - 2,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${h} L${coords[0].x},${h} Z`;

  // Sparse x-axis labels: first, middle, last (deduped for very short ranges).
  const labelIdxs = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[110px] w-full overflow-visible">
        <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={1.4} fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-neutral-400">
        {labelIdxs.map((idx) => (
          <span key={idx}>{formatDate(points[idx].date)}</span>
        ))}
      </div>
    </div>
  );
}
