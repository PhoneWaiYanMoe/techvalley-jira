"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

// Type-only import — safe in a Client Component since it's erased at
// compile time and never pulls the server-only service code into the bundle.
import type { ActivityLogEntry } from "@/lib/activity-log/activity-log.service";

function formatEntry(entry: ActivityLogEntry): string {
  const actor = entry.actorName ?? "Someone";
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const targetName = typeof meta.targetName === "string" ? meta.targetName : "a member";

  switch (entry.action) {
    case "MEMBER_JOINED":
      return `${actor} joined the team`;
    case "MEMBER_KICKED":
      return `${actor} removed ${targetName} from the team`;
    case "MEMBER_LEFT":
      return `${actor} left the team`;
    case "ROLE_CHANGED":
      return meta.newRole === "OWNER"
        ? `${actor} transferred ownership to ${targetName}`
        : `${actor} changed ${targetName}'s role to ${meta.newRole ?? "a new role"}`;
    case "TEAM_UPDATED":
      return typeof meta.name === "string"
        ? `${actor} renamed the team to "${meta.name}"`
        : `${actor} updated the team`;
    case "INVITE_SENT":
      return `${actor} invited ${typeof meta.email === "string" ? meta.email : "someone"}`;
    default:
      return `${actor} performed an action`;
  }
}

export function ActivityFeedClient({
  teamId,
  initialData,
  initialCursor,
}: {
  teamId: string;
  initialData: ActivityLogEntry[];
  initialCursor: string | null;
}) {
  const [entries, setEntries] = useState(initialData);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}/activity?cursor=${cursor}&limit=20`);
    setLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setEntries((prev) => [...prev, ...data.data]);
    setCursor(data.nextCursor);
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
          No activity yet
        </div>
        <div className="mt-1 text-[13px]">Team changes will show up here.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-[13px] shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
        >
          <span>{formatEntry(entry)}</span>
          <span className="font-mono text-[11px] text-neutral-400">
            {new Date(entry.createdAt).toLocaleString()}
          </span>
        </div>
      ))}
      {cursor && (
        <Button variant="secondary" disabled={loading} onClick={loadMore} className="self-center">
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
