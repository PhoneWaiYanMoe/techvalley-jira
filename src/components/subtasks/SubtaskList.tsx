"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { SubtaskResponse } from "@/types/api";

const MAX_SUBTASKS = 20;

export function SubtaskList({
  issueId,
  subtasks,
  setSubtasks,
  readOnly,
}: {
  issueId: string;
  subtasks: SubtaskResponse[];
  setSubtasks: (s: SubtaskResponse[]) => void;
  readOnly: boolean;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const done = subtasks.filter((s) => s.isCompleted).length;

  async function add() {
    if (!newTitle.trim() || busy || subtasks.length >= MAX_SUBTASKS) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to add subtask");
      }
      const created: SubtaskResponse = await res.json();
      setSubtasks([...subtasks, created]);
      setNewTitle("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add subtask");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(subtask: SubtaskResponse) {
    if (readOnly) return;
    const snapshot = subtasks;
    setErr(null);
    setSubtasks(
      subtasks.map((s) => (s.id === subtask.id ? { ...s, isCompleted: !s.isCompleted } : s)),
    );
    try {
      const res = await fetch(`/api/subtasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !subtask.isCompleted }),
      });
      if (!res.ok) throw new Error("Failed to update subtask");
    } catch {
      setSubtasks(snapshot);
      setErr("Failed to update subtask");
    }
  }

  async function remove(id: string) {
    if (readOnly) return;
    const snapshot = subtasks;
    setErr(null);
    setSubtasks(subtasks.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/subtasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete subtask");
    } catch {
      setSubtasks(snapshot);
      setErr("Failed to delete subtask");
    }
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination || result.destination.index === result.source.index) return;
    const items = Array.from(subtasks);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const reindexed = items.map((s, i) => ({ ...s, position: i }));

    const snapshot = subtasks;
    setErr(null);
    setSubtasks(reindexed);

    const changed = reindexed.filter(
      (s) => snapshot.find((o) => o.id === s.id)?.position !== s.position,
    );
    try {
      await Promise.all(
        changed.map((s) =>
          fetch(`/api/subtasks/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: s.position }),
          }).then((r) => {
            if (!r.ok) throw new Error("reorder failed");
          }),
        ),
      );
    } catch {
      setSubtasks(snapshot);
      setErr("Failed to reorder subtasks");
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13.5px] font-bold">Subtasks</h2>
        <span className="font-mono text-[11px] text-neutral-400">
          {done}/{subtasks.length}
        </span>
        {subtasks.length > 0 && (
          <div className="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(done / subtasks.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {err && <p className="mb-2 text-[11.5px] font-semibold text-rose-600">{err}</p>}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="subtasks">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
              {subtasks.map((subtask, index) => (
                <Draggable
                  key={subtask.id}
                  draggableId={subtask.id}
                  index={index}
                  isDragDisabled={readOnly}
                >
                  {(dp, snapshot) => (
                    <div
                      ref={dp.innerRef}
                      {...dp.draggableProps}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                        snapshot.isDragging
                          ? "bg-neutral-100 dark:bg-neutral-800"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                      }`}
                    >
                      {!readOnly && (
                        <span
                          {...dp.dragHandleProps}
                          className="cursor-grab text-neutral-300 dark:text-neutral-600"
                          aria-label="Drag to reorder"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="6" r="1.5" />
                            <circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" />
                            <circle cx="15" cy="18" r="1.5" />
                          </svg>
                        </span>
                      )}
                      <button
                        onClick={() => void toggle(subtask)}
                        disabled={readOnly}
                        aria-label={subtask.isCompleted ? "Mark incomplete" : "Mark complete"}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          subtask.isCompleted
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-neutral-300 dark:border-neutral-600"
                        }`}
                      >
                        {subtask.isCompleted && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`flex-1 text-[12.8px] ${
                          subtask.isCompleted ? "text-neutral-400 line-through" : "font-medium"
                        }`}
                      >
                        {subtask.title}
                      </span>
                      {!readOnly && (
                        <button
                          onClick={() => void remove(subtask.id)}
                          aria-label="Delete subtask"
                          className="text-neutral-300 hover:text-rose-500 dark:text-neutral-600"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {subtasks.length === 0 && (
        <p className="py-2 text-[12.5px] text-neutral-400">No subtasks yet.</p>
      )}

      {!readOnly && subtasks.length < MAX_SUBTASKS && (
        <div className="mt-2 flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            maxLength={200}
            placeholder="Add a subtask…"
            className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:ring-neutral-600"
          />
          <button
            onClick={() => void add()}
            disabled={!newTitle.trim() || busy}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
