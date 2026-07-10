"use client";

import type { TeamRole } from "@/types/api";
import { useI18n } from "@/lib/i18n/client";

const ROLE_STYLES: Record<TeamRole, string> = {
  OWNER: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  ADMIN: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  MEMBER: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

// Matches DESIGN.md's "Status Pills" pattern.
export function RoleBadge({ role }: { role: TeamRole }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${ROLE_STYLES[role]}`}>
      {t(`role.${role}`)}
    </span>
  );
}
