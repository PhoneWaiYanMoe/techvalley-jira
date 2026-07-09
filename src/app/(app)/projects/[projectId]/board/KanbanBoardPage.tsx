"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import type { BoardCard, BoardResponse, IssueStatusOption, ProjectResponse } from "@/types/api";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { ColumnMenu } from "@/components/kanban/ColumnMenu";
import { AddColumn } from "@/components/kanban/AddColumn";

const MAX_CUSTOM_STATUSES = 5;

// Compute a fractional position for a card dropped at `index` within a column
// whose cards (excluding the dragged one) are `siblings`, ordered by position.
function positionFor(siblings: BoardCard[], index: number): number {
  const prev = siblings[index - 1];
  const next = siblings[index];
  if (prev && next) return (prev.position + next.position) / 2;
  if (next) return next.position - 1;
  if (prev) return prev.position + 1;
  return 1;
}

export function KanbanBoardPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [statuses, setStatuses] = useState<IssueStatusOption[]>([]);
  const [issues, setIssues] = useState<BoardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [projRes, boardRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/board`),
      ]);
      if (!projRes.ok) {
        const d = await projRes.json();
        throw new Error(d.error?.message ?? "Failed to load project");
      }
      if (!boardRes.ok) {
        const d = await boardRes.json();
        throw new Error(d.error?.message ?? "Failed to load board");
      }
      const proj: ProjectResponse = await projRes.json();
      const board: BoardResponse = await boardRes.json();
      setProject(proj);
      setStatuses(board.statuses);
      setIssues(board.issues);
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

  // Group cards by status, ordered by position.
  const cardsByStatus = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const status of statuses) map.set(status.id, []);
    for (const card of issues) {
      const list = map.get(card.statusId);
      if (list) list.push(card);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [statuses, issues]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const destStatusId = destination.droppableId;
      const siblings = (cardsByStatus.get(destStatusId) ?? []).filter(
        (c) => c.id !== draggableId,
      );
      const newPosition = positionFor(siblings, destination.index);

      const snapshot = issues;
      setMoveError(null);
      setIssues((prev) =>
        prev.map((c) =>
          c.id === draggableId ? { ...c, statusId: destStatusId, position: newPosition } : c,
        ),
      );

      void (async () => {
        try {
          const res = await fetch(`/api/issues/${draggableId}/move`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ statusId: destStatusId, position: newPosition }),
          });
          if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error?.message ?? "Failed to move issue");
          }
        } catch (err) {
          setIssues(snapshot); // roll back the optimistic move
          setMoveError(err instanceof Error ? err.message : "Failed to move issue");
        }
      })();
    },
    [cardsByStatus, issues],
  );

  // FR-053: add a custom column.
  async function handleAddColumn(name: string) {
    const res = await fetch(`/api/projects/${projectId}/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error?.message ?? "Failed to add column");
    }
    const created: IssueStatusOption = await res.json();
    setStatuses((prev) => [...prev, created].sort((a, b) => a.position - b.position));
  }

  // FR-053/054: rename / recolor / set WIP limit.
  async function handleUpdateStatus(
    statusId: string,
    patch: { name?: string; color?: string; wipLimit?: number | null },
  ) {
    const res = await fetch(`/api/statuses/${statusId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error?.message ?? "Failed to update column");
    }
    const updated: IssueStatusOption = await res.json();
    setStatuses((prev) =>
      prev.map((s) => (s.id === statusId ? updated : s)).sort((a, b) => a.position - b.position),
    );
  }

  // FR-053: delete a custom column; its issues move to Backlog, so reload the board.
  async function handleDeleteStatus(statusId: string) {
    const res = await fetch(`/api/statuses/${statusId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error?.message ?? "Failed to delete column");
    }
    await load();
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

  const dragDisabled = project.isArchived;

  return (
    <div className="flex h-full flex-col p-6 pb-4">
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

      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">{project.name} — Board</h1>
      </div>

      {project.isArchived && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          This project is archived — the board is read-only.
        </div>
      )}

      {moveError && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-400">
          {moveError}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-3">
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              cards={cardsByStatus.get(status.id) ?? []}
              disabled={dragDisabled}
              onOpen={(issueId) => router.push(`/projects/${projectId}/issues/${issueId}`)}
              action={
                project.isArchived ? undefined : (
                  <ColumnMenu
                    status={status}
                    onUpdate={(patch) => handleUpdateStatus(status.id, patch)}
                    onDelete={() => handleDeleteStatus(status.id)}
                  />
                )
              }
            />
          ))}

          {!project.isArchived &&
            statuses.filter((s) => !s.isDefault).length < MAX_CUSTOM_STATUSES && (
              <AddColumn onAdd={handleAddColumn} />
            )}
        </div>
      </DragDropContext>
    </div>
  );
}
