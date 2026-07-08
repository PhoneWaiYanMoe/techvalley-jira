"use client";

import { Draggable } from "@hello-pangea/dnd";
import type { BoardCard } from "@/types/api";
import { PriorityDot, dueLabel } from "@/components/issues/IssueBadges";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function KanbanCard({
  card,
  index,
  disabled,
  onOpen,
}: {
  card: BoardCard;
  index: number;
  disabled: boolean;
  onOpen: (issueId: string) => void;
}) {
  const due = card.dueDate ? dueLabel(card.dueDate) : null;

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={disabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(card.id)}
          className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-colors dark:bg-neutral-900 ${
            snapshot.isDragging
              ? "border-indigo-400 ring-2 ring-indigo-200 dark:border-indigo-500 dark:ring-indigo-900"
              : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
          }`}
        >
          {card.labels.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {card.labels.map((label) => (
                <span
                  key={label.id}
                  className="rounded px-1.5 py-0.5 text-[9.5px] font-bold"
                  style={{ backgroundColor: `${label.color}1a`, color: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2">
            <span className="mt-1">
              <PriorityDot priority={card.priority} />
            </span>
            <p className="flex-1 text-[12.5px] font-semibold leading-snug">{card.title}</p>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold text-neutral-400">
              {card.subtaskProgress.total > 0 && (
                <span
                  className="flex items-center gap-1"
                  title={`${card.subtaskProgress.done}/${card.subtaskProgress.total} subtasks`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  {card.subtaskProgress.done}/{card.subtaskProgress.total}
                </span>
              )}
              {due && (
                <span className={`rounded px-1.5 py-0.5 ${due.color} ${due.bg}`}>{due.label}</span>
              )}
              <span className="text-neutral-300 dark:text-neutral-600">{shortDate(card.createdAt)}</span>
            </div>

            {card.assignee ? (
              <span
                title={card.assignee.name}
                className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[8.5px] font-bold text-white"
              >
                {card.assignee.initials}
              </span>
            ) : (
              <span className="h-[20px] w-[20px] shrink-0 rounded-full border border-dashed border-neutral-300 dark:border-neutral-700" />
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
