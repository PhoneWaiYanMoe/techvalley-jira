"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ProjectResponse } from "@/types/api";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";

type Tab = "all" | "favorites" | "archived";
type Sort = "recommended" | "name" | "issues" | "recent";

export function ProjectsPageClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      setProjects(data.data ?? []);
      // Extract teamId from the first project for the create modal
      if (data.data?.length > 0) {
        setTeamId(data.data[0].teamId);
      }
    } catch {
      // silently fail — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  // If no projects exist, we need a teamId for creation. Fetch from teams API.
  const fetchTeamId = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) return;
      const data = await res.json();
      if (data.data?.length > 0 && !teamId) {
        setTeamId(data.data[0].id);
      }
    } catch {
      // ignore
    }
  }, [teamId]);

  useEffect(() => {
    fetchProjects();
    fetchTeamId();
  }, [fetchProjects, fetchTeamId]);

  // Filter by tab
  let filtered = projects.filter((p) => {
    if (tab === "archived") return p.isArchived;
    return !p.isArchived;
  });
  if (tab === "favorites") filtered = filtered.filter((p) => p.isFavorited);

  // Filter by search query
  const q = query.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    );
  }

  // Sort
  const sorted = [...filtered];
  if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "issues")
    sorted.sort(
      (a, b) =>
        Object.values(b.issueCounts).reduce((x, y) => x + y, 0) -
        Object.values(a.issueCounts).reduce((x, y) => x + y, 0),
    );
  else if (sort === "recent")
    sorted.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  else {
    // recommended: favorites first, then by date
    sorted.sort((a, b) => {
      if (a.isFavorited !== b.isFavorited) return a.isFavorited ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: projects.filter((p) => !p.isArchived).length },
    { key: "favorites", label: "Favorites", count: projects.filter((p) => !p.isArchived && p.isFavorited).length },
    { key: "archived", label: "Archived", count: projects.filter((p) => p.isArchived).length },
  ];

  const emptyMsg =
    tab === "favorites"
      ? "Star a project to pin it here."
      : tab === "archived"
        ? "Archived projects will show up here."
        : q
          ? "Try a different search."
          : "Create your first project to get started.";

  // Determine teamId for create modal (from first project or fetch)
  const effectiveTeamId = teamId ?? projects[0]?.teamId;

  function handleToggleFav(project: ProjectResponse) {
    const newFav = !project.isFavorited;
    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, isFavorited: newFav } : p)),
    );
    fetch(`/api/projects/${project.id}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: newFav }),
    }).catch(() => {
      // Revert on error
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, isFavorited: !newFav } : p,
        ),
      );
    });
  }

  return (
    <div className="p-6 pb-10">
      {/* Top bar */}
      <div className="mb-5 flex items-baseline gap-2.5">
        <h1 className="text-xl font-bold tracking-tight">Projects</h1>
        <span className="font-mono text-sm text-neutral-400">{sorted.length}</span>
      </div>

      {/* Filter row */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="flex gap-0.5 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {t.label}
              <span className="font-mono text-[11px] opacity-70">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative flex items-center">
          <svg
            className="pointer-events-none absolute left-3"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#98a0b3"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            className="w-[230px] rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-[13px] shadow-sm outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:ring-neutral-600"
          />
        </div>

        {/* Sort */}
        <div className="relative flex items-center">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="appearance-none rounded-lg border border-neutral-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-neutral-500 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="recommended">Recommended</option>
            <option value="name">Name (A–Z)</option>
            <option value="issues">Most issues</option>
            <option value="recent">Recently created</option>
          </select>
          <svg
            className="pointer-events-none absolute right-2.5"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#98a0b3"
            strokeWidth="2.2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* New project button */}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-shadow hover:shadow-md"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New project
        </button>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
        </div>
      ) : sorted.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4">
          {sorted.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => router.push(`/projects/${p.id}`)}
              onToggleFav={() => handleToggleFav(p)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
            No projects here
          </div>
          <div className="mt-1 text-[13px]">{emptyMsg}</div>
        </div>
      )}

      {/* Create modal */}
      {createOpen && effectiveTeamId && (
        <CreateProjectModal
          teamId={effectiveTeamId}
          slotsLeft={15 - projects.filter((p) => !p.isArchived).length}
          onClose={() => setCreateOpen(false)}
          onCreated={(project) => {
            setProjects((prev) => [project, ...prev]);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}
