"use client";

import { useState } from "react";
import type { IssueHistoryEntry, IssueHistoryResponse } from "@/types/api";

const FIELD_LABEL: Record<string, string> = {
  status: "status",
  assignee: "assignee",
  priority: "priority",
  title: "title",
  due_date: "due date",
};

function val(v: string | null): string {
  return v && v.trim() !== "" ? v : "—";
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function IssueHistory({ issueId }: { issueId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [entries, setEntries] = useState<IssueHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchPage(cursor?: string) {
    setLoading(true);
    try {
      const url = `/api/issues/${issueId}/history${cursor ? `?cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data: IssueHistoryResponse = await res.json();
      setEntries((prev) => (cursor ? [...prev, ...data.data] : data.data));
      setNextCursor(data.nextCursor);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) void fetchPage();
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <button onClick={toggle} className="flex w-full items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Change history</h2>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-3">
          {!loaded && loading && (
            <p className="text-[12.5px] text-neutral-400">Loading…</p>
          )}
          {loaded && entries.length === 0 && (
            <p className="text-[12.5px] text-neutral-400">No changes recorded yet.</p>
          )}
          {entries.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {entries.map((e) => (
                <li key={e.id} className="flex gap-2.5 text-[12.3px]">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                  <div className="flex-1">
                    <p>
                      <span className="font-semibold">{e.changedBy}</span> changed{" "}
                      <span className="font-semibold">{FIELD_LABEL[e.field] ?? e.field}</span>{" "}
                      <span className="text-neutral-400">from</span>{" "}
                      <span className="font-medium">{val(e.oldValue)}</span>{" "}
                      <span className="text-neutral-400">to</span>{" "}
                      <span className="font-medium">{val(e.newValue)}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-neutral-400">{when(e.changedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {nextCursor && (
            <button
              onClick={() => void fetchPage(nextCursor)}
              disabled={loading}
              className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-neutral-500 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
