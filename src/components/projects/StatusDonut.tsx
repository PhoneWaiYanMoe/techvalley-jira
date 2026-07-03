"use client";

type Segment = {
  name: string;
  count: number;
  color: string;
};

export function StatusDonut({
  segments,
  total,
}: {
  segments: Segment[];
  total: number;
}) {
  // Build conic-gradient stops
  let acc = 0;
  const stops = segments
    .filter((s) => s.count > 0)
    .map((s) => {
      const pct = total ? (s.count / total) * 100 : 0;
      const start = acc;
      acc += pct;
      return `${s.color} ${start.toFixed(2)}% ${acc.toFixed(2)}%`;
    });

  const gradient =
    total > 0 ? `conic-gradient(${stops.join(",")})` : undefined;

  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Donut */}
      <div className="relative h-[150px] w-[150px] shrink-0 overflow-hidden rounded-full">
        {gradient ? (
          <div
            className="h-full w-full rounded-full"
            style={{ background: gradient }}
          />
        ) : (
          <div className="h-full w-full rounded-full bg-neutral-100 dark:bg-neutral-800" />
        )}
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white dark:bg-neutral-900">
          <span className="text-3xl font-extrabold tracking-tight">{total}</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-widest text-neutral-400">
            issues
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex min-w-[150px] flex-1 flex-col gap-2.5">
        {segments.map((s) => {
          const pct = total ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={s.name} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 text-[13px] font-semibold">{s.name}</span>
              <span className="w-8 text-right font-mono text-xs text-neutral-500">
                {s.count}
              </span>
              <span className="w-9 text-right font-mono text-xs text-neutral-400">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
