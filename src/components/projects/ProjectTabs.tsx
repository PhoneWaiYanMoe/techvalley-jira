"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Project-scoped sub-nav (Board tab arrives with FR-050, Day 3)
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Dashboard", href: `/projects/${projectId}`, exact: true },
    { label: "Issues", href: `/projects/${projectId}/issues`, exact: false },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
