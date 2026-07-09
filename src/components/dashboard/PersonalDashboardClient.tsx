"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PersonalDashboardResponse, PersonalDashboardIssue } from "@/types/api";
import { StatusDonut } from "@/components/projects/StatusDonut";

const STATUS_COLORS: Record<string, string> = {
  Backlog: "#94a3b8",
  "In Progress": "#6366f1",
  "In Review": "#e0982e",
  Done: "#10b981",
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "#f43f5e",
  MEDIUM: "#e0982e",
  LOW: "#94a3b8",
};

function IssueRow({ issue }: { issue: PersonalDashboardIssue }) {
  return (
    <Link
      href={`/projects/${issue.projectId}/issues/${issue.id}`}
      className="flex items-center gap-2.5 border-t border-neutral-100 py-2.5 first:border-t-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
    >
      <span
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_DOT[issue.priority] ?? "#94a3b8" }}
      />
      <span className="flex-1 truncate text-[12.8px] font-semibold">{issue.title}</span>
      <span className="shrink-0 truncate text-[11px] text-neutral-400">{issue.projectName}</span>
      {issue.dueDate && (
        <span className="shrink-0 font-mono text-[11px] text-neutral-400">
          {new Date(`${issue.dueDate}T00:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </span>
      )}
    </Link>
  );
}

export function PersonalDashboardClient() {
  const [data, setData] = useState<PersonalDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/personal");
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to load dashboard");
      }
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
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
      <div className="p-6 py-20 text-center">
        <p className="text-sm text-red-600">{error ?? "Failed to load"}</p>
      </div>
    );
  }

  const { totalAssigned, issuesByStatus, dueTodayIssues, dueSoonIssues, recentComments, teams, projects } = data;

  const kpiCards = [
    { label: "Assigned to me", value: totalAssigned, color: "#4f46e5" },
    { label: "Due today", value: dueTodayIssues.length, color: "#f43f5e" },
    { label: "Due within 7 days", value: dueSoonIssues.length, color: "#e0982e" },
    { label: "My teams", value: teams.length, color: "#0ea5e9" },
  ];

  const statusSegments = issuesByStatus.map((s) => ({
    name: s.status,
    count: s.count,
    color: STATUS_COLORS[s.status] ?? "#94a3b8",
  }));

  return (
    <div className="p-6 pb-10">
      <h1 className="mb-5 text-xl font-bold tracking-tight">My Dashboard</h1>

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
            <span className="text-3xl font-bold tracking-tight">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.15fr_1fr] items-start gap-4 max-lg:grid-cols-1">
        {/* LEFT column */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4.5 text-[13.5px] font-bold">My issues by status</div>
            <StatusDonut segments={statusSegments} total={totalAssigned} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3.5 text-[13.5px] font-bold">Due today</div>
            {dueTodayIssues.length > 0 ? (
              <div className="flex flex-col">
                {dueTodayIssues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            ) : (
              <p className="py-3.5 text-xs text-neutral-400">Nothing due today.</p>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-[13.5px] font-bold">Due soon</div>
              <span className="text-[11px] text-neutral-400">next 7 days</span>
            </div>
            {dueSoonIssues.length > 0 ? (
              <div className="flex flex-col">
                {dueSoonIssues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            ) : (
              <p className="py-3.5 text-xs text-neutral-400">Nothing due in the next 7 days.</p>
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3.5 text-[13.5px] font-bold">My teams</div>
            {teams.length > 0 ? (
              <div className="flex flex-col">
                {teams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="flex items-center justify-between border-t border-neutral-100 py-2.5 first:border-t-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                  >
                    <span className="truncate text-[12.8px] font-semibold">{team.name}</span>
                    <span className="shrink-0 text-[11px] text-neutral-400">{team.myRole}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-3.5 text-xs text-neutral-400">You&apos;re not on any teams yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3.5 text-[13.5px] font-bold">My projects</div>
            {projects.length > 0 ? (
              <div className="flex flex-col">
                {projects.slice(0, 8).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between border-t border-neutral-100 py-2.5 first:border-t-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                  >
                    <span className="truncate text-[12.8px] font-semibold">{project.name}</span>
                    {project.isArchived && (
                      <span className="shrink-0 text-[11px] text-neutral-400">Archived</span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-3.5 text-xs text-neutral-400">No projects yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3.5 text-[13.5px] font-bold">My recent comments</div>
            {recentComments.length > 0 ? (
              <div className="flex flex-col">
                {recentComments.map((c) => (
                  <Link
                    key={c.id}
                    href={`/projects/${c.projectId}/issues/${c.issueId}`}
                    className="border-t border-neutral-100 py-2.5 first:border-t-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                  >
                    <div className="truncate text-[11.5px] font-semibold text-neutral-500">
                      {c.issueTitle}
                    </div>
                    <div className="mt-0.5 truncate text-[12.8px]">{c.content}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-3.5 text-xs text-neutral-400">No comments yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
