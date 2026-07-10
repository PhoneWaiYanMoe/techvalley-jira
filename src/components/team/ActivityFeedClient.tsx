"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/client";
import type { TFunction } from "@/lib/i18n/translate";

// Type-only import — safe in a Client Component since it's erased at
// compile time and never pulls the server-only service code into the bundle.
import type { ActivityLogEntry } from "@/lib/activity-log/activity-log.service";

function formatEntry(t: TFunction, entry: ActivityLogEntry): string {
  const actor = entry.actorName ?? t("activity.someone");
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const target = typeof meta.targetName === "string" ? meta.targetName : t("activity.aMember");

  switch (entry.action) {
    case "MEMBER_JOINED":
      return t("activity.memberJoined", { actor });
    case "MEMBER_KICKED":
      return t("activity.memberKicked", { actor, target });
    case "MEMBER_LEFT":
      return t("activity.memberLeft", { actor });
    case "ROLE_CHANGED":
      return meta.newRole === "OWNER"
        ? t("activity.ownershipTransferred", { actor, target })
        : t("activity.roleChanged", {
            actor,
            target,
            role: typeof meta.newRole === "string" ? meta.newRole : t("activity.aNewRole"),
          });
    case "TEAM_UPDATED":
      return typeof meta.name === "string"
        ? t("activity.teamRenamed", { actor, name: meta.name })
        : t("activity.teamUpdated", { actor });
    case "INVITE_SENT":
      return t("activity.inviteSent", {
        actor,
        email: typeof meta.email === "string" ? meta.email : t("activity.someone"),
      });
    default:
      return t("activity.genericAction", { actor });
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
  const { t } = useI18n();
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
          {t("activity.empty")}
        </div>
        <div className="mt-1 text-[13px]">{t("activity.emptyHint")}</div>
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
          <span>{formatEntry(t, entry)}</span>
          <span className="font-mono text-[11px] text-neutral-400">
            {new Date(entry.createdAt).toLocaleString()}
          </span>
        </div>
      ))}
      {cursor && (
        <Button variant="secondary" disabled={loading} onClick={loadMore} className="self-center">
          {loading ? t("common.loading") : t("activity.loadMore")}
        </Button>
      )}
    </div>
  );
}
