// Shared visual atoms for issue rows/detail (colors per DESIGN.md, matching
// the local helpers in ProjectDashboard.tsx)

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "#f43f5e",
  MEDIUM: "#e0982e",
  LOW: "#94a3b8",
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  Backlog: { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-500" },
  "In Progress": { bg: "bg-indigo-50 dark:bg-indigo-950", text: "text-indigo-600" },
  "In Review": { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600" },
  Done: { bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-600" },
};

export function dueLabel(dateStr: string | null): { label: string; color: string; bg: string } {
  if (!dateStr) return { label: "No due", color: "text-neutral-400", bg: "bg-neutral-100 dark:bg-neutral-800" };
  const now = new Date();
  const due = new Date(dateStr);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${-diffDays}d overdue`, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950" };
  if (diffDays === 0) return { label: "Today", color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950" };
  if (diffDays <= 3) return { label: `in ${diffDays}d`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" };
  return { label: `in ${diffDays}d`, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" };
}

export function StatusPill({ name }: { name: string }) {
  const badge = STATUS_BADGE[name] ?? STATUS_BADGE["Backlog"];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${badge.bg} ${badge.text}`}>
      {name}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: string }) {
  return (
    <span
      title={priority.charAt(0) + priority.slice(1).toLowerCase()}
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: PRIORITY_DOT[priority] ?? "#94a3b8" }}
    />
  );
}

export function DueBadge({ dueDate }: { dueDate: string | null }) {
  const dl = dueLabel(dueDate);
  return (
    <span className={`min-w-[64px] shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-bold ${dl.color} ${dl.bg}`}>
      {dl.label}
    </span>
  );
}
