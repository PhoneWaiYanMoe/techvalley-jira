"use client";

import { useRouter } from "next/navigation";
import { ProjectDashboard } from "@/components/projects/ProjectDashboard";

export function ProjectDashboardPage({ projectId }: { projectId: string }) {
  const router = useRouter();

  return (
    <div className="p-6 pb-10">
      {/* Back button + breadcrumb */}
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
      </div>

      <ProjectDashboard projectId={projectId} />
    </div>
  );
}
