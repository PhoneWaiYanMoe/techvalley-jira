"use client";

import type { ReactNode } from "react";
import { Droppable } from "@hello-pangea/dnd";
import type { BoardCard, IssueStatusOption } from "@/types/api";
import { KanbanCard } from "./KanbanCard";

export function KanbanColumn({
  status,
  cards,
  disabled,
  onOpen,
  action,
}: {
  status: IssueStatusOption;
  cards: BoardCard[];
  disabled: boolean;
  onOpen: (issueId: string) => void;
  action?: ReactNode;
}) {
  const count = cards.length;
  // FR-054: over the WIP limit → highlight the header (limit is advisory, never blocks).
  const overLimit = status.wipLimit != null && count > status.wipLimit;

  return (
    <div className="flex w-[300px] shrink-0 flex-col">
      <div
        className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 ${
          overLimit
            ? "bg-rose-50 dark:bg-rose-950"
            : "bg-neutral-100 dark:bg-neutral-800/60"
        }`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: status.color ?? "#94a3b8" }}
        />
        <span className="flex-1 truncate text-[12.5px] font-bold">{status.name}</span>
        <span
          className={`font-mono text-[11px] font-bold ${
            overLimit ? "text-rose-600" : "text-neutral-400"
          }`}
        >
          {count}
          {status.wipLimit != null ? `/${status.wipLimit}` : ""}
        </span>
        {action}
      </div>

      <Droppable droppableId={status.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-2 transition-colors ${
              snapshot.isDraggingOver
                ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                : "bg-neutral-50/60 dark:bg-neutral-900/40"
            }`}
          >
            {cards.map((card, index) => (
              <KanbanCard
                key={card.id}
                card={card}
                index={index}
                disabled={disabled}
                onOpen={onOpen}
              />
            ))}
            {provided.placeholder}
            {count === 0 && !snapshot.isDraggingOver && (
              <p className="px-2 py-6 text-center text-[11px] text-neutral-300 dark:text-neutral-600">
                No issues
              </p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
