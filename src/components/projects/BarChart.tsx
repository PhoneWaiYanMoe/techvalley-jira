"use client";

type BarItem = {
  label: string;
  value: number;
  color: string;
  /** Optional right-side display (e.g. avatar + name) */
  prefix?: React.ReactNode;
  /** Optional right-aligned value suffix */
  suffix?: string;
};

export function BarChart({
  items,
  maxValue,
}: {
  items: BarItem[];
  maxValue: number;
}) {
  const max = Math.max(1, maxValue);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2.5">
          {item.prefix}
          <span className="w-24 truncate text-xs font-semibold">{item.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-md transition-[width] duration-500 ease-out"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="w-6 text-right font-mono text-xs text-neutral-500">
            {item.value}
          </span>
          {item.suffix && (
            <span className="text-xs text-neutral-400">{item.suffix}</span>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-neutral-400">No data</p>
      )}
    </div>
  );
}
