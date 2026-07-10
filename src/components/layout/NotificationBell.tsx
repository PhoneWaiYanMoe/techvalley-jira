"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationResponse } from "@/types/api";
import { useI18n } from "@/lib/i18n/client";
import type { TFunction } from "@/lib/i18n/translate";

function timeAgo(t: TFunction, dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minsAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { n: hours });
  return t("time.daysAgo", { n: Math.floor(hours / 24) });
}

// Issue detail lives at /projects/:projectId/issues/:issueId — the
// notification only stores the issueId, so resolve the projectId first.
async function entityHref(n: NotificationResponse): Promise<string | null> {
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

export function NotificationBell() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/notifications?limit=8");
        if (!res.ok) return;
        const data = await res.json();
        setNotifications(data.data ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleNotificationClick(n: NotificationResponse) {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    setOpen(false);
    const href = await entityHref(n);
    if (href) router.push(href);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => {});
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-[30px] w-[30px] items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
        aria-label={t("notifications.title")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {loaded && unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              {t("notifications.title")}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-neutral-400">
                {t("notifications.empty")}
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex w-full flex-col gap-0.5 border-b border-neutral-100 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800 ${
                    n.isRead ? "" : "bg-indigo-50/50 dark:bg-indigo-950/30"
                  }`}
                >
                  <span className="flex items-start gap-2 text-[12.5px]">
                    {!n.isRead && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
                    )}
                    <span className={n.isRead ? "text-neutral-600 dark:text-neutral-400" : "font-semibold"}>
                      {n.title}
                    </span>
                  </span>
                  <span className="ml-3.5 font-mono text-[10.5px] text-neutral-400">
                    {timeAgo(t, n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-[11.5px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {t("notifications.viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
