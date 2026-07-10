"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const NAV_ITEMS = [
  {
    key: "projects",
    label: "nav.projects" as MessageKey,
    href: "/projects",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    key: "dashboard",
    label: "nav.dashboard" as MessageKey,
    href: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="M18 17V9M13 17V5M8 17v-4" />
      </svg>
    ),
  },
  {
    key: "teams",
    label: "nav.teams" as MessageKey,
    href: "/teams",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "invites",
    label: "nav.invites" as MessageKey,
    href: "/invites",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16v16H4z" />
        <path d="M4 6l8 6 8-6" />
      </svg>
    ),
  },
];

export function Sidebar({
  userName,
  userInitials,
  userImage,
}: {
  userName: string;
  userInitials: string;
  userImage?: string | null;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  // Determine active nav item
  const activeKey = pathname.startsWith("/projects")
    ? "projects"
    : pathname.startsWith("/dashboard")
      ? "dashboard"
      : pathname.startsWith("/teams")
        ? "teams"
        : pathname.startsWith("/invites")
          ? "invites"
          : "";

  return (
    <aside className="flex w-[250px] shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-indigo-600 text-sm font-extrabold text-white">
          T
        </div>
        <span className="flex-1 text-[15px] font-bold tracking-tight">TechValley</span>
        <ThemeToggle />
        <NotificationBell />
      </div>

      {/* Workspace label */}
      <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
        {t("nav.workspace")}
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-indigo-50 font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                  : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <span className="flex">{item.icon}</span>
              <span className="flex-1">{t(item.label)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Language */}
      <div className="px-2 pb-3">
        <LanguageSwitcher className="w-full" />
      </div>

      {/* User info */}
      <div className="flex items-center gap-2.5 border-t border-neutral-200 px-2 pt-3 dark:border-neutral-800">
        <Link
          href="/profile"
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
            pathname.startsWith("/profile") ? "text-indigo-600 dark:text-indigo-400" : ""
          }`}
        >
          <Avatar src={userImage} initials={userInitials} size={30} className="text-xs" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{userName}</div>
          </div>
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
