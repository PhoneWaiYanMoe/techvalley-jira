"use client";

import type { ProjectResponse } from "@/types/api";

const STATUS_COLORS: Record<string, string> = {
  Backlog: "#94a3b8",
  "In Progress": "#6366f1",
  "In Review": "#e0982e",
  Done: "#10b981",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function ProjectCard({
  project,
  onOpen,
  onToggleFav,
}: {
  project: ProjectResponse;
  onOpen: () => void;
  onToggleFav: () => void;
}) {
  const total = Object.values(project.issueCounts).reduce((a, b) => a + b, 0);
  const done = project.issueCounts["Done"] ?? 0;
  const donePct = total ? Math.round((done / total) * 100) : 0;

  // Build status segments for the mini bar
  const segments = Object.entries(project.issueCounts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({
      name,
      pct: total ? (count / total) * 100 : 0,
      color: STATUS_COLORS[name] ?? "#94a3b8",
    }));

  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer flex-col rounded-xl border border-neutral-200 bg-white p-4.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <div
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] text-sm font-extrabold"
          style={{
            backgroundColor: `${project.isArchived ? "#94a3b8" : STATUS_COLORS["In Progress"]}20`,
            color: project.isArchived ? "#94a3b8" : STATUS_COLORS["In Progress"],
          }}
        >
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold tracking-tight">
              {project.name}
            </span>
            {project.isArchived && (
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-widest text-neutral-400 dark:bg-neutral-800">
                Archived
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-neutral-400">
            {project.isArchived
              ? "Archived"
              : `Created ${timeAgo(project.createdAt)}`}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          title="Favorite"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border-none bg-transparent transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={project.isFavorited ? "#f5a623" : "none"}
            stroke={project.isFavorited ? "#f5a623" : "currentColor"}
            strokeWidth="2"
          >
            <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.6 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
          </svg>
        </button>
      </div>

      {/* Description */}
      <p className="mb-4 line-clamp-2 min-h-[40px] text-[12.8px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        {project.description || "No description"}
      </p>

      {/* Mini status bar */}
      <div className="mb-2.5 flex h-[7px] overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
        {segments.map((seg) => (
          <div
            key={seg.name}
            title={`${seg.name}: ${Math.round(seg.pct)}%`}
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <span className="text-xs text-neutral-500">
            <b className="font-mono text-neutral-900 dark:text-neutral-100">
              {total}
            </b>{" "}
            issues
          </span>
          <span className="text-xs text-neutral-500">
            <b className="font-mono text-emerald-600">{donePct}%</b> done
          </span>
        </div>
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: STATUS_COLORS["In Progress"] }}
          title={project.ownerName}
        >
          {project.ownerInitials}
        </div>
      </div>
    </div>
  );
}
