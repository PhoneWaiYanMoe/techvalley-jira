"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationResponse } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/client";

async function resolveHref(n: NotificationResponse): Promise<string | null> {
  // TEAM_INVITE also stores relatedEntityType "team" (the team being invited
  // to), but the invited user isn't a member yet — /teams/:teamId 404s via
  // the FR-070 membership guard until they accept. Send them to the accept
  // flow instead. ROLE_CHANGED is the other "team" notification type and IS
  // safe to send straight to /teams/:teamId (the user is already a member).
  if (n.type === "TEAM_INVITE") return "/invites";
  if (n.relatedEntityType === "team" && n.relatedEntityId) return `/teams/${n.relatedEntityId}`;
  if (n.relatedEntityType === "issue" && n.relatedEntityId) {
    try {
      const res = await fetch(`/api/issues/${n.relatedEntityId}`);
      if (!res.ok) return null;
      const issue = await res.json();
      return `/projects/${issue.projectId}/issues/${n.relatedEntityId}`;
    } catch {
      return null;
    }
  }
  return null;
}

export function NotificationsPageClient() {
  const router = useRouter();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/notifications?limit=20");
        if (!res.ok) return;
        const data = await res.json();
        setNotifications(data.data ?? []);
        setUnreadCount(data.unreadCount ?? 0);
        setCursor(data.nextCursor);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await fetch(`/api/notifications?cursor=${cursor}&limit=20`);
    setLoadingMore(false);
    if (!res.ok) return;
    const data = await res.json();
    setNotifications((prev) => [...prev, ...data.data]);
    setCursor(data.nextCursor);
  }

  async function handleClick(n: NotificationResponse) {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    const href = await resolveHref(n);
    if (href) router.push(href);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => {});
  }

  return (
    <div className="p-6 pb-10">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-bold tracking-tight">{t("notifications.title")}</h1>
          <span className="font-mono text-sm text-neutral-400">{notifications.length}</span>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={handleMarkAllRead} className="text-xs">
            {t("notifications.markAllReadCount", { n: unreadCount })}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
            {t("notifications.empty")}
          </div>
          <div className="mt-1 text-[13px]">
            {t("notifications.emptyHint")}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-left text-[13px] shadow-sm transition-colors dark:border-neutral-800 ${
                n.isRead
                  ? "bg-white dark:bg-neutral-900"
                  : "bg-indigo-50/60 dark:bg-indigo-950/30"
              }`}
            >
              <span className="flex items-center gap-2.5">
                {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />}
                <span className={n.isRead ? "" : "font-semibold"}>{n.title}</span>
              </span>
              <span className="font-mono text-[11px] text-neutral-400">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
          {cursor && (
            <Button
              variant="secondary"
              disabled={loadingMore}
              onClick={loadMore}
              className="self-center"
            >
              {loadingMore ? t("common.loading") : t("common.loadMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
