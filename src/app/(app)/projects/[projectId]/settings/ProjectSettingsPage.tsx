"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LabelResponse, ProjectResponse } from "@/types/api";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { LabelManager } from "@/components/labels/LabelManager";

export function ProjectSettingsPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [labels, setLabels] = useState<LabelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projRes, labelRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/labels`),
      ]);
      if (!projRes.ok) {
        const d = await projRes.json();
        throw new Error(d.error?.message ?? "Failed to load project");
      }
      setProject(await projRes.json());
      if (labelRes.ok) setLabels(await labelRes.json());
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

  async function toggleArchive() {
    if (!project || archiveBusy) return;
    setArchiveBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !project.isArchived }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to update project");
      }
      setProject(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setArchiveBusy(false);
    }
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

      <h1 className="mb-5 text-xl font-bold tracking-tight">{project.name} — Settings</h1>

      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        {/* Labels */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <LabelManager
            projectId={projectId}
            labels={labels}
            setLabels={setLabels}
            disabled={project.isArchived}
          />
        </div>

        {/* Archive (FR-026) */}
        <div className="h-fit rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-[13.5px] font-bold">Archive</h2>
          <p className="mb-4 text-[12.5px] leading-relaxed text-neutral-400">
            {project.isArchived
              ? "This project is archived — its issues are read-only. Restore it to make changes again."
              : "Archiving hides the project from the active list and makes all its issues read-only. You can restore it anytime."}
          </p>
          <button
            onClick={toggleArchive}
            disabled={archiveBusy}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-bold shadow-sm disabled:opacity-60 ${
              project.isArchived
                ? "bg-indigo-600 text-white"
                : "border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
            }`}
          >
            {archiveBusy
              ? "Saving…"
              : project.isArchived
                ? "Restore project"
                : "Archive project"}
          </button>
        </div>
      </div>
    </div>
  );
}
