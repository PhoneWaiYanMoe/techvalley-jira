"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  IssueListItem,
  IssueListResponse,
  IssueResponse,
  IssueStatusOption,
  LabelResponse,
  ProjectResponse,
  TeamMemberResponse,
} from "@/types/api";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { CreateIssueModal } from "@/components/issues/CreateIssueModal";
import { StatusPill, PriorityDot, DueBadge } from "@/components/issues/IssueBadges";

const ISSUE_LIMIT = 200;

type Filters = {
  search: string;
  status: string;
  assignee: string;
  priority: string;
  label: string;
  hasDueDate: boolean;
  sort: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  status: "",
  assignee: "",
  priority: "",
  label: "",
  hasDueDate: false,
  sort: "created",
};

const filterSelectClass =
  "rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-neutral-600 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";

export function IssuesPageClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [statuses, setStatuses] = useState<IssueStatusOption[]>([]);
  const [labels, setLabels] = useState<LabelResponse[]>([]);
  const [members, setMembers] = useState<TeamMemberResponse[]>([]);
  const [issues, setIssues] = useState<IssueListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const hasFilters =
    filters.search !== "" ||
    filters.status !== "" ||
    filters.assignee !== "" ||
    filters.priority !== "" ||
    filters.label !== "" ||
    filters.hasDueDate ||
    filters.sort !== "created";

  const buildParams = useCallback(
    (cursor?: string) => {
      const p = new URLSearchParams();
      if (filters.search) p.set("search", filters.search);
      if (filters.status) p.set("status", filters.status);
      if (filters.assignee) p.set("assignee", filters.assignee);
      if (filters.priority) p.set("priority", filters.priority);
      if (filters.label) p.set("label", filters.label);
      if (filters.hasDueDate) p.set("hasDueDate", "true");
      if (filters.sort) p.set("sort", filters.sort);
      if (cursor) p.set("cursor", cursor);
      return p.toString();
    },
    [filters],
  );

  // Initial load: project + filter options.
  const loadShell = useCallback(async () => {
    try {
      const [projRes, statusRes, labelRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/statuses`),
        fetch(`/api/projects/${projectId}/labels`),
      ]);
      if (!projRes.ok) {
        const d = await projRes.json();
        throw new Error(d.error?.message ?? "Failed to load project");
      }
      const proj: ProjectResponse = await projRes.json();
      setProject(proj);
      if (statusRes.ok) setStatuses(await statusRes.json());
      if (labelRes.ok) setLabels(await labelRes.json());

      const memberRes = await fetch(`/api/teams/${proj.teamId}/members`);
      if (memberRes.ok) {
        const json: { data?: TeamMemberResponse[] } = await memberRes.json();
        setMembers(json.data ?? []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      await loadShell();
    })();
  }, [loadShell]);

  // Reload the list whenever filters change (debounced so typing search is smooth).
  useEffect(() => {
    const handle = setTimeout(() => {
      void (async () => {
        setListLoading(true);
        try {
          const res = await fetch(`/api/projects/${projectId}/issues?${buildParams()}`);
          if (!res.ok) return;
          const list: IssueListResponse = await res.json();
          setIssues(list.data);
          setTotal(list.total);
          setNextCursor(list.nextCursor);
        } finally {
          setListLoading(false);
        }
      })();
    }, 250);
    return () => clearTimeout(handle);
  }, [projectId, buildParams]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/issues?${buildParams(nextCursor)}`);
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
    setIssues((prev) => [{ ...issue, labels: [] }, ...prev]);
    setTotal((t) => t + 1);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{project.name} — Issues</h1>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
            {total}
            {hasFilters ? " matching" : `/${ISSUE_LIMIT}`} issues
          </p>
        </div>
        {!project.isArchived && (
          <button
            onClick={() => setShowCreate(true)}
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

      {/* Filter bar (FR-036) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder="Search title…"
            className="w-52 rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-2.5 text-[12px] outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:ring-neutral-600"
          />
        </div>

        <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={filterSelectClass}>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select value={filters.assignee} onChange={(e) => setFilter("assignee", e.target.value)} className={filterSelectClass}>
          <option value="">Any assignee</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.name}</option>
          ))}
        </select>

        <select value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} className={filterSelectClass}>
          <option value="">Any priority</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select value={filters.label} onChange={(e) => setFilter("label", e.target.value)} className={filterSelectClass}>
          <option value="">Any label</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={filters.hasDueDate}
            onChange={(e) => setFilter("hasDueDate", e.target.checked)}
          />
          Has due date
        </label>

        <div className="ml-auto flex items-center gap-2">
          <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)} className={filterSelectClass}>
            <option value="created">Newest</option>
            <option value="updated">Recently updated</option>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Issue list */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {issues.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-neutral-400">
            {listLoading
              ? "Loading…"
              : hasFilters
                ? "No issues match these filters."
                : project.isArchived
                  ? "No issues."
                  : "No issues yet — create the first one."}
          </div>
        ) : (
          issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)}
              className="flex w-full items-center gap-3 border-t border-neutral-100 px-5 py-3 text-left transition-colors first:border-t-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
            >
              <PriorityDot priority={issue.priority} />
              <span className="truncate text-[12.8px] font-semibold">{issue.title}</span>
              {issue.labels.length > 0 && (
                <span className="flex shrink-0 items-center gap-1">
                  {issue.labels.slice(0, 3).map((label) => (
                    <span
                      key={label.id}
                      className="rounded px-1.5 py-0.5 text-[9.5px] font-bold"
                      style={{ backgroundColor: `${label.color}1a`, color: label.color }}
                    >
                      {label.name}
                    </span>
                  ))}
                  {issue.labels.length > 3 && (
                    <span className="text-[9.5px] font-bold text-neutral-400">
                      +{issue.labels.length - 3}
                    </span>
                  )}
                </span>
              )}
              <span className="flex-1" />
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
