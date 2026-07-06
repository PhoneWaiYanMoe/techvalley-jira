"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeamTabs({
  tabs,
}: {
  tabs: { key: string; label: string; href: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
              active
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
