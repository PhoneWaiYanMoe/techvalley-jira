"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectDashboardResponse, DashboardIssue } from "@/types/api";
import { StatusDonut } from "./StatusDonut";
import { BarChart } from "./BarChart";

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

function dueLabel(dateStr: string | null): { label: string; color: string; bg: string } {
  if (!dateStr) return { label: "No due", color: "text-neutral-400", bg: "bg-neutral-100 dark:bg-neutral-800" };
  const now = new Date();
  const due = new Date(dateStr);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${-diffDays}d overdue`, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950" };
  if (diffDays === 0) return { label: "Today", color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950" };
  if (diffDays <= 3) return { label: `in ${diffDays}d`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" };
  return { label: `in ${diffDays}d`, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "now";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/dashboard`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to load dashboard");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">{error ?? "Failed to load"}</p>
      </div>
    );
  }

  const { project, kpis, statusBreakdown, priorityBreakdown, workloadByAssignee, recentIssues, dueSoonIssues } = data;

  const kpiCards = [
    { label: "Total issues", value: kpis.totalIssues, sub: "across all statuses", color: "#4f46e5" },
    { label: "Completion", value: `${kpis.completionRate}%`, sub: `${Math.round(kpis.totalIssues * kpis.completionRate / 100)} of ${kpis.totalIssues} done`, color: "#0e9f6e" },
    { label: "In flight", value: kpis.inFlight, sub: "in progress + review", color: "#6366f1" },
    { label: "High priority", value: kpis.highPriorityOpen, sub: "needs attention", color: "#f43f5e" },
  ];

  // AI summary text
  const total = kpis.totalIssues;
  const done = Math.round(total * kpis.completionRate / 100);
  const high = kpis.highPriorityOpen;
  const aiText = `${project.name} is ${kpis.completionRate}% complete with ${kpis.inFlight} ${kpis.inFlight === 1 ? "item" : "items"} actively in flight and ${total - done - kpis.inFlight} still in the backlog. ${high > 0 ? `${high} high-priority ${high === 1 ? "issue is" : "issues are"} open and should be triaged first` : "No high-priority work is currently blocked"}. Momentum looks ${kpis.completionRate >= 60 ? "strong — focus on closing out review" : kpis.completionRate >= 30 ? "steady — keep the in-progress queue small" : "early — clarify scope before pulling more work"}.`;

  return (
    <div className="pb-11">
      {/* Project info */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <p className="min-w-[260px] max-w-[640px] flex-1 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          {project.description || "No description"}
        </p>
        <div className="flex gap-5">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-widest text-neutral-400">Owner</div>
            <div className="mt-1.5 flex items-center gap-2">
              <div
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9.5px] font-bold text-white"
                style={{ backgroundColor: "#6366f1" }}
              >
                {project.ownerInitials}
              </div>
              <span className="text-xs font-semibold">{project.ownerName}</span>
            </div>
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-widest text-neutral-400">Created</div>
            <div className="mt-2 text-xs font-semibold">
              {new Date(project.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        {kpiCards.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="mb-2.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: k.color }} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                {k.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight">{k.value}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-neutral-500">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-[1.15fr_1fr] items-start gap-4 max-lg:grid-cols-1">
        {/* LEFT column */}
        <div className="flex flex-col gap-4">
          {/* Status donut */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4.5 text-[13.5px] font-bold">Issues by status</div>
            <StatusDonut segments={statusBreakdown} total={kpis.totalIssues} />
          </div>

          {/* Priority bars */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4 text-[13.5px] font-bold">Issues by priority</div>
            <BarChart
              items={priorityBreakdown.map((p) => ({
                label: p.name,
                value: p.count,
                color: p.color,
              }))}
              maxValue={Math.max(1, ...priorityBreakdown.map((p) => p.count))}
            />
          </div>

          {/* Workload */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4 text-[13.5px] font-bold">Open work by assignee</div>
            <BarChart
              items={workloadByAssignee.map((w) => ({
                label: w.name,
                value: w.openCount,
                color: w.color,
                prefix: (
                  <div
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: w.color }}
                  >
                    {w.initials}
                  </div>
                ),
              }))}
              maxValue={Math.max(1, ...workloadByAssignee.map((w) => w.openCount))}
            />
          </div>
        </div>

        {/* RIGHT column */}
        <div className="flex flex-col gap-4">
          {/* AI summary */}
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-indigo-50/20 p-4.5 shadow-sm dark:border-indigo-900 dark:from-indigo-950/50 dark:to-indigo-950/20">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-indigo-600">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
                </svg>
              </div>
              <span className="text-[13.5px] font-bold">AI project summary</span>
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-widest text-indigo-600 dark:bg-indigo-900">
                Beta
              </span>
            </div>
            {aiOpen ? (
              <>
                <p className="animate-[fadeIn_.4s_ease] text-[13px] leading-relaxed text-neutral-900 dark:text-neutral-100">
                  {aiText}
                </p>
                <button
                  onClick={() => setAiOpen(false)}
                  className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  Collapse
                </button>
              </>
            ) : (
              <>
                <p className="mb-3.5 text-[12.8px] leading-relaxed text-neutral-500">
                  Generate a 3-sentence overview of momentum, risks, and what needs attention this week.
                </p>
                <button
                  onClick={() => setAiOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
                  </svg>
                  Summarize
                </button>
              </>
            )}
          </div>

          {/* Due soon */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-[13.5px] font-bold">Due soon</div>
              <span className="text-[11px] text-neutral-400">next 7 days</span>
            </div>
            {dueSoonIssues.length > 0 ? (
              <div className="flex flex-col">
                {dueSoonIssues.map((issue) => {
                  const dl = dueLabel(issue.dueDate);
                  return (
                    <div
                      key={issue.id}
                      className="flex items-center gap-2.5 border-t border-neutral-100 py-2.5 first:border-t-0 dark:border-neutral-800"
                    >
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ backgroundColor: PRIORITY_DOT[issue.priority] ?? "#94a3b8" }}
                      />
                      <span className="flex-1 truncate text-[12.8px] font-semibold">
                        {issue.title}
                      </span>
                      {issue.assigneeInitials && (
                        <div
                          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: "#6366f1" }}
                        >
                          {issue.assigneeInitials}
                        </div>
                      )}
                      <span
                        className={`min-w-[64px] rounded-md px-2 py-0.5 text-center text-[11px] font-bold ${dl.color} ${dl.bg}`}
                      >
                        {dl.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-3.5 text-xs text-neutral-400">Nothing due in the next 7 days.</p>
            )}
          </div>

          {/* Recently created */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3.5 text-[13.5px] font-bold">Recently created</div>
            <div className="flex flex-col">
              {recentIssues.map((issue) => {
                const badge = STATUS_BADGE[issue.status] ?? STATUS_BADGE["Backlog"];
                return (
                  <div
                    key={issue.id}
                    className="flex items-center gap-2.5 border-t border-neutral-100 py-2.5 first:border-t-0 dark:border-neutral-800"
                  >
                    <span className="flex-1 truncate text-[12.8px] font-semibold">
                      {issue.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${badge.bg} ${badge.text}`}
                    >
                      {issue.status}
                    </span>
                    <span className="w-[42px] text-right font-mono text-[11px] text-neutral-400">
                      {timeAgo(issue.createdAt)}
                    </span>
                  </div>
                );
              })}
              {recentIssues.length === 0 && (
                <p className="py-3.5 text-xs text-neutral-400">No issues yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
