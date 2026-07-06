"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { IssueListResponse, IssueResponse, ProjectResponse } from "@/types/api";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { CreateIssueModal } from "@/components/issues/CreateIssueModal";
import { StatusPill, PriorityDot, DueBadge } from "@/components/issues/IssueBadges";

const ISSUE_LIMIT = 200;

export function IssuesPageClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [issues, setIssues] = useState<IssueResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projRes, listRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/issues`),
      ]);
      if (!projRes.ok) {
        const d = await projRes.json();
        throw new Error(d.error?.message ?? "Failed to load project");
      }
      if (!listRes.ok) {
        const d = await listRes.json();
        throw new Error(d.error?.message ?? "Failed to load issues");
      }
      const proj: ProjectResponse = await projRes.json();
      const list: IssueListResponse = await listRes.json();
      setProject(proj);
      setIssues(list.data);
      setTotal(list.total);
      setNextCursor(list.nextCursor);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/issues?cursor=${nextCursor}`);
      if (!res.ok) return;
      const list: IssueListResponse = await res.json();
      setIssues((prev) => [...prev, ...list.data]);
      setNextCursor(list.nextCursor);
      setTotal(list.total);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleCreated(issue: IssueResponse) {
    setShowCreate(false);
    setIssues((prev) => [issue, ...prev]);
    setTotal((t) => t + 1);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? "Project not found"}</p>
      </div>
    );
  }

  return (
    <div className="p-6 pb-10">
      {/* Back button + tabs */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push("/projects")}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Projects
        </button>
        <ProjectTabs projectId={projectId} />
      </div>

      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{project.name} — Issues</h1>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
            {total}/{ISSUE_LIMIT} issues
          </p>
        </div>
        {!project.isArchived && (
          <button
            onClick={() => setShowCreate(true)}
            disabled={total >= ISSUE_LIMIT}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            New issue
          </button>
        )}
      </div>

      {project.isArchived && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          This project is archived — issues are read-only.
        </div>
      )}

      {/* Issue list */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {issues.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-neutral-400">
            No issues yet{project.isArchived ? "." : " — create the first one."}
          </div>
        ) : (
          issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)}
              className="flex w-full items-center gap-3 border-t border-neutral-100 px-5 py-3 text-left transition-colors first:border-t-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
            >
              <PriorityDot priority={issue.priority} />
              <span className="flex-1 truncate text-[12.8px] font-semibold">{issue.title}</span>
              {issue.assignee ? (
                <span
                  title={issue.assignee.name}
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white"
                >
                  {issue.assignee.initials}
                </span>
              ) : (
                <span className="h-[22px] w-[22px] shrink-0 rounded-full border border-dashed border-neutral-300 dark:border-neutral-700" />
              )}
              <StatusPill name={issue.status.name} />
              <DueBadge dueDate={issue.dueDate} />
            </button>
          ))
        )}
      </div>

      {/* Load more */}
      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-neutral-500 shadow-sm hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {showCreate && (
        <CreateIssueModal
          projectId={projectId}
          teamId={project.teamId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
